import { Component, input, computed, signal, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { BreakpointObserver } from '@angular/cdk/layout';
import { map } from 'rxjs/operators';
import { MatDialog } from '@angular/material/dialog';
import { MatMenuModule } from '@angular/material/menu';
import { AddBlockDialogComponent, AddBlockDialogResult } from '../add-block-dialog/add-block-dialog.component';
import { ScheduleService } from '../schedule.service';
import { DutyRequestService } from '../duty-request.service';
import { VoyageService } from '../../voyage/voyage.service';
import { ConfirmationService } from '../confirmation.service';
import { CorrectionService } from '../../dm/correction.service';
import { TrainingService } from '../../dm/training.service';
import { TrainingTrackerService } from '../../dm/training-tracker.service';
import { AuthService } from '../../../core/auth/auth.service';
import { ToastService } from '../../../shared/toast.service';
import { CREW_COLORS, TIER_NAMES } from '../../../shared/data/training.data';
import { Day, ScheduleBlock, DAY_BUDGET, SLOT_WEIGHT_UNITS, SLOT_WEIGHT_LABEL, SESSION_PP, TrainingSession } from '../../../shared/models';

export interface SlotItem {
  type: 'block' | 'empty';
  block?: ScheduleBlock;
  slotIndex: number;
  span: number;
}

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];
const SEAL_HUES = [0, 320, 22, 268, 180, 96, 210, 45];

@Component({
  selector: 'app-day-row',
  standalone: true,
  imports: [MatMenuModule],
  templateUrl: './day-row.component.html',
  styleUrl: './day-row.component.scss',
})
export class DayRowComponent {
  day = input.required<Day>();
  users = input.required<{ id: string; display_name: string; character_name: string }[]>();

  currentUserId = computed(() => this.auth.userId());
  isDm = computed(() => this.auth.isDm());

  private breakpoints = inject(BreakpointObserver);
  isMobile = toSignal(
    this.breakpoints.observe('(max-width: 860px)').pipe(map(r => r.matches)),
    { initialValue: false },
  );

  // mobile: which crewmate strips are expanded
  expanded = signal<Set<string>>(new Set());

  draggingBlock = signal<ScheduleBlock | null>(null);
  dragOverSlot = signal<number | null>(null);

  constructor(
    private scheduleService: ScheduleService,
    public requests: DutyRequestService,
    private voyageService: VoyageService,
    private confirmations: ConfirmationService,
    private corrections: CorrectionService,
    private trainingService: TrainingService,
    private tracker: TrainingTrackerService,
    private auth: AuthService,
    private toast: ToastService,
    private dialog: MatDialog,
  ) {}

  // ----- lock / seal state (feature #1) -----
  playerCount = computed(() => this.users().length);
  isLocked = computed(() =>
    !!this.day().locked || this.confirmations.allSealed(this.day().id, this.playerCount()),
  );
  sealedCount = computed(() => this.confirmations.sealedFor(this.day().id).length);

  isSealed(userId: string): boolean {
    return this.confirmations.isSealed(this.day().id, userId);
  }
  sealHue(userId: string): number {
    const i = this.users().findIndex(u => u.id === userId);
    return SEAL_HUES[(i < 0 ? 0 : i) % SEAL_HUES.length];
  }
  sealInitial(userId: string): string {
    const u = this.users().find(x => x.id === userId);
    return (u?.character_name ?? '?').charAt(0);
  }
  sealStyle(userId: string): Record<string, string> {
    const h = this.sealHue(userId);
    return {
      width: '30px', height: '30px',
      background: `radial-gradient(circle at 36% 30%, hsl(${h},65%,40%), hsl(${h},62%,28%) 55%, hsl(${h},60%,18%))`,
      'box-shadow': `0 2px 5px rgba(0,0,0,0.55), inset 0 1px 2px hsla(${h},70%,60%,0.45), inset 0 -2px 4px rgba(0,0,0,0.4)`,
    };
  }
  sealTextStyle(userId: string): Record<string, string> {
    const h = this.sealHue(userId);
    return {
      color: `hsl(${h},45%,62%)`, 'font-size': '13px',
      width: '20px', height: '20px',
      border: `1px solid hsla(${h},50%,55%,0.5)`,
    };
  }

