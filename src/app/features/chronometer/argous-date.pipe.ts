import { Pipe, PipeTransform } from '@angular/core';
import { formatDate, fromAbsDay, monthName, ordinal, weekdayOf } from './engine';

/**
 * `{{ absDay | argousDate }}` → `Seaday, 12 Tersel, 1,247 A.S.`
 * `{{ absDay | argousDate: 'short' }}` → `Seaday, 12 Tersel` (Veildays: `3rd Veilday`)
 * `{{ absDay | argousDate: 'folk' }}` → `Seaday, 12 Seedmonth, 1,247 A.S.`
 */
@Pipe({ name: 'argousDate', standalone: true })
export class ArgousDatePipe implements PipeTransform {
  transform(abs: number | null | undefined, style: 'full' | 'short' | 'folk' = 'full'): string {
    if (abs === null || abs === undefined) return '';
    const d = fromAbsDay(abs);
    if (style === 'short') {
      const weekday = weekdayOf(d);
      return weekday === null
        ? `${ordinal(d.day)} Veilday`
        : `${weekday}, ${d.day} ${monthName(d.month)}`;
    }
    return formatDate(d, { folk: style === 'folk' });
  }
}
