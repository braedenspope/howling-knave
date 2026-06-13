import { Component, OnInit } from '@angular/core';
import { ScheduleService } from '../../schedule/schedule.service';
import { VoyageService } from '../../voyage/voyage.service';
import { TrainingService } from '../training.service';
import { TrainingTrackerService } from '../training-tracker.service';
import { CREW_COLORS } from '../../../shared/data/training.data';
import { ScheduleBlock, Day, SLOT_WEIGHT_LABEL, SLOT_WEIGHT_UNITS, SlotWeight } from '../../../shared/models';
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
    return `${progress.successes_accumulated}/${progress.successes_required}`;
  }

  isMastered(block: ScheduleBlock): boolean {
    const progress = this.tracker.getProgress(block.user_id, block.crew_member, block.training_topic);
    return progress?.completed ?? false;
  }

  async markOutcome(block: ScheduleBlock, successCount: number) {
    // Find sessions_required from trainings
    const training = this.trainingService.getTrainingsForCrewByName(block.crew_member)
      .find(t => t.topic === block.training_topic);
    const sessionsRequired = training?.sessions_required ?? 3;

    await this.scheduleService.updateBlockStatus(block.id, 'success');
    await this.tracker.recordSuccess(
      block.user_id,
      block.crew_member,
      block.training_topic,
      successCount,
      sessionsRequired,
    );

    const progress = this.tracker.getProgress(block.user_id, block.crew_member, block.training_topic);
    const verb = successCount > 1 ? 'Critical +2' : 'Success +1';
    const tail = progress?.completed
      ? ` — ${block.training_topic} · MASTERED`
      : progress
        ? ` — ${block.training_topic} · ${progress.successes_accumulated}/${progress.successes_required}`
        : '';
    this.toast.show(`${verb}${tail}`);
  }

  async markFailure(block: ScheduleBlock) {
    await this.scheduleService.updateBlockStatus(block.id, 'failure');
    this.toast.show(`Failure logged — ${block.training_topic}`);
  }

  async resetBlock(block: ScheduleBlock) {
    await this.scheduleService.updateBlockStatus(block.id, 'pending');
    this.toast.show(`Reset to pending — ${block.training_topic}`);
  }
}
