import { Component, computed, model } from '@angular/core';
import { ArgousDate, DAYS_PER_MONTH, MONTHS, VEIL_MONTH, veildaysIn } from './engine';

/**
 * Year / month-or-Veiltide / day pickers. The day list follows the month (and,
 * for Veiltide, the year's Long Veil), so it can only ever offer a real date.
 */
@Component({
  selector: 'app-argous-date-picker',
  standalone: true,
  template: `
    <div class="adp">
      <div class="hk-field adp-day">
        <label>Day</label>
        <select [value]="value().day" (change)="setDay(+$any($event.target).value)">
          @for (n of days(); track n) {
            <option [value]="n" [selected]="n === value().day">{{ n }}</option>
          }
        </select>
      </div>
      <div class="hk-field adp-month">
        <label>Month</label>
        <select (change)="setMonth(+$any($event.target).value)">
          @for (m of months; track m.n) {
            <option [value]="m.n" [selected]="m.n === value().month">{{ m.label }}</option>
          }
        </select>
      </div>
      <div class="hk-field adp-year">
        <label>Year (A.S.)</label>
        <input type="number" step="1" [value]="value().year"
          (change)="setYear(+$any($event.target).value)" />
      </div>
    </div>
  `,
  styles: [`
    .adp { display: grid; grid-template-columns: 76px 1fr 110px; gap: 10px; }
  `],
})
export class ArgousDatePickerComponent {
  readonly value = model.required<ArgousDate>();

  protected readonly months = [
    ...MONTHS.map((m, i) => ({ n: i + 1, label: `${m.name} (${m.folk})` })),
    { n: VEIL_MONTH, label: 'Veiltide (the Veildays)' },
  ];

  protected readonly days = computed(() => {
    const { year, month } = this.value();
    const count = month === VEIL_MONTH ? veildaysIn(year) : DAYS_PER_MONTH;
    return Array.from({ length: count }, (_, i) => i + 1);
  });

  setDay(day: number) {
    this.value.update(v => ({ ...v, day }));
  }

  setMonth(month: number) {
    this.value.update(v => this.clamp({ ...v, month }));
  }

  setYear(year: number) {
    if (!Number.isInteger(year)) return;
    this.value.update(v => this.clamp({ ...v, year }));
  }

  /** Pull the day back inside the month — e.g. 36 Dessima → Veiltide becomes the last Veilday. */
  private clamp(d: ArgousDate): ArgousDate {
    const max = d.month === VEIL_MONTH ? veildaysIn(d.year) : DAYS_PER_MONTH;
    return { ...d, day: Math.min(d.day, max) };
  }
}
