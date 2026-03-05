import { Component, signal } from '@angular/core';
import { UpperCasePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { VoyageService } from '../../voyage/voyage.service';
import { ScheduleService } from '../../schedule/schedule.service';
import { CREW_LIST, CREW_COLORS } from '../../../shared/data/training.data';
import { MandatoryDuty, SlotWeight } from '../../../shared/models';

@Component({
  selector: 'app-duty-injector',
  standalone: true,
  imports: [
    UpperCasePipe,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
  ],
  template: `
    @for (day of voyageService.days(); track day.id) {
      <div class="duty-day-section">
        <h3 class="gold-text">Day {{ day.day_number }}</h3>

        @if (day.mandatory_duty) {
          <div class="current-duty">
            <span class="duty-label">
              <mat-icon>warning</mat-icon>
              {{ day.mandatory_duty.crew_member }} — {{ day.mandatory_duty.task_description }}
              ({{ day.mandatory_duty.slot_weight | uppercase }})
            </span>
            <button mat-icon-button (click)="clearDuty(day.id)" color="warn">
              <mat-icon>close</mat-icon>
            </button>
          </div>
        }

        @if (editingDay() === day.id) {
          <mat-card class="duty-form">
            <div class="form-grid">
              <mat-form-field appearance="outline">
                <mat-label>Crew Member</mat-label>
                <mat-select [(ngModel)]="dutyCrew">
                  @for (crew of crewList; track crew) {
                    <mat-option [value]="crew">{{ crew }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Task Description</mat-label>
                <input matInput [(ngModel)]="dutyDescription" />
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Slot Weight</mat-label>
                <mat-select [(ngModel)]="dutyWeight">
                  <mat-option value="heavy">Heavy</mat-option>
                  <mat-option value="medium">Medium</mat-option>
                  <mat-option value="light">Light</mat-option>
                </mat-select>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Consequence Type</mat-label>
                <mat-select [(ngModel)]="dutyConsequenceType">
                  <mat-option value="crew">Crew</mat-option>
                  <mat-option value="ship">Ship</mat-option>
                  <mat-option value="both">Both</mat-option>
                </mat-select>
              </mat-form-field>

              <mat-form-field appearance="outline" class="full-span">
                <mat-label>Consequence Description</mat-label>
                <textarea matInput rows="2" [(ngModel)]="dutyConsequenceDesc"></textarea>
              </mat-form-field>
            </div>
            <div class="form-actions">
              <button mat-button (click)="editingDay.set(null)">Cancel</button>
              <button mat-stroked-button (click)="setDuty(day.id)">Set Duty</button>
              <button mat-raised-button color="primary" (click)="setDutyAndPush(day.id)">
                Set &amp; Push to Rows
              </button>
            </div>
          </mat-card>
        } @else {
          <button mat-stroked-button (click)="startEdit(day.id)">
            {{ day.mandatory_duty ? 'Replace Duty' : 'Add Duty' }}
          </button>
        }
      </div>
    }
  `,
  styles: [`
    .duty-day-section {
      margin-bottom: 24px;

      h3 {
        font-family: var(--font-heading);
        letter-spacing: 1px;
      }
    }

    .current-duty {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      background: rgba(184,115,51,0.1);
      border-radius: 2px;
      border-left: 3px solid var(--accent-copper);
      margin-bottom: 8px;
    }

    .duty-label {
      display: flex;
      align-items: center;
      gap: 6px;
      flex: 1;
      font-family: var(--font-body);
      font-size: 14px;
      color: var(--accent-copper);

      mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
      }
    }

    .duty-form {
      padding: 16px;
      margin-top: 8px;
      border-radius: 2px !important;
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

    @media (max-width: 600px) {
      .form-grid {
        grid-template-columns: 1fr;
      }
    }
  `],
})
export class DutyInjectorComponent {
  crewList = CREW_LIST;
  editingDay = signal<string | null>(null);

  dutyCrew = '';
  dutyDescription = '';
  dutyWeight: SlotWeight = 'medium';
  dutyConsequenceType: 'crew' | 'ship' | 'both' = 'crew';
  dutyConsequenceDesc = '';

  constructor(
    public voyageService: VoyageService,
    private scheduleService: ScheduleService,
  ) {}

  startEdit(dayId: string) {
    this.editingDay.set(dayId);
    this.dutyCrew = '';
    this.dutyDescription = '';
    this.dutyWeight = 'medium';
    this.dutyConsequenceType = 'crew';
    this.dutyConsequenceDesc = '';
  }

  private buildDuty(): MandatoryDuty {
    return {
      crew_member: this.dutyCrew,
      task_description: this.dutyDescription,
      slot_weight: this.dutyWeight,
      consequence_type: this.dutyConsequenceType,
      consequence_description: this.dutyConsequenceDesc,
    };
  }

  async setDuty(dayId: string) {
    const duty = this.buildDuty();
    await this.voyageService.updateDayDuty(dayId, duty);
    this.editingDay.set(null);
  }

  async setDutyAndPush(dayId: string) {
    const duty = this.buildDuty();
    await this.voyageService.updateDayDuty(dayId, duty);

    // Push locked mandatory block to every player's row
    const allUsers = this.scheduleService.allUsers();
    for (const user of allUsers) {
      await this.scheduleService.insertMandatoryBlock(
        dayId,
        user.id,
        duty.crew_member,
        duty.task_description,
        duty.slot_weight,
      );
    }

    this.editingDay.set(null);
  }

  async clearDuty(dayId: string) {
    await this.voyageService.updateDayDuty(dayId, null);
  }
}
