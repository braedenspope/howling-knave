import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { UpperCasePipe } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { FormsModule } from '@angular/forms';
import { TrainingService } from '../../dm/training.service';
import { RelationshipService } from '../../dm/relationship.service';
import { AuthService } from '../../../core/auth/auth.service';
import { CREW_LIST, CREW_COLORS } from '../../../shared/data/training.data';
import { TrainingWithCrew, SLOT_WEIGHT_UNITS } from '../../../shared/models';

export interface AddBlockDialogData {
  dayId: string;
  remainingBudget: number;
}

export interface AddBlockDialogResult {
  crewMember: string;
  trainingTopic: string;
  slotWeight: 'heavy' | 'medium' | 'light';
}

@Component({
  selector: 'app-add-block-dialog',
  standalone: true,
  imports: [
    UpperCasePipe,
    MatDialogModule,
    MatFormFieldModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    FormsModule,
  ],
  template: `
    <h2 mat-dialog-title class="gold-text">Add Training Block</h2>
    <mat-dialog-content>
      <p class="budget-info">Remaining budget: {{ data.remainingBudget }} units</p>

      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Crew Member</mat-label>
        <mat-select [(ngModel)]="selectedCrew" (ngModelChange)="onCrewChange()">
          @for (crew of crewList; track crew) {
            <mat-option [value]="crew">
              <span class="crew-dot" [style.background]="getCrewColor(crew)"></span>
              {{ crew }}
            </mat-option>
          }
        </mat-select>
      </mat-form-field>

      @if (selectedCrew) {
        <div class="training-options">
          @for (training of availableTrainings(); track training.id) {
            <div
              class="training-option"
              [class.disabled]="!training.affordable || !training.available"
              [class.selected]="selectedTraining()?.id === training.id"
              (click)="selectTraining(training)"
              [style.border-left-color]="getCrewColor(selectedCrew)"
            >
              <div class="training-header">
                <span class="training-topic">{{ training.topic }}</span>
                <span class="weight-badge" [class]="'weight-' + training.slot_weight">
                  {{ training.slot_weight | uppercase }}
                </span>
              </div>
              <p class="training-desc">{{ training.description }}</p>
              <div class="training-meta">
                <span class="reward">{{ training.reward }}</span>
                <span class="sessions">{{ training.sessions_required }} session{{ training.sessions_required > 1 ? 's' : '' }}</span>
              </div>
              @if (!training.available) {
                <span class="lock-reason">Requires higher relationship tier</span>
              } @else if (!training.affordable) {
                <span class="lock-reason">Not enough budget ({{ getCost(training.slot_weight) }} units)</span>
              }
            </div>
          } @empty {
            <p class="empty-state">No trainings available for this crew member.</p>
          }
        </div>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button
        mat-raised-button
        color="primary"
        [disabled]="!selectedTraining()"
        (click)="confirm()"
      >
        Add Block
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .full-width { width: 100%; }

    .budget-info {
      color: var(--accent-gold);
      margin-bottom: 16px;
      font-size: 14px;
    }

    .crew-dot {
      display: inline-block;
      width: 10px;
      height: 10px;
      border-radius: 50%;
      margin-right: 8px;
      vertical-align: middle;
    }

    .training-options {
      display: flex;
      flex-direction: column;
      gap: 8px;
      max-height: 400px;
      overflow-y: auto;
    }

    .training-option {
      padding: 10px 12px;
      border-left: 3px solid #666;
      border-radius: 4px;
      background: rgba(255, 255, 255, 0.03);
      cursor: pointer;
      transition: background 0.15s;

      &:hover:not(.disabled) {
        background: rgba(255, 255, 255, 0.07);
      }

      &.selected {
        background: rgba(232, 213, 163, 0.1);
        outline: 1px solid var(--accent-gold);
      }

      &.disabled {
        opacity: 0.4;
        cursor: not-allowed;
      }
    }

    .training-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 4px;
    }

    .training-topic {
      font-weight: 500;
      font-size: 14px;
    }

    .weight-badge {
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 0.5px;
      padding: 1px 6px;
      border-radius: 3px;

      &.weight-heavy { background: rgba(230, 57, 70, 0.2); color: #e63946; }
      &.weight-medium { background: rgba(247, 127, 0, 0.2); color: #f77f00; }
      &.weight-light { background: rgba(46, 204, 64, 0.2); color: #2ecc40; }
    }

    .training-desc {
      font-size: 12px;
      color: var(--text-secondary);
      margin: 4px 0;
    }

    .training-meta {
      display: flex;
      justify-content: space-between;
      font-size: 11px;
      color: var(--text-secondary);
    }

    .lock-reason {
      display: block;
      font-size: 11px;
      color: var(--failure-red);
      margin-top: 4px;
    }

    .empty-state {
      color: var(--text-secondary);
      text-align: center;
      padding: 24px 0;
    }
  `],
})
export class AddBlockDialogComponent implements OnInit {
  data = inject<AddBlockDialogData>(MAT_DIALOG_DATA);
  private dialogRef = inject(MatDialogRef<AddBlockDialogComponent>);
  private trainingService = inject(TrainingService);
  private relationshipService = inject(RelationshipService);
  private auth = inject(AuthService);

  crewList = CREW_LIST;
  selectedCrew = '';
  selectedTraining = signal<(TrainingWithCrew & { available: boolean; affordable: boolean }) | null>(null);

  availableTrainings = signal<(TrainingWithCrew & { available: boolean; affordable: boolean })[]>([]);

  ngOnInit() {
    // Load relationship tiers for current user
    const userId = this.auth.userId();
    if (userId) {
      this.relationshipService.loadTiers(userId);
    }
  }

  getCrewColor(name: string): string {
    return CREW_COLORS[name] ?? '#666';
  }

  getCost(weight: string): number {
    return SLOT_WEIGHT_UNITS[weight as keyof typeof SLOT_WEIGHT_UNITS] ?? 0;
  }

  onCrewChange() {
    this.selectedTraining.set(null);
    const userId = this.auth.userId();
    if (!userId || !this.selectedCrew) {
      this.availableTrainings.set([]);
      return;
    }
    const tier = this.relationshipService.getTierForCrewMember(userId, this.selectedCrew);
    const options = this.trainingService.getAvailableTrainings(
      this.selectedCrew,
      tier,
      this.data.remainingBudget,
    );
    this.availableTrainings.set(options);
  }

  selectTraining(training: TrainingWithCrew & { available: boolean; affordable: boolean }) {
    if (!training.available || !training.affordable) return;
    this.selectedTraining.set(training);
  }

  confirm() {
    const t = this.selectedTraining();
    if (!t) return;
    const result: AddBlockDialogResult = {
      crewMember: this.selectedCrew,
      trainingTopic: t.topic,
      slotWeight: t.slot_weight,
    };
    this.dialogRef.close(result);
  }
}
