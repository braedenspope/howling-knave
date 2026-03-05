import { Component, OnInit, computed } from '@angular/core';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { TrainingTrackerService } from '../../dm/training-tracker.service';
import { AuthService } from '../../../core/auth/auth.service';
import { CREW_COLORS } from '../../../shared/data/training.data';
import { TrainingProgress } from '../../../shared/models';

@Component({
  selector: 'app-player-progress',
  standalone: true,
  imports: [MatExpansionModule, MatCardModule, MatIconModule],
  template: `
    <div class="progress-container">
      <h1 class="gold-text">My Training Progress</h1>

      <div class="summary-bar">
        <div class="summary-item">
          <span class="summary-value">{{ masteredCount() }}</span>
          <span class="summary-label">Mastered</span>
        </div>
        <div class="summary-item">
          <span class="summary-value">{{ inProgressCount() }}</span>
          <span class="summary-label">In Progress</span>
        </div>
        <div class="summary-item">
          <span class="summary-value">{{ totalCount() }}</span>
          <span class="summary-label">Total Trained</span>
        </div>
      </div>

      @if (groupedProgress().length === 0) {
        <div class="empty-state">
          <mat-icon>school</mat-icon>
          <p>You haven't started any training yet. Head to the board and begin!</p>
        </div>
      } @else {
        <mat-accordion multi>
          @for (group of groupedProgress(); track group.crewMember) {
            <mat-expansion-panel>
              <mat-expansion-panel-header>
                <mat-panel-title>
                  <span class="crew-dot" [style.background]="getCrewColor(group.crewMember)"></span>
                  {{ group.crewMember }}
                </mat-panel-title>
                <mat-panel-description>
                  {{ group.trainings.length }} training{{ group.trainings.length > 1 ? 's' : '' }}
                </mat-panel-description>
              </mat-expansion-panel-header>

              <div class="training-list">
                @for (training of group.trainings; track training.training_topic) {
                  <div class="training-row">
                    <div class="training-info">
                      <span class="topic-name">{{ training.training_topic }}</span>
                      @if (training.completed) {
                        <span class="mastered-badge">MASTERED</span>
                      }
                    </div>
                    <div class="pip-row">
                      @for (pip of getPips(training); track $index) {
                        <div
                          class="pip"
                          [class.filled]="pip.filled"
                          [class.mastered]="training.completed"
                        ></div>
                      }
                      <span class="fraction">
                        {{ training.successes_accumulated }}/{{ training.successes_required }}
                      </span>
                    </div>
                  </div>
                }
              </div>
            </mat-expansion-panel>
          }
        </mat-accordion>
      }
    </div>
  `,
  styles: [`
    .progress-container {
      max-width: 800px;
      margin: 0 auto;
      padding: 16px;
    }

    h1 {
      margin: 0 0 16px;
      font-size: 24px;
    }

    .summary-bar {
      display: flex;
      gap: 24px;
      margin-bottom: 24px;
      padding: 16px;
      background: var(--bg-card);
      border: 1px solid var(--bg-card-border);
      border-radius: 8px;
    }

    .summary-item {
      display: flex;
      flex-direction: column;
      align-items: center;
    }

    .summary-value {
      font-size: 28px;
      font-weight: 700;
      color: var(--accent-gold);
    }

    .summary-label {
      font-size: 12px;
      color: var(--text-secondary);
    }

    .empty-state {
      text-align: center;
      padding: 48px 16px;
      color: var(--text-secondary);

      mat-icon {
        font-size: 48px;
        width: 48px;
        height: 48px;
        margin-bottom: 12px;
      }
    }

    .crew-dot {
      display: inline-block;
      width: 10px;
      height: 10px;
      border-radius: 50%;
      margin-right: 8px;
    }

    .training-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .training-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 0;
      border-bottom: 1px solid var(--bg-card-border);

      &:last-child {
        border-bottom: none;
      }
    }

    .training-info {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .topic-name {
      font-weight: 500;
    }

    .mastered-badge {
      font-size: 9px;
      font-weight: 700;
      padding: 1px 6px;
      border-radius: 3px;
      background: rgba(46, 204, 64, 0.2);
      color: var(--success-green);
    }

    .pip-row {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .pip {
      width: 16px;
      height: 10px;
      border-radius: 3px;
      background: #333;
      transition: background 0.2s;

      &.filled {
        background: var(--accent-gold);
      }

      &.mastered {
        background: var(--success-green);
      }
    }

    .fraction {
      font-size: 12px;
      color: var(--text-secondary);
      margin-left: 4px;
    }
  `],
})
export class PlayerProgressComponent implements OnInit {
  constructor(
    private tracker: TrainingTrackerService,
    private auth: AuthService,
  ) {}

  async ngOnInit() {
    const userId = this.auth.userId();
    if (userId) {
      await this.tracker.loadProgressForUser(userId);
    }
  }

  private myProgress() {
    const userId = this.auth.userId();
    return userId ? this.tracker.getProgressForUser(userId) : [];
  }

  masteredCount = computed(() => this.myProgress().filter(p => p.completed).length);
  inProgressCount = computed(() => this.myProgress().filter(p => !p.completed && p.successes_accumulated > 0).length);
  totalCount = computed(() => this.myProgress().length);

  groupedProgress = computed(() => {
    const progress = this.myProgress();
    const groups: Record<string, TrainingProgress[]> = {};
    for (const p of progress) {
      if (!groups[p.crew_member]) groups[p.crew_member] = [];
      groups[p.crew_member].push(p);
    }
    return Object.entries(groups)
      .map(([crewMember, trainings]) => ({ crewMember, trainings }))
      .sort((a, b) => a.crewMember.localeCompare(b.crewMember));
  });

  getCrewColor(name: string): string {
    return CREW_COLORS[name] ?? '#666';
  }

  getPips(training: TrainingProgress) {
    return Array.from({ length: training.successes_required }, (_, i) => ({
      filled: i < training.successes_accumulated,
    }));
  }
}
