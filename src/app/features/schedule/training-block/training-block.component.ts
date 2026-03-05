import { Component, input, output } from '@angular/core';
import { UpperCasePipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ScheduleBlock } from '../../../shared/models';
import { CREW_COLORS } from '../../../shared/data/training.data';

@Component({
  selector: 'app-training-block',
  standalone: true,
  imports: [UpperCasePipe, MatIconModule, MatTooltipModule],
  template: `
    <div
      class="training-block"
      [style.border-left-color]="crewColor()"
      [class.status-success]="block().status === 'success'"
      [class.status-failure]="block().status === 'failure'"
      [class.status-locked]="block().status === 'locked'"
    >
      <div class="block-content">
        <span class="crew-name">{{ block().crew_member }}</span>
        <span class="topic-name">{{ block().training_topic }}</span>
        <span class="weight-badge" [class]="'weight-' + block().slot_weight">
          {{ block().slot_weight | uppercase }}
        </span>
      </div>
      <div class="block-status">
        @switch (block().status) {
          @case ('success') {
            <mat-icon class="status-icon success" matTooltip="Success">check_circle</mat-icon>
          }
          @case ('failure') {
            <mat-icon class="status-icon failure" matTooltip="Failure">cancel</mat-icon>
          }
          @case ('locked') {
            <mat-icon class="status-icon locked" matTooltip="Mandatory">lock</mat-icon>
          }
        }
      </div>
      @if (canRemove()) {
        <button class="remove-btn" (click)="remove.emit(block().id)" matTooltip="Remove">
          <mat-icon>close</mat-icon>
        </button>
      }
    </div>
  `,
  styles: [`
    .training-block {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 14px 18px;
      background: rgba(36,28,20,0.6);
      border-left: 4px solid #5a5040;
      border-radius: 2px;
      position: relative;
      cursor: grab;
      transition: background 0.15s;
      min-width: 180px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.3);

      // Copper pin dot
      &::before {
        content: '';
        position: absolute;
        top: 8px;
        left: -8px;
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: radial-gradient(circle at 40% 40%, #d4956a, #b87333);
        box-shadow: 0 1px 2px rgba(0,0,0,0.4);
      }

      &:hover {
        background: rgba(36,28,20,0.8);

        .remove-btn {
          opacity: 1;
        }
      }

      &.status-success {
        background: rgba(90,138,74,0.12);
      }

      &.status-failure {
        background: rgba(166,61,47,0.12);
      }

      &.status-locked {
        opacity: 0.7;
        cursor: default;
      }
    }

    .block-content {
      display: flex;
      flex-direction: column;
      min-width: 0;
      flex: 1;
    }

    .crew-name {
      font-family: var(--font-body);
      font-size: 15px;
      color: var(--text-secondary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      font-style: italic;
    }

    .topic-name {
      font-family: var(--font-heading);
      font-size: 17px;
      font-weight: 600;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      letter-spacing: 0.3px;
      margin: 2px 0;
    }

    .weight-badge {
      display: inline-block;
      font-family: var(--font-data);
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.5px;
      padding: 3px 10px;
      border-radius: 2px;
      margin-top: 4px;
      width: fit-content;

      &.weight-heavy {
        background: rgba(166,61,47,0.2);
        color: #c45a4a;
      }
      &.weight-medium {
        background: rgba(184,115,51,0.2);
        color: var(--accent-copper);
      }
      &.weight-light {
        background: rgba(90,138,74,0.2);
        color: #6a9a5a;
      }
    }

    .block-status {
      display: flex;
      align-items: center;
    }

    .status-icon {
      font-size: 26px;
      width: 26px;
      height: 26px;

      &.success { color: var(--success-green); }
      &.failure { color: var(--failure-red); }
      &.locked { color: var(--text-secondary); }
    }

    .remove-btn {
      position: absolute;
      top: -8px;
      right: -8px;
      background: var(--bg-card);
      border: 1px solid var(--bg-card-border);
      border-radius: 50%;
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      opacity: 0;
      transition: opacity 0.15s;
      padding: 0;
      color: var(--text-secondary);

      mat-icon {
        font-size: 14px;
        width: 14px;
        height: 14px;
      }

      &:hover {
        color: var(--failure-red);
      }
    }
  `],
})
export class TrainingBlockComponent {
  block = input.required<ScheduleBlock>();
  canRemove = input(false);
  remove = output<string>();

  crewColor() {
    return CREW_COLORS[this.block().crew_member] ?? '#666';
  }
}