  async toggleSeal(userId: string) {
    if (this.isSealed(userId)) {
      await this.confirmations.withdraw(this.day().id, userId);
      this.toast.show('Seal withdrawn — schedule open again');
    } else {
      await this.confirmations.seal(this.day().id, userId);
      const remaining = this.playerCount() - this.sealedCount();
      this.toast.show(remaining <= 0
        ? `All hands sealed — Day ${this.day().day_number} is locked`
        : `Sealed. Waiting on ${remaining} more`);
    }
  }

  private async withdrawSealIfNeeded(userId: string) {
    if (this.isSealed(userId)) {
      await this.confirmations.withdraw(this.day().id, userId);
    }
  }

  // ----- correction state (feature #3) -----
  isCorrected(userId: string): boolean {
    return this.corrections.isCorrected(this.day().id, userId);
  }

  // ----- per-row editing -----
  canEdit(userId: string): boolean {
    if (this.isLocked()) return false;
    return userId === this.currentUserId() || this.isDm();
  }
  isMe(userId: string): boolean {
    return userId === this.currentUserId();
  }

  getPlayerBlocks(userId: string) {
    return this.scheduleService.getBlocksForDayUser(this.day().id, userId);
  }

  private getOccupied(userId: string, excludeBlockId?: string): Set<number> {
    const blocks = this.getPlayerBlocks(userId);
    const occupied = new Set<number>();
    for (const block of blocks) {
      if (block.id === excludeBlockId) continue;
      const span = SLOT_WEIGHT_UNITS[block.slot_weight];
      for (let s = 0; s < span; s++) occupied.add(block.slot_position + s);
    }
    return occupied;
  }

  getSlotItems(userId: string): SlotItem[] {
    const blocks = this.getPlayerBlocks(userId);
    const items: SlotItem[] = [];
    const dragging = this.draggingBlock();
    let i = 0;
    while (i < DAY_BUDGET) {
      const block = blocks.find(b => b.slot_position === i);
      if (block) {
        const span = SLOT_WEIGHT_UNITS[block.slot_weight];
        const isDragged = !!dragging && block.id === dragging.id;
        if (isDragged) {
          for (let s = 0; s < span; s++) items.push({ type: 'empty', slotIndex: i + s, span: 1 });
        } else {
          items.push({ type: 'block', block, slotIndex: i, span });
        }
        i += span;
      } else {
        items.push({ type: 'empty', slotIndex: i, span: 1 });
        i++;
      }
    }
    return items;
  }

  getContiguousEmpty(userId: string, fromSlot: number, excludeBlockId?: string): number {
    const occupied = this.getOccupied(userId, excludeBlockId);
    let count = 0;
    for (let i = fromSlot; i < DAY_BUDGET; i++) {
      if (occupied.has(i)) break;
      count++;
    }
    return count;
  }

  canDropAt(userId: string, slotIndex: number): boolean {
    if (this.isLocked()) return false;
    const block = this.draggingBlock();
    if (!block) return false;
    // A block (duty or training) can only move within its own owner's row.
    if (block.user_id !== userId) return false;
    const span = SLOT_WEIGHT_UNITS[block.slot_weight];
    if (this.getContiguousEmpty(userId, slotIndex, block.id) < span) return false;

    // A crew member can't run two different trainings in overlapping hours —
    // block drops that would put this training over another of the same crew.
    if (!block.is_mandatory && block.crew_member !== 'Independent') {
      const end = slotIndex + span;
      const clash = this.scheduleService.blocks().some(b =>
        b.id !== block.id &&
        b.day_id === this.day().id &&
        !b.is_mandatory &&
        b.crew_member === block.crew_member &&
        b.training_topic !== block.training_topic &&
        b.slot_position < end &&
        b.slot_position + SLOT_WEIGHT_UNITS[b.slot_weight] > slotIndex,
      );
      if (clash) return false;
    }
    return true;
  }

