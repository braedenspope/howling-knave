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
      gap: 8px;
      padding: 6px 10px;
      background: rgba(255, 255, 255, 0.04);
      border-left: 3px solid #666;
      border-radius: 4px;
      position: relative;
      cursor: grab;
      transition: background 0.15s;
      min-width: 0;

      &:hover {
        background: rgba(255, 255, 255, 0.08);

        .remove-btn {
          opacity: 1;
        }
      }

      &.status-success {
        background: rgba(46, 204, 64, 0.08);
      }

      &.status-failure {
        background: rgba(230, 57, 70, 0.08);
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
      font-size: 11px;
      color: var(--text-secondary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .topic-name {
      font-size: 13px;
      font-weight: 500;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .weight-badge {
      display: inline-block;
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 0.5px;
      padding: 1px 6px;
      border-radius: 3px;
      margin-top: 2px;
      width: fit-content;

      &.weight-heavy {
        background: rgba(230, 57, 70, 0.2);
        color: #e63946;
      }
      &.weight-medium {
        background: rgba(247, 127, 0, 0.2);
        color: #f77f00;
      }
      &.weight-light {
        background: rgba(46, 204, 64, 0.2);
        color: #2ecc40;
      }
    }

    .block-status {
      display: flex;
      align-items: center;
    }

    .status-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;

      &.success { color: var(--success-green); }
      &.failure { color: var(--failure-red); }
      &.locked { color: var(--text-secondary); }
    }

    .remove-btn {
      position: absolute;
      top: -6px;
      right: -6px;
      background: var(--bg-card);
      border: 1px solid var(--bg-card-border);
      border-radius: 50%;
      width: 20px;
      height: 20px;
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
