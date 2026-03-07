import { Component, OnInit } from '@angular/core';
import { UpperCasePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';
import { ScheduleService } from '../../schedule/schedule.service';
import { VoyageService } from '../../voyage/voyage.service';
import { TrainingService } from '../training.service';
import { TrainingTrackerService } from '../training-tracker.service';
import { CREW_COLORS } from '../../../shared/data/training.data';
import { ScheduleBlock, Day } from '../../../shared/models';

@Component({
  selector: 'app-block-outcomes',
  standalone: true,
  imports: [UpperCasePipe, MatButtonModule, MatIconModule, MatTooltipModule, MatChipsModule],
  templateUrl: './block-outcomes.component.html',
  styleUrl: './block-outcomes.component.scss',
})
export class BlockOutcomesComponent implements OnInit {
  constructor(
    public voyageService: VoyageService,
    public scheduleService: ScheduleService,
    private trainingService: TrainingService,
    private tracker: TrainingTrackerService,
  ) {}

  async ngOnInit() {
    await this.tracker.loadAllProgress();
  }

  getBlocksForDayUser(dayId: string, userId: string): ScheduleBlock[] {
    return this.scheduleService.getBlocksForDayUser(dayId, userId);
  }

  getCrewColor(name: string): string {
    return CREW_COLORS[name] ?? '#666';
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
  }

  async markFailure(block: ScheduleBlock) {
    await this.scheduleService.updateBlockStatus(block.id, 'failure');
  }

  async resetBlock(block: ScheduleBlock) {
    await this.scheduleService.updateBlockStatus(block.id, 'pending');
  }
}
