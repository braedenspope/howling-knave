import { Component, OnInit } from '@angular/core';
import { ScheduleService } from '../../schedule/schedule.service';
import { VoyageService } from '../../voyage/voyage.service';
import { TrainingService } from '../training.service';
import { TrainingTrackerService } from '../training-tracker.service';
import { CREW_COLORS } from '../../../shared/data/training.data';
import { ScheduleBlock, Day, SLOT_WEIGHT_LABEL, SLOT_WEIGHT_UNITS, SlotWeight, SESSION_PP, TrainingSession } from '../../../shared/models';
import { ToastService } from '../../../shared/toast.service';

@Component({
  selector: 'app-block-outcomes',
  standalone: true,
  imports: [],
  templateUrl: './block-outcomes.component.html',
  styleUrl: './block-outcomes.component.scss',
})
export class BlockOutcomesComponent implements OnInit {
  constructor(
    public voyageService: VoyageService,
    public scheduleService: ScheduleService,
    private trainingService: TrainingService,
    private tracker: TrainingTrackerService,
    private toast: ToastService,
  ) {}

  async ngOnInit() {
    await Promise.all([
      this.tracker.loadAllProgress(),
      this.voyageService.loadVoyages(),
      this.scheduleService.loadAllUsers(),
    ]);
    const voyage = this.voyageService.activeVoyage();
    if (voyage) {
      await this.voyageService.loadDays(voyage.id);
      await this.scheduleService.loadBlocks(this.voyageService.days().map(d => d.id));
    }
  }

  getBlocksForDayUser(dayId: string, userId: string): ScheduleBlock[] {
    return this.scheduleService.getBlocksForDayUser(dayId, userId)
      .filter(b => !b.is_mandatory && b.crew_member !== 'Independent');
  }

  hasOutcomes(dayId: string): boolean {
    return this.scheduleService.allUsers().some(u => this.getBlocksForDayUser(dayId, u.id).length > 0);
  }

  getCrewColor(name: string): string {
    return CREW_COLORS[name] ?? '#666';
  }

  lengthLabel(weight: SlotWeight): string {
    return `${SLOT_WEIGHT_LABEL[weight]} · ${SLOT_WEIGHT_UNITS[weight]}`;
  }
  lengthClass(weight: SlotWeight): string {
    return `wt-${weight}`;
  }
  statusClass(block: ScheduleBlock): string {
    if (block.status === 'success') return 'outcome-success';
    if (block.status === 'failure') return 'outcome-failure';
    return 'outcome-pending';
  }
  statusLabel(block: ScheduleBlock): string {
    if (block.status === 'success') return 'Success';
    if (block.status === 'failure') return 'Failed';
    return 'Pending';
  }

  getProgressLabel(block: ScheduleBlock): string {
    const p = this.tracker.getProgress(block.user_id, block.crew_member, block.training_topic);
    if (!p) return '';
    const shown = p.completed ? p.threshold_pp : p.pp_accumulated;
    return `${shown}/${p.threshold_pp} PP`;
  }

  isMastered(block: ScheduleBlock): boolean {
    const progress = this.tracker.getProgress(block.user_id, block.crew_member, block.training_topic);
    return progress?.completed ?? false;
  }

  private sessionFor(block: ScheduleBlock): TrainingSession | undefined {
    if (!block.session_number) return undefined;
    return this.trainingService.getTraining(block.crew_member, block.training_topic)
      ?.sessions.find(s => s.session_number === block.session_number);
  }
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
  async resetBlock(block: ScheduleBlock) {
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
}
