import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { CalendarEvent } from '../../../shared/models';
import { ToastService } from '../../../shared/toast.service';
import { ChronometerService } from '../chronometer.service';
import { ArgousDatePipe } from '../argous-date.pipe';
import { ArgousDatePickerComponent } from '../argous-date-picker.component';
import { openEventEditor } from '../event-editor-dialog/event-editor-dialog.component';
import { ArgousDate, formatDate } from '../engine';

/** The DM's side of the Almanac: the clock, the pending board, and day notes. */
@Component({
  selector: 'app-almanac-dm',
  standalone: true,
  imports: [FormsModule, ArgousDatePipe, ArgousDatePickerComponent],
  templateUrl: './almanac-dm.component.html',
  styleUrl: './almanac-dm.component.scss',
})
export class AlmanacDmComponent {
  private chrono = inject(ChronometerService);
  private toast = inject(ToastService);
  private dialog = inject(MatDialog);

  /** The day whose note is open. */
  readonly viewedDay = input.required<number>();
  readonly backToToday = output<void>();

  protected readonly today = this.chrono.currentAbsDay;
  protected readonly busy = signal(false);

  // ----- clock -----
  protected advanceBy = 1;
  protected readonly settingDate = signal(false);
  protected readonly pickedDate = signal<ArgousDate>({ year: 1247, month: 1, day: 1 });

  async advance(n: number) {
    if (!Number.isInteger(n) || n < 1) {
      this.toast.warn('Advance by a whole number of days.');
      return;
    }
    await this.moveClock(() => this.chrono.advanceDays(n));
  }

  openSetDate() {
    const current = this.chrono.currentDate();
    if (current) this.pickedDate.set(current);
    this.settingDate.set(true);
  }

  async setDate() {
    await this.moveClock(() => this.chrono.setDate(this.pickedDate()));
    this.settingDate.set(false);
  }

  private async moveClock(write: () => Promise<void>) {
    this.busy.set(true);
    try {
      await write();
      const d = this.chrono.currentDate();
      if (d) this.toast.show(`The day turns — ${formatDate(d)}`);
    } catch (e) {
      this.toast.warn((e as Error).message);
    } finally {
      this.busy.set(false);
    }
  }

  // ----- events -----

  /** Every event on or after today, DM-only and player alike, soonest first. */
  protected readonly pending = computed(() => {
    const today = this.today();
    if (today === null) return [];
    return this.chrono.events().filter(e => e.abs_day >= today);
  });

  newEvent() {
    openEventEditor(this.dialog, { absDay: this.viewedDay() });
  }

  editEvent(event: CalendarEvent) {
    openEventEditor(this.dialog, { event, absDay: event.abs_day });
  }

  // ----- day notes -----

  /** The day the textarea currently holds — saving targets this, not viewedDay. */
  private noteDay: number | null = null;
  private savedNote = '';
  protected note = '';
  protected readonly noteLoading = signal(false);

  constructor() {
    effect(() => {
      const abs = this.viewedDay();
      this.loadNote(abs);
    });
  }

  private async loadNote(abs: number) {
    this.noteLoading.set(true);
    const body = await this.chrono.getNote(abs);
    if (abs !== this.viewedDay()) return; // the DM moved on while this loaded
    this.noteDay = abs;
    this.note = this.savedNote = body;
    this.noteLoading.set(false);
  }

  async saveNote() {
    const abs = this.noteDay;
    const body = this.note;
    if (abs === null || body === this.savedNote) return;
    try {
      await this.chrono.saveNote(abs, body);
      this.savedNote = body;
    } catch (e) {
      this.toast.warn((e as Error).message);
    }
  }
}
