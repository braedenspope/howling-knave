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
    const progress = this.tracker.getProgress(block.user_id, block.crew_member, block.training_topic);
    if (!progress) return '';
    return `${progress.pp_accumulated}/${progress.threshold_pp} PP`;
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
  private ppFor(block: ScheduleBlock, outcome: 'success' | 'failure'): number {
    const session = this.sessionFor(block);
    if (session) return outcome === 'success' ? session.pp_success : session.pp_fail;
    const rule = SESSION_PP[block.slot_weight];
    return outcome === 'success' ? rule.success : rule.fail;
  }
  private thresholdFor(block: ScheduleBlock): number {
    return this.trainingService.getTraining(block.crew_member, block.training_topic)?.threshold_pp ?? 3;
  }

  async markSuccess(block: ScheduleBlock) {
    const pp = this.ppFor(block, 'success');
    await this.scheduleService.updateBlockStatus(block.id, 'success');
    await this.tracker.applyPp(block.user_id, block.crew_member, block.training_topic, pp, this.thresholdFor(block));

    const progress = this.tracker.getProgress(block.user_id, block.crew_member, block.training_topic);
    const tail = progress?.completed
      ? ` — ${block.training_topic} · UNLOCKED`
      : progress
        ? ` — ${block.training_topic} · ${progress.pp_accumulated}/${progress.threshold_pp} PP`
        : '';
    this.toast.show(`Success +${pp}${tail}`);
  }

  async markFailure(block: ScheduleBlock) {
    const pp = this.ppFor(block, 'failure');
    await this.scheduleService.updateBlockStatus(block.id, 'failure');
    if (pp > 0) {
      await this.tracker.applyPp(block.user_id, block.crew_member, block.training_topic, pp, this.thresholdFor(block));
    }
    const progress = this.tracker.getProgress(block.user_id, block.crew_member, block.training_topic);
    this.toast.show(pp > 0
      ? `Failure +${pp} — ${block.training_topic}${progress ? ' · ' + progress.pp_accumulated + '/' + progress.threshold_pp + ' PP' : ''}`
      : `Failure — ${block.training_topic} · no progress`);
  }

  async resetBlock(block: ScheduleBlock) {
    const undo = block.status === 'success' ? -this.ppFor(block, 'success')
      : block.status === 'failure' ? -this.ppFor(block, 'failure')
      : 0;
    await this.scheduleService.updateBlockStatus(block.id, 'pending');
    if (undo !== 0) {
      await this.tracker.applyPp(block.user_id, block.crew_member, block.training_topic, undo, this.thresholdFor(block));
    }
    this.toast.show(`Reset to pending — ${block.training_topic}`);
  }
}
