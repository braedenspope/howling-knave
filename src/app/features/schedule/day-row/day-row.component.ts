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
import { Day, ScheduleBlock, DAY_BUDGET, SLOT_WEIGHT_UNITS, SLOT_WEIGHT_LABEL } from '../../../shared/models';

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
    return this.getContiguousEmpty(userId, slotIndex, block.id) >= span;
  }

  // ----- drag -----
  onDragStart(event: DragEvent, block: ScheduleBlock) {
    if (this.isLocked()) { event.preventDefault(); return; }
    if (block.is_mandatory) {
      // Only the DM repositions ship duties; players hand them off instead.
      if (!this.isDm()) { event.preventDefault(); return; }
    } else if (!this.canEdit(block.user_id)) {
      event.preventDefault(); return;
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
    if (!block || !this.canDropAt(userId, slotIndex)) return;
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

  openAddDialog(userId: string, atSlot: number) {
    if (!this.canEdit(userId)) return;
    const contiguous = this.getContiguousEmpty(userId, atSlot);
    if (contiguous <= 0) return;

    const dialogRef = this.dialog.open(AddBlockDialogComponent, {
      width: '560px',
      maxWidth: '95vw',
      panelClass: 'hk-dialog',
      data: {
        dayId: this.day().id,
        remainingBudget: contiguous,
        forUserId: userId,
        correctionActive: this.isCorrected(userId),
      },
    });

    dialogRef.afterClosed().subscribe(async (result: AddBlockDialogResult | undefined) => {
      if (!result) return;
      const err = await this.scheduleService.addBlock(
        this.day().id, result.crewMember, result.trainingTopic, result.slotWeight, userId, atSlot,
      );
      if (!err) {
        await this.withdrawSealIfNeeded(userId);
        this.toast.show(`Scheduled — ${result.trainingTopic} with ${result.crewMember}`);
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
    return p ? `${p.successes_accumulated}/${p.successes_required}` : '';
  }
  async markOutcome(block: ScheduleBlock, count: number) {
    const training = this.trainingService.getTrainingsForCrewByName(block.crew_member)
      .find(t => t.topic === block.training_topic);
    const required = training?.sessions_required ?? 3;
    await this.scheduleService.updateBlockStatus(block.id, 'success');
    await this.tracker.recordSuccess(block.user_id, block.crew_member, block.training_topic, count, required);
    const p = this.tracker.getProgress(block.user_id, block.crew_member, block.training_topic);
    const verb = count > 1 ? 'Critical +2' : 'Success +1';
    this.toast.show(p?.completed ? `${verb} — ${block.training_topic} · MASTERED`
      : `${verb} — ${block.training_topic}${p ? ' · ' + p.successes_accumulated + '/' + p.successes_required : ''}`);
  }
  async markFailure(block: ScheduleBlock) {
    await this.scheduleService.updateBlockStatus(block.id, 'failure');
    this.toast.show(`Failure logged — ${block.training_topic}`);
  }
  async resetOutcome(block: ScheduleBlock) {
    await this.scheduleService.updateBlockStatus(block.id, 'pending');
    await this.tracker.resetProgress(block.user_id, block.crew_member, block.training_topic);
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
