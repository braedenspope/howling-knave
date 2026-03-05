import { Component, OnInit, signal } from '@angular/core';
import { UpperCasePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { TrainingService } from '../training.service';
import { CREW_COLORS } from '../../../shared/data/training.data';
import { CrewMember, SlotWeight, TrainingWithCrew } from '../../../shared/models';

interface TrainingForm {
  topic: string;
  description: string;
  reward: string;
  slot_weight: SlotWeight;
  sessions_required: number;
  tier_required: number;
}

@Component({
  selector: 'app-training-editor',
  standalone: true,
  imports: [
    UpperCasePipe,
    FormsModule,
    MatExpansionModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatDividerModule,
  ],
  template: `
    <mat-accordion multi>
      @for (crew of trainingService.crewMembers(); track crew.id) {
        <mat-expansion-panel>
          <mat-expansion-panel-header>
            <mat-panel-title>
              <span class="crew-dot" [style.background]="getCrewColor(crew.name)"></span>
              {{ crew.name }}
              <span class="crew-role">({{ crew.role }})</span>
            </mat-panel-title>
          </mat-expansion-panel-header>

          <div class="trainings-list">
            @for (training of trainingService.getTrainingsForCrew(crew.id); track training.id) {
              @if (editingId() === training.id) {
                <div class="training-form">
                  <div class="form-grid">
                    <mat-form-field appearance="outline">
                      <mat-label>Topic</mat-label>
                      <input matInput [(ngModel)]="editForm.topic" />
                    </mat-form-field>

                    <mat-form-field appearance="outline">
                      <mat-label>Weight</mat-label>
                      <mat-select [(ngModel)]="editForm.slot_weight">
                        <mat-option value="heavy">Heavy</mat-option>
                        <mat-option value="medium">Medium</mat-option>
                        <mat-option value="light">Light</mat-option>
                      </mat-select>
                    </mat-form-field>

                    <mat-form-field appearance="outline">
                      <mat-label>Sessions (1–5)</mat-label>
                      <input matInput type="number" [(ngModel)]="editForm.sessions_required" min="1" max="5" />
                    </mat-form-field>

                    <mat-form-field appearance="outline">
                      <mat-label>Tier Required (1–5)</mat-label>
                      <input matInput type="number" [(ngModel)]="editForm.tier_required" min="1" max="5" />
                    </mat-form-field>

                    <mat-form-field appearance="outline" class="full-span">
                      <mat-label>Description</mat-label>
                      <textarea matInput rows="2" [(ngModel)]="editForm.description"></textarea>
                    </mat-form-field>

                    <mat-form-field appearance="outline" class="full-span">
                      <mat-label>Reward</mat-label>
                      <textarea matInput rows="2" [(ngModel)]="editForm.reward"></textarea>
                    </mat-form-field>
                  </div>
                  <div class="form-actions">
                    <button mat-button (click)="cancelEdit()">Cancel</button>
                    <button mat-raised-button color="primary" (click)="saveEdit(training.id)">Save</button>
                    <button mat-button color="warn" (click)="deleteTraining(training.id)">Delete</button>
                  </div>
                </div>
              } @else {
                <div class="training-item">
                  <div class="training-info">
                    <span class="training-topic">{{ training.topic }}</span>
                    <span class="badge tier-badge">Tier {{ training.tier_required }}</span>
                    <span class="badge" [class]="'weight-' + training.slot_weight">
                      {{ training.slot_weight | uppercase }}
                    </span>
                    <span class="badge sessions-badge">{{ training.sessions_required }}s</span>
                  </div>
                  <p class="training-desc">{{ training.description }}</p>
                  <p class="training-reward">Reward: {{ training.reward }}</p>
                  <button mat-icon-button (click)="startEdit(training)">
                    <mat-icon>edit</mat-icon>
                  </button>
                </div>
              }
            }

            @if (addingForCrew() === crew.id) {
              <div class="training-form">
                <div class="form-grid">
                  <mat-form-field appearance="outline">
                    <mat-label>Topic</mat-label>
                    <input matInput [(ngModel)]="addForm.topic" />
                  </mat-form-field>

                  <mat-form-field appearance="outline">
                    <mat-label>Weight</mat-label>
                    <mat-select [(ngModel)]="addForm.slot_weight">
                      <mat-option value="heavy">Heavy</mat-option>
                      <mat-option value="medium">Medium</mat-option>
                      <mat-option value="light">Light</mat-option>
                    </mat-select>
                  </mat-form-field>

                  <mat-form-field appearance="outline">
                    <mat-label>Sessions (1–5)</mat-label>
                    <input matInput type="number" [(ngModel)]="addForm.sessions_required" min="1" max="5" />
                  </mat-form-field>

                  <mat-form-field appearance="outline">
                    <mat-label>Tier Required (1–5)</mat-label>
                    <input matInput type="number" [(ngModel)]="addForm.tier_required" min="1" max="5" />
                  </mat-form-field>

                  <mat-form-field appearance="outline" class="full-span">
                    <mat-label>Description</mat-label>
                    <textarea matInput rows="2" [(ngModel)]="addForm.description"></textarea>
                  </mat-form-field>

                  <mat-form-field appearance="outline" class="full-span">
                    <mat-label>Reward</mat-label>
                    <textarea matInput rows="2" [(ngModel)]="addForm.reward"></textarea>
                  </mat-form-field>
                </div>
                <div class="form-actions">
                  <button mat-button (click)="cancelAdd()">Cancel</button>
                  <button mat-raised-button color="primary" (click)="saveNewTraining(crew.id)">Add</button>
                </div>
              </div>
            } @else {
              <button mat-stroked-button (click)="startAdd(crew.id)" class="add-training-btn">
                <mat-icon>add</mat-icon> Add Training
              </button>
            }
          </div>
        </mat-expansion-panel>
      }
    </mat-accordion>
  `,
  styles: [`
    .crew-dot {
      display: inline-block;
      width: 10px;
      height: 10px;
      border-radius: 50%;
      margin-right: 8px;
    }

    .crew-role {
      font-family: var(--font-body);
      font-size: 12px;
      color: var(--text-secondary);
      margin-left: 8px;
      font-style: italic;
    }

    .trainings-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .training-item {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-start;
      gap: 8px;
      padding: 10px;
      background: rgba(36,28,20,0.4);
      border-radius: 2px;
      position: relative;

      button {
        position: absolute;
        top: 4px;
        right: 4px;
      }
    }

    .training-info {
      display: flex;
      align-items: center;
      gap: 6px;
      width: 100%;
    }

    .training-topic {
      font-family: var(--font-heading);
      font-weight: 600;
      font-size: 13px;
      letter-spacing: 0.3px;
    }

    .badge {
      font-family: var(--font-data);
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 0.5px;
      padding: 1px 6px;
      border-radius: 2px;
    }

    .tier-badge {
      background: rgba(107,58,139,0.2);
      color: #9a7ab8;
    }

    .sessions-badge {
      background: rgba(255, 255, 255, 0.08);
      color: var(--text-secondary);
    }

    .weight-heavy { background: rgba(166,61,47,0.2); color: #c45a4a; }
    .weight-medium { background: rgba(184,115,51,0.2); color: var(--accent-copper); }
    .weight-light { background: rgba(90,138,74,0.2); color: #6a9a5a; }

    .training-desc, .training-reward {
      font-size: 12px;
      color: var(--text-secondary);
      margin: 2px 0;
      width: 100%;
      font-style: italic;
    }

    .training-form {
      padding: 12px;
      background: rgba(36,28,20,0.3);
      border: 1px solid var(--bg-card-border);
      border-radius: 2px;
    }

    .form-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px 12px;

      .full-span {
        grid-column: 1 / -1;
      }
    }

    .form-actions {
      display: flex;
      gap: 8px;
      justify-content: flex-end;
      margin-top: 8px;
    }

    .add-training-btn {
      margin-top: 8px;
    }

    @media (max-width: 600px) {
      .form-grid {
        grid-template-columns: 1fr;
      }
    }
  `],
})
export class TrainingEditorComponent implements OnInit {
  editingId = signal<string | null>(null);
  addingForCrew = signal<number | null>(null);

  editForm: TrainingForm = this.emptyForm();
  addForm: TrainingForm = this.emptyForm();

  constructor(public trainingService: TrainingService) {}

  async ngOnInit() {
    await this.trainingService.loadCrewMembers();
    await this.trainingService.loadTrainings();
  }

  getCrewColor(name: string): string {
    return CREW_COLORS[name] ?? '#666';
  }

  private emptyForm(): TrainingForm {
    return {
      topic: '',
      description: '',
      reward: '',
      slot_weight: 'medium',
      sessions_required: 3,
      tier_required: 1,
    };
  }

  startEdit(training: TrainingWithCrew) {
    this.editingId.set(training.id);
    this.editForm = {
      topic: training.topic,
      description: training.description,
      reward: training.reward,
      slot_weight: training.slot_weight,
      sessions_required: training.sessions_required,
      tier_required: training.tier_required,
    };
  }

  cancelEdit() {
    this.editingId.set(null);
  }

  async saveEdit(id: string) {
    await this.trainingService.updateTraining(id, this.editForm);
    this.editingId.set(null);
  }

  async deleteTraining(id: string) {
    await this.trainingService.deleteTraining(id);
    this.editingId.set(null);
  }

  startAdd(crewId: number) {
    this.addingForCrew.set(crewId);
    this.addForm = this.emptyForm();
  }

  cancelAdd() {
    this.addingForCrew.set(null);
  }

  async saveNewTraining(crewMemberId: number) {
    await this.trainingService.createTraining({
      crew_member_id: crewMemberId,
      ...this.addForm,
    });
    this.addingForCrew.set(null);
  }
}