  /** Why a block can't be dropped at a slot — for an explanatory warning. */
  private dropReason(block: ScheduleBlock, userId: string, slotIndex: number): string {
    if (this.isLocked()) return 'The day is sealed — withdraw a seal before rearranging it.';
    if (block.user_id !== userId) return 'A block can only move within its own owner’s row.';
    const span = SLOT_WEIGHT_UNITS[block.slot_weight];
    if (this.getContiguousEmpty(userId, slotIndex, block.id) < span) {
      return `Not enough open hours here — that block needs ${span}.`;
    }
    if (!block.is_mandatory && block.crew_member !== 'Independent') {
      return `${block.crew_member} is already teaching another training at that hour.`;
    }
    return 'That move isn’t allowed here.';
  }

  // ----- drag -----
  onDragStart(event: DragEvent, block: ScheduleBlock) {
    if (this.isLocked()) {
      event.preventDefault();
      this.toast.warn('The day is sealed — withdraw a seal to make changes.');
      return;
    }
    if (block.is_mandatory) {
      // Only the DM repositions ship duties; players hand them off instead.
      if (!this.isDm()) {
        event.preventDefault();
        this.toast.warn('Ship duties are set by the DM — use “Request hand-off” to pass one on.');
        return;
      }
    } else if (!this.canEdit(block.user_id)) {
      event.preventDefault();
      this.toast.warn('You can only move blocks on your own schedule.');
      return;
    }
    this.draggingBlock.set(block);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  }
  onDragEnd() { this.draggingBlock.set(null); this.dragOverSlot.set(null); }
  onDragOver(event: DragEvent, userId: string, slotIndex: number) {
    if (!this.canDropAt(userId, slotIndex)) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    this.dragOverSlot.set(slotIndex);
  }
  onDragLeave(slotIndex: number) {
    if (this.dragOverSlot() === slotIndex) this.dragOverSlot.set(null);
  }
  async onDrop(event: DragEvent, userId: string, slotIndex: number) {
    event.preventDefault();
    const block = this.draggingBlock();
    if (!block) return;
    if (!this.canDropAt(userId, slotIndex)) {
      this.toast.warn(this.dropReason(block, userId, slotIndex));
      this.draggingBlock.set(null);
      this.dragOverSlot.set(null);
      return;
    }
    this.draggingBlock.set(null);
    this.dragOverSlot.set(null);
    // Duties and trainings alike move individually within the owner's row.
    this.scheduleService.blocks.update(blocks =>
      blocks.map(b => b.id === block.id ? { ...b, slot_position: slotIndex } : b));
    await this.scheduleService.updateBlockPosition(block.id, slotIndex);
  }

  // ----- remove / add -----
  async onRemoveBlock(block: ScheduleBlock) {
    this.scheduleService.blocks.update(blocks => blocks.filter(b => b.id !== block.id));
    await this.scheduleService.removeBlock(block.id);
    await this.withdrawSealIfNeeded(block.user_id);
  }

  /** Empty-slot tap — open the planner, or explain why it's unavailable. */
  onEmptySlotClick(userId: string, atSlot: number) {
    if (this.isLocked()) {
      this.toast.warn('The day is sealed — withdraw a seal to change the schedule.');
      return;
    }
    if (!this.canEdit(userId)) {
      this.toast.warn('You can only edit your own schedule.');
      return;
    }
    this.openAddDialog(userId, atSlot);
  }

