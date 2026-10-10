import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ChronometerService } from '../chronometer.service';
import { festivalsOn, formatDate } from '../engine';

/** The in-game date in the app header — always visible, opens the Almanac. */
@Component({
  selector: 'app-date-banner',
  standalone: true,
  imports: [RouterLink],
  template: `
    @if (label(); as text) {
      <a class="date-banner" routerLink="/almanac" title="Open the Almanac">
        <span class="ms sm">calendar_month</span>
        <span class="db-date">{{ text }}</span>
        @if (festival(); as f) {
          <span class="db-festival">· {{ f }}</span>
        }
      </a>
    }
  `,
  styles: [`
    .date-banner {
      display: inline-flex; align-items: center; gap: 6px;
      font-family: var(--font-heading); font-size: 13px; letter-spacing: 0.4px;
      color: var(--text-primary); text-decoration: none; white-space: nowrap;
      padding: 3px 10px; border-radius: var(--radius);
      border: 1px solid transparent;
    }
    .date-banner:hover { border-color: var(--accent-gold-dim); color: var(--accent-gold); }
    .date-banner .ms { color: var(--accent-gold); }
    .db-festival { color: var(--text-secondary); font-size: 12px; }
  `],
})
export class DateBannerComponent {
  private chrono = inject(ChronometerService);

  protected readonly label = computed(() => {
    const d = this.chrono.currentDate();
    return d ? formatDate(d) : null;
  });

  protected readonly festival = computed(() => {
    const d = this.chrono.currentDate();
    return d ? festivalsOn(d).map(f => f.name).join(', ') || null : null;
  });
}
