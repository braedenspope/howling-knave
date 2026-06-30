import { Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { TrainingWithCrew } from '../../../shared/models';

export interface TrainingDetailData {
  training: TrainingWithCrew;
  color: string;
}

@Component({
  selector: 'app-training-detail-dialog',
  standalone: true,
  imports: [MatDialogModule],
  template: `
    <div class="td-modal" [style.border-top]="'3px solid ' + data.color">
      <button class="td-close" mat-dialog-close aria-label="Close"><span class="ms">close</span></button>

      <p class="td-crew stamp-label" [style.color]="data.color">{{ t.crew_member_name }}</p>
      <h2 class="td-title gold-text">{{ t.topic }}</h2>

      <div class="td-badges">
        <span class="td-badge threshold">{{ t.threshold_pp }} PP</span>
        <span class="td-badge">{{ t.sessions_required }} session{{ t.sessions_required === 1 ? '' : 's' }}</span>
      </div>

      <p class="td-reward"><span class="ms sm">military_tech</span> {{ t.reward }}</p>

      @if (t.description) {
        <p class="td-desc">{{ t.description }}</p>
      }
    </div>
  `,
  styles: [`
    .td-modal { position: relative; padding: 4px 2px; }
    .td-close {
      position: absolute; top: -2px; right: -2px;
      background: none; border: none; color: var(--text-secondary);
      cursor: pointer; padding: 4px; line-height: 0; border-radius: 50%;
    }
    .td-close:hover { color: var(--accent-gold); }
    .td-close .ms { font-size: 20px; }
    .td-crew { margin: 0 0 2px; }
    .td-title { margin: 0 0 10px; font-size: 22px; letter-spacing: 0.5px; padding-right: 22px; }
    .td-badges { display: flex; gap: 6px; margin-bottom: 12px; }
    .td-badge {
      font-family: var(--font-data); font-size: 10px; font-weight: 700;
      letter-spacing: 0.5px; padding: 2px 8px; border-radius: 2px;
      background: rgba(255,255,255,0.06); color: var(--text-secondary);
    }
    .td-badge.threshold { background: rgba(196,154,60,0.18); color: var(--accent-gold); }
    .td-reward {
      display: flex; align-items: center; gap: 6px;
      font-family: var(--font-body); font-size: 14px; color: var(--text-primary);
      margin: 0 0 12px;
      .ms { color: var(--accent-gold); }
    }
    .td-desc {
      font-size: 14px; line-height: 1.55; color: var(--text-secondary);
      font-style: italic; margin: 0;
    }
  `],
})
export class TrainingDetailDialogComponent {
  data = inject<TrainingDetailData>(MAT_DIALOG_DATA);
  get t(): TrainingWithCrew { return this.data.training; }
}