  openAddDialog(userId: string, atSlot: number) {
    if (!this.canEdit(userId)) return;
    const contiguous = this.getContiguousEmpty(userId, atSlot);
    if (contiguous <= 0) {
      this.toast.warn('No open hours here — clear a block to make room.');
      return;
    }

    const takenCrew = this.getPlayerBlocks(userId)
      .filter(b => !b.is_mandatory && b.crew_member !== 'Independent')
      .map(b => b.crew_member);

    const dialogRef = this.dialog.open(AddBlockDialogComponent, {
      width: '560px',
      maxWidth: '95vw',
      panelClass: 'hk-dialog',
      data: {
        dayId: this.day().id,
        remainingBudget: contiguous,
        forUserId: userId,
        correctionActive: this.isCorrected(userId),
        takenCrew,
      },
    });

    dialogRef.afterClosed().subscribe(async (result: AddBlockDialogResult | undefined) => {
      if (!result) return;
      const err = await this.scheduleService.addBlock(
        this.day().id, result.crewMember, result.trainingTopic, result.slotWeight, userId, atSlot,
        result.sessionNumber ?? null,
      );
      if (!err) {
        await this.withdrawSealIfNeeded(userId);
        this.toast.show(`Scheduled — ${result.trainingTopic} with ${result.crewMember}`);
      } else {
        this.toast.warn(err);
      }
    });
  }

  // ----- duty hand-off (feature #2) -----
  /** True when the current player holds this duty and can request a hand-off. */
  canHandOff(block: ScheduleBlock): boolean {
    return block.is_mandatory && !this.isLocked() && block.user_id === this.currentUserId();
  }
  /** A duty currently carried by someone other than its original owner. */
  isCovered(block: ScheduleBlock): boolean {
    return !!block.covered_by && block.covered_by !== block.user_id;
  }
  coveredByName(block: ScheduleBlock): string {
    const u = this.users().find(x => x.id === block.covered_by);
    return u?.character_name?.split(' ')[0] ?? 'a crewmate';
  }

  /** Open the request picker so the holder can ask a crewmate to take it. */
  requestHandOff(block: ScheduleBlock) {
    this.requests.startCompose(block);
  }

  // ----- spotlight (feature #4) -----
  canFlag(block: ScheduleBlock): boolean {
    return !block.is_mandatory && block.crew_member !== 'Independent'
      && block.user_id === this.currentUserId() && !this.isLocked();
  }
  async onToggleSpotlight(block: ScheduleBlock) {
    await this.scheduleService.toggleSpotlight(block.id, !block.spotlight);
    this.toast.show(block.spotlight ? 'Spotlight flag removed' : 'Flagged for the table');
  }

  // ----- DM click-to-mark outcome -----
  isTraining(block: ScheduleBlock): boolean {
    return !block.is_mandatory && block.crew_member !== 'Independent';
  }
  progressLabel(block: ScheduleBlock): string {
    const p = this.tracker.getProgress(block.user_id, block.crew_member, block.training_topic);
    if (!p) return '';
    const shown = p.completed ? p.threshold_pp : p.pp_accumulated;
    return `${shown}/${p.threshold_pp} PP`;
  }

  /**
   * Short label for a training block's session. The DM sees the roll
   * ("S2 · Insight"); players only see which session it is.
   */
  sessionTag(block: ScheduleBlock): string {
    const s = this.sessionFor(block);
    if (!s) return '';
    return this.isDm() ? `S${s.session_number} · ${s.roll_type}` : `Session ${s.session_number}`;
  }

  /** The prescribed session this block represents, if known. */
  private sessionFor(block: ScheduleBlock): TrainingSession | undefined {
    if (!block.session_number) return undefined;
    return this.trainingService.getTraining(block.crew_member, block.training_topic)
      ?.sessions.find(s => s.session_number === block.session_number);
  }
  /** PP this block grants on success / failure (session-specific, else by length). */
  private sessionPp(block: ScheduleBlock): { success: number; fail: number } {
    const session = this.sessionFor(block);
    if (session) return { success: session.pp_success, fail: session.pp_fail };
    const rule = SESSION_PP[block.slot_weight];
    return { success: rule.success, fail: rule.fail };
  }
  private thresholdFor(block: ScheduleBlock): number {
    return this.trainingService.getTraining(block.crew_member, block.training_topic)?.threshold_pp ?? 3;
  }

