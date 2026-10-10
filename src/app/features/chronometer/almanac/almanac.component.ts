import { Component, computed, inject, signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { AuthService } from '../../../core/auth/auth.service';
import { CalendarEvent } from '../../../shared/models';
import { ChronometerService } from '../chronometer.service';
import { ArgousDatePipe } from '../argous-date.pipe';
import { SeleinGlyphComponent } from '../selein-glyph.component';
import { AlmanacDmComponent } from '../almanac-dm/almanac-dm.component';
import { openEventEditor } from '../event-editor-dialog/event-editor-dialog.component';
import {
  MONTHS,
  STILLSTAR_LINE,
  festivalsOn,
  fromAbsDay,
  isVeilday,
  nextFestival,
  seleinPhase,
} from '../engine';

const UPCOMING_DAYS = 12;

/**
 * The Almanac — today's date, Selein, the next festival, the coming days, and
 * the log of events. Everyone sees the same face; the DM gets the clock, the
 * pending board, and day notes alongside (writes are guarded by RLS too).
 */
@Component({
  selector: 'app-almanac',
  standalone: true,
  imports: [ArgousDatePipe, SeleinGlyphComponent, AlmanacDmComponent],
  templateUrl: './almanac.component.html',
  styleUrl: './almanac.component.scss',
})
export class AlmanacComponent {
  protected chrono = inject(ChronometerService);
  protected auth = inject(AuthService);
  private dialog = inject(MatDialog);

  protected readonly today = this.chrono.currentAbsDay;
  protected readonly stillstar = STILLSTAR_LINE;

  protected readonly folkName = computed(() => {
    const d = this.chrono.currentDate();
    if (!d) return '';
    return isVeilday(d) ? 'the days without names' : MONTHS[d.month - 1].folk;
  });

  protected readonly todaysFestivals = computed(() => {
    const d = this.chrono.currentDate();
    return d ? festivalsOn(d) : [];
  });

  protected readonly selein = computed(() => {
    const abs = this.today();
    return abs === null ? null : seleinPhase(abs);
  });

  protected readonly next = computed(() => {
    const abs = this.today();
    return abs === null ? null : nextFestival(abs);
  });

  /** Today and the eleven days after it. */
  protected readonly upcoming = computed(() => {
    const today = this.today();
    if (today === null) return [];
    const byDay = this.eventsByDay();
    return Array.from({ length: UPCOMING_DAYS }, (_, i) => {
      const abs = today + i;
      return {
        abs,
        festivals: festivalsOn(fromAbsDay(abs)).map(f => f.name),
        events: byDay.get(abs) ?? [],
      };
    });
  });

  /** Every event this viewer can read, newest day first. */
  protected readonly log = computed(() =>
    [...this.eventsByDay()]
      .sort(([a], [b]) => b - a)
      .map(([abs, events]) => ({ abs, events })),
  );

  /** DM: the day whose note is open — today unless they've picked another. */
  private readonly pickedDay = signal<number | null>(null);
  protected readonly viewedDay = computed(() => this.pickedDay() ?? this.today());

  private readonly eventsByDay = computed(() => {
    const map = new Map<number, CalendarEvent[]>();
    for (const e of this.chrono.events()) {
      const list = map.get(e.abs_day);
      if (list) list.push(e);
      else map.set(e.abs_day, [e]);
    }
    return map;
  });

  pickDay(abs: number) {
    if (this.auth.isDm()) this.pickedDay.set(abs === this.today() ? null : abs);
  }

  editEvent(event: CalendarEvent, clickEvent: MouseEvent) {
    if (!this.auth.isDm()) return;
    clickEvent.stopPropagation();
    openEventEditor(this.dialog, { event, absDay: event.abs_day });
  }

  daysLabel(n: number): string {
    return n === 1 ? 'tomorrow' : `in ${n} days`;
  }
}
