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
  template: `
    @for (day of voyageService.days(); track day.id) {
      <div class="day-section">
        <h3 class="gold-text day-label">Day {{ day.day_number }}</h3>

        @for (user of scheduleService.allUsers(); track user.id) {
          @if (getBlocksForDayUser(day.id, user.id).length > 0) {
            <div class="player-section">
              <span class="player-name">{{ user.character_name }}</span>
              <div class="blocks-list">
                @for (block of getBlocksForDayUser(day.id, user.id); track block.id) {
                  <div class="outcome-block" [style.border-left-color]="getCrewColor(block.crew_member)">
                    <div class="block-info">
                      <span class="crew">{{ block.crew_member }}</span>
                      <span class="topic">{{ block.training_topic }}</span>
                      <span class="weight-badge" [class]="'weight-' + block.slot_weight">
                        {{ block.slot_weight | uppercase }}
                      </span>
                      @if (getProgressLabel(block)) {
                        <span class="progress-label">{{ getProgressLabel(block) }}</span>
                      }
                      @if (isMastered(block)) {
                        <span class="mastered-badge">MASTERED</span>
                      }
                    </div>
                    <div class="outcome-actions">
                      <button mat-icon-button
                        matTooltip="+2 Double Success"
                        class="action-double"
                        (click)="markOutcome(block, 2)">
                        <mat-icon>star</mat-icon>
                      </button>
                      <button mat-icon-button
                        matTooltip="Success (+1)"
                        class="action-success"
                        (click)="markOutcome(block, 1)">
                        <mat-icon>check</mat-icon>
                      </button>
                      <button mat-icon-button
                        matTooltip="Failure"
                        class="action-failure"
                        (click)="markFailure(block)">
                        <mat-icon>close</mat-icon>
                      </button>
                      <button mat-icon-button
                        matTooltip="Reset to Pending"
                        class="action-reset"
                        (click)="resetBlock(block)">
                        <mat-icon>refresh</mat-icon>
                      </button>
                    </div>
                  </div>
                }
              </div>
            </div>
          }
        }
      </div>
    }
  `,
  styles: [`
    .day-section {
      margin-bottom: 24px;
    }

    .day-label {
      margin: 0 0 8px;
      font-family: var(--font-heading);
      font-size: 16px;
      letter-spacing: 1px;
    }

    .player-section {
      margin-bottom: 12px;
      padding-left: 12px;
    }

    .player-name {
      display: block;
      font-family: var(--font-heading);
      font-size: 12px;
      font-weight: 600;
      color: var(--text-secondary);
      margin-bottom: 4px;
      letter-spacing: 0.5px;
    }

    .blocks-list {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .outcome-block {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 12px;
      background: rgba(36,28,20,0.4);
      border-left: 3px solid #5a5040;
      border-radius: 2px;
      gap: 8px;
      flex-wrap: wrap;
      position: relative;

      &::before {
        content: '';
        position: absolute;
        top: 4px;
        left: -7px;
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: radial-gradient(circle at 40% 40%, #d4956a, #b87333);
        box-shadow: 0 1px 2px rgba(0,0,0,0.4);
      }
    }

    .block-info {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
      flex: 1;
      min-width: 0;
    }

    .crew {
      font-family: var(--font-body);
      font-size: 12px;
      color: var(--text-secondary);
      font-style: italic;
    }

    .topic {
      font-family: var(--font-heading);
      font-size: 13px;
      font-weight: 600;
      letter-spacing: 0.3px;
    }

    .weight-badge {
      font-family: var(--font-data);
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 0.5px;
      padding: 1px 6px;
      border-radius: 2px;

      &.weight-heavy { background: rgba(166,61,47,0.2); color: #c45a4a; }
      &.weight-medium { background: rgba(184,115,51,0.2); color: var(--accent-copper); }
      &.weight-light { background: rgba(90,138,74,0.2); color: #6a9a5a; }
    }

    .progress-label {
      font-family: var(--font-data);
      font-size: 11px;
      color: var(--text-secondary);
    }

    .mastered-badge {
      font-family: var(--font-data);
      font-size: 9px;
      font-weight: 700;
      padding: 1px 6px;
      border-radius: 2px;
      background: rgba(90,138,74,0.2);
      color: var(--success-green);
    }

    .outcome-actions {
      display: flex;
      gap: 2px;
      flex-shrink: 0;
    }

    .action-double mat-icon { color: var(--accent-gold); }
    .action-success mat-icon { color: var(--success-green); }
    .action-failure mat-icon { color: var(--failure-red); }
    .action-reset mat-icon { color: var(--text-secondary); }
  `],
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