  private async resolve(block: ScheduleBlock, success: boolean) {
    const target = success ? 'success' : 'failure';
    if (block.status === target) return;

    const pp = this.sessionPp(block);
    const isShort = block.slot_weight === 'light';
    const threshold = this.thresholdFor(block);

    // Switching outcomes (or re-marking) — undo the prior score first.
    if (block.status === 'success' || block.status === 'failure') {
      await this.tracker.revertSession(block.user_id, block.crew_member, block.training_topic,
        { status: block.status, isShort, ppSuccess: pp.success, ppFail: pp.fail, threshold });
    }

    await this.scheduleService.updateBlockStatus(block.id, target);
    const res = await this.tracker.markSession(block.user_id, block.crew_member, block.training_topic,
      { isShort, success, ppSuccess: pp.success, ppFail: pp.fail, threshold });

    const gained = success ? pp.success : pp.fail;
    if (res.pity) {
      this.toast.show(`The lesson finally lands — ${block.training_topic} · UNLOCKED`);
    } else if (success) {
      this.toast.show(res.completed
        ? `Success +${gained} — ${block.training_topic} · UNLOCKED`
        : `Success +${gained} — ${block.training_topic} · ${res.pp}/${res.threshold} PP`);
    } else {
      this.toast.show(gained > 0
        ? `Failure +${gained} — ${block.training_topic} · ${res.pp}/${res.threshold} PP`
        : `Failure — ${block.training_topic} · no progress`);
    }
  }

  async markSuccess(block: ScheduleBlock) {
    await this.resolve(block, true);
  }
  async markFailure(block: ScheduleBlock) {
    await this.resolve(block, false);
  }
  async resetOutcome(block: ScheduleBlock) {
    if (block.status === 'success' || block.status === 'failure') {
      const pp = this.sessionPp(block);
      await this.tracker.revertSession(block.user_id, block.crew_member, block.training_topic, {
        status: block.status,
        isShort: block.slot_weight === 'light',
        ppSuccess: pp.success,
        ppFail: pp.fail,
        threshold: this.thresholdFor(block),
      });
    }
    await this.scheduleService.updateBlockStatus(block.id, 'pending');
    this.toast.show(`Reset to pending — ${block.training_topic}`);
  }

  // ----- mobile timeline helpers -----
  toggleExpanded(userId: string) {
    this.expanded.update(set => {
      const next = new Set(set);
      next.has(userId) ? next.delete(userId) : next.add(userId);
      return next;
    });
  }
  isExpanded(userId: string): boolean {
    return this.expanded().has(userId);
  }
  miniBar(userId: string): { color: string }[] {
    const blocks = this.getPlayerBlocks(userId);
    const segs: { color: string }[] = [];
    for (let i = 0; i < DAY_BUDGET; i++) {
      const b = blocks.find(x => x.slot_position <= i && i < x.slot_position + SLOT_WEIGHT_UNITS[x.slot_weight]);
      if (!b) segs.push({ color: '' });
      else if (b.is_mandatory) segs.push({ color: 'var(--accent-copper)' });
      else segs.push({ color: this.crewColor(b.crew_member) });
    }
    return segs;
  }

  // ----- helpers -----
  crewColor(name: string): string { return CREW_COLORS[name] ?? '#666'; }
  roman(i: number): string { return ROMAN[i] ?? `${i + 1}`; }
  lengthLabel(weight: ScheduleBlock['slot_weight']): string {
    return `${SLOT_WEIGHT_LABEL[weight]} · ${SLOT_WEIGHT_UNITS[weight]}`;
  }
  lengthClass(weight: ScheduleBlock['slot_weight']): string { return `wt-${weight}`; }
  isIndependent(block: ScheduleBlock): boolean { return block.crew_member === 'Independent'; }

  protected readonly tierNames = TIER_NAMES;
}
