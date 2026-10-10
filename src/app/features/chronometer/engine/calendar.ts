// The Calendar of Argous — canon structure and absDay arithmetic.
//
// Pure TypeScript: no Angular, no Supabase. Everything else in the Chronometer
// consumes this. The structure below is canon (The Calendar of Argous — World
// Canon Document); if the two ever disagree, the document wins.

export interface ArgousDate {
  year: number;
  /** 1–10 for the months, 11 for the Veildays. */
  month: number;
  day: number;
}

export const MONTHS: readonly { name: string; folk: string }[] = [
  { name: 'Primis', folk: 'Firstmonth' },
  { name: 'Senda', folk: 'Snowwane' },
  { name: 'Tersel', folk: 'Seedmonth' },
  { name: 'Quarrow', folk: 'Greenmonth' },
  { name: 'Quinter', folk: 'Half-Year' },
  { name: 'Sestal', folk: 'Highsun' },
  { name: 'Septena', folk: 'Goldmonth' },
  { name: 'Ottis', folk: 'Harvestmonth' },
  { name: 'Noven', folk: 'Fademonth' },
  { name: 'Dessima', folk: 'The Dying' },
];

export const WEEKDAYS: readonly string[] = [
  'Hearthday',
  'Vyrday',
  'Lilsday',
  'Farday',
  'Thessday',
  'Seaday',
];

/** The month number used for the Veildays, which belong to no month. */
export const VEIL_MONTH = 11;
export const DAYS_PER_MONTH = 36;
const MONTHS_PER_YEAR = 10;
const MONTH_DAYS_PER_YEAR = MONTHS_PER_YEAR * DAYS_PER_MONTH; // 360
const VEILDAYS = 5;

/** Invented incidental: canon says only "every fourth year". */
export function isLongVeilYear(year: number): boolean {
  return mod(year, 4) === 0;
}

export function veildaysIn(year: number): number {
  return isLongVeilYear(year) ? VEILDAYS + 1 : VEILDAYS;
}

export function daysInYear(year: number): number {
  return MONTH_DAYS_PER_YEAR + veildaysIn(year);
}

/** absDay of 1 Primis of `year`. Long Veil years strictly before Y: floor((Y + 3) / 4). */
function yearStart(year: number): number {
  return 365 * year + Math.floor((year + 3) / 4);
}

export function toAbsDay(d: ArgousDate): number {
  const { year, month, day } = d;
  if (!Number.isInteger(year)) throw new RangeError(`Invalid year: ${year}`);
  if (!Number.isInteger(month) || month < 1 || month > VEIL_MONTH) {
    throw new RangeError(`Invalid month: ${month}`);
  }
  const max = month === VEIL_MONTH ? veildaysIn(year) : DAYS_PER_MONTH;
  if (!Number.isInteger(day) || day < 1 || day > max) {
    throw new RangeError(
      month === VEIL_MONTH
        ? `Invalid Veilday ${day}: ${formatYear(year)} has ${max} Veildays`
        : `Invalid day: ${day}`,
    );
  }
  return yearStart(year) + (month - 1) * DAYS_PER_MONTH + (day - 1);
}

export function fromAbsDay(abs: number): ArgousDate {
  if (!Number.isInteger(abs)) throw new RangeError(`Invalid absDay: ${abs}`);
  let year = Math.floor(abs / 365.25);
  while (yearStart(year) > abs) year--;
  while (yearStart(year + 1) <= abs) year++;

  const dayOfYear = abs - yearStart(year);
  if (dayOfYear >= MONTH_DAYS_PER_YEAR) {
    return { year, month: VEIL_MONTH, day: dayOfYear - MONTH_DAYS_PER_YEAR + 1 };
  }
  return {
    year,
    month: Math.floor(dayOfYear / DAYS_PER_MONTH) + 1,
    day: (dayOfYear % DAYS_PER_MONTH) + 1,
  };
}

export function addDays(abs: number, n: number): number {
  return abs + n;
}

export function isVeilday(d: ArgousDate): boolean {
  return d.month === VEIL_MONTH;
}

/** Every month begins on Hearthday, so the weekday depends on day-of-month alone. */
export function weekdayOf(d: ArgousDate): string | null {
  if (isVeilday(d)) return null;
  return WEEKDAYS[(d.day - 1) % WEEKDAYS.length];
}

/** Month name, folk name, or "Veiltide" for the Veildays. */
export function monthName(month: number, opts?: { folk?: boolean }): string {
  if (month === VEIL_MONTH) return 'Veiltide';
  const m = MONTHS[month - 1];
  return opts?.folk ? m.folk : m.name;
}

/** `1,247 A.S.` */
export function formatYear(year: number): string {
  const sign = year < 0 ? '-' : '';
  const digits = String(Math.abs(year)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${sign}${digits} A.S.`;
}

/**
 * `Seaday, 12 Tersel, 1,247 A.S.` — or with `folk`, `Seaday, 12 Seedmonth, 1,247 A.S.`.
 * Veildays: `Veiltide — 3rd Veilday, 1,247 A.S.`
 */
export function formatDate(d: ArgousDate, opts?: { folk?: boolean }): string {
  if (isVeilday(d)) {
    return `Veiltide — ${ordinal(d.day)} Veilday, ${formatYear(d.year)}`;
  }
  return `${weekdayOf(d)}, ${d.day} ${monthName(d.month, opts)}, ${formatYear(d.year)}`;
}

/** Imperial Reckoning. */
export function toImperialYear(asYear: number): number {
  return asYear - 177;
}

/** Charter Calendar. */
export function toCharterYear(asYear: number): number {
  return asYear - 890;
}

export function ordinal(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

/** Euclidean modulo — always non-negative for a positive divisor. */
export function mod(a: number, n: number): number {
  return ((a % n) + n) % n;
}
