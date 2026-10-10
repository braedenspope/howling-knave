import {
  ArgousDate,
  FESTIVALS,
  MONTHS,
  WEEKDAYS,
  addDays,
  daysInYear,
  festivalsOn,
  formatDate,
  fromAbsDay,
  isLongVeilYear,
  nextFestival,
  seleinPhase,
  toAbsDay,
  toCharterYear,
  toImperialYear,
  weekdayOf,
} from './index';

const d = (year: number, month: number, day: number): ArgousDate => ({ year, month, day });
const names = (date: ArgousDate) => festivalsOn(date).map(f => f.name);

describe('Calendar of Argous — acceptance (brief §2.1)', () => {
  it('absDay 0 is 1 Primis, Year 0, a Hearthday', () => {
    expect(fromAbsDay(0)).toEqual(d(0, 1, 1));
    expect(weekdayOf(fromAbsDay(0))).toBe('Hearthday');
  });

  it('round-trips the campaign start', () => {
    expect(fromAbsDay(toAbsDay(d(1247, 3, 12)))).toEqual(d(1247, 3, 12));
  });

  it.each([
    [d(1247, 3, 12), 'Seaday'], // campaign start
    [d(1247, 3, 15), 'Lilsday'], // Charter Day
    [d(1247, 5, 36), 'Seaday'], // Half-Turn
    [d(1247, 1, 18), 'Seaday'], // Stillwatch
    [d(1247, 2, 23), 'Thessday'], // Tending
    [d(1247, 7, 4), 'Farday'], // Far-Calling
    [d(1247, 9, 29), 'Thessday'], // Gravetide
    [d(1247, 11, 2), null], // Veilday
  ])('weekdayOf(%o) → %s', (date, weekday) => {
    expect(weekdayOf(date)).toBe(weekday);
  });

  it('applies the Long Veil rule', () => {
    expect(isLongVeilYear(1247)).toBe(false);
    expect(isLongVeilYear(1248)).toBe(true);
    expect(daysInYear(1247)).toBe(365);
    expect(daysInYear(1248)).toBe(366);
  });

  it('walks from 36 Dessima through Veiltide into Firstlight', () => {
    expect(fromAbsDay(addDays(toAbsDay(d(1247, 10, 36)), 1))).toEqual(d(1247, 11, 1));
    expect(fromAbsDay(addDays(toAbsDay(d(1247, 10, 36)), 6))).toEqual(d(1248, 1, 1));
    expect(fromAbsDay(addDays(toAbsDay(d(1248, 10, 36)), 7))).toEqual(d(1249, 1, 1));
  });

  it('allows a sixth Veilday only in a Long Veil year', () => {
    expect(() => toAbsDay(d(1247, 11, 6))).toThrow();
    expect(() => toAbsDay(d(1248, 11, 6))).not.toThrow();
  });

  it('formats dates', () => {
    expect(formatDate(d(1247, 3, 12))).toBe('Seaday, 12 Tersel, 1,247 A.S.');
    expect(formatDate(d(1247, 3, 12), { folk: true })).toBe('Seaday, 12 Seedmonth, 1,247 A.S.');
    expect(formatDate(d(1247, 11, 3))).toBe('Veiltide — 3rd Veilday, 1,247 A.S.');
  });

  it('converts epochs', () => {
    expect(toImperialYear(1247)).toBe(1070);
    expect(toCharterYear(1247)).toBe(357);
  });

  it('finds festivals on a day', () => {
    expect(names(d(1247, 3, 15))).toEqual(['Charter Day']);
    expect(names(d(1247, 4, 3))).toEqual(['The Verdancy']);
    expect(names(d(1247, 11, 1))).toEqual(['Veiltide']);
  });

  it('finds the next festival', () => {
    const fromStart = nextFestival(toAbsDay(d(1247, 3, 12)));
    expect(fromStart.festival.name).toBe('Charter Day');
    expect(fromStart.daysUntil).toBe(3);

    // Forgetide is today, so next is Veiltide.
    const fromForgetide = nextFestival(toAbsDay(d(1247, 10, 1)));
    expect(fromForgetide.festival.name).toBe('Veiltide');
    expect(fromForgetide.daysUntil).toBe(36);
  });

  it('starts Selein new on 1 Primis 1,247', () => {
    expect(seleinPhase(toAbsDay(d(1247, 1, 1))).name).toBe('New');
  });
});

describe('Calendar of Argous — structure and edges', () => {
  it('has the canon months, weekdays, and festivals', () => {
    expect(MONTHS.length).toBe(10);
    expect(WEEKDAYS.length).toBe(6);
    expect(FESTIVALS.length).toBe(19);
  });

  it('round-trips every day across a full Long Veil cycle and beyond', () => {
    const start = toAbsDay(d(1244, 1, 1));
    const end = toAbsDay(d(1250, 1, 1));
    let prev = fromAbsDay(start - 1);
    for (let abs = start; abs < end; abs++) {
      const date = fromAbsDay(abs);
      expect(toAbsDay(date)).toBe(abs);
      // Strictly advancing, one day at a time.
      expect(
        date.year > prev.year ||
          date.month > prev.month ||
          (date.month === prev.month && date.day === prev.day + 1),
      ).toBe(true);
      prev = date;
    }
  });

  it('round-trips negative absDays (before the Sundering)', () => {
    for (let abs = -2000; abs < 0; abs++) {
      expect(toAbsDay(fromAbsDay(abs))).toBe(abs);
    }
    expect(fromAbsDay(-1)).toEqual(d(-1, 11, 5));
  });

  it('matches the absDays hardcoded in migration 017 seed data', () => {
    expect(toAbsDay(d(1247, 3, 12))).toBe(455550);
    expect(toAbsDay(d(1247, 3, 14))).toBe(455552);
    expect(toAbsDay(d(1247, 3, 15))).toBe(455553);
  });

  it('year 0 is a Long Veil year', () => {
    expect(fromAbsDay(365)).toEqual(d(0, 11, 6));
    expect(fromAbsDay(366)).toEqual(d(1, 1, 1));
  });

  it.each([
    d(1247, 0, 1),
    d(1247, 12, 1),
    d(1247, 3, 0),
    d(1247, 3, 37),
    d(1247, 11, 0),
    d(1247, 3, 1.5),
  ])('rejects %o', date => {
    expect(() => toAbsDay(date)).toThrow(RangeError);
  });

  it('formats the Long Veil and folk names', () => {
    expect(formatDate(d(1248, 11, 6))).toBe('Veiltide — 6th Veilday, 1,248 A.S.');
    expect(formatDate(d(1247, 10, 36), { folk: true })).toBe(
      'Seaday, 36 The Dying, 1,247 A.S.',
    );
  });

  it('matches multi-day festivals on every day of the span', () => {
    for (let day = 1; day <= 6; day++) expect(names(d(1247, 4, day))).toContain('The Verdancy');
    expect(names(d(1247, 4, 7))).toEqual([]);
    for (let day = 31; day <= 36; day++) expect(names(d(1247, 6, day))).toContain('The High Winds');
    for (let day = 16; day <= 21; day++) expect(names(d(1247, 7, day))).toContain('The Salt Court');
    expect(names(d(1248, 11, 6))).toEqual(['Veiltide']);
  });

  it('does not report a span already under way as the next festival', () => {
    // Day 3 of the Verdancy: next to begin is the Binding on 15 Quarrow.
    const next = nextFestival(toAbsDay(d(1247, 4, 3)));
    expect(next.festival.name).toBe('The Binding');
    expect(next.daysUntil).toBe(12);
  });

  it('wraps the next festival into the next year', () => {
    const next = nextFestival(toAbsDay(d(1247, 11, 3)));
    expect(next.festival.name).toBe('Firstlight');
    expect(fromAbsDay(next.absDay)).toEqual(d(1248, 1, 1));
    expect(next.daysUntil).toBe(3);
  });

  it('walks Selein through its phases on a 30-day cycle', () => {
    const anchor = toAbsDay(d(1247, 1, 1));
    expect(seleinPhase(anchor + 3).name).toBe('New'); // 3 < 3.75
    expect(seleinPhase(anchor + 4).name).toBe('Waxing Crescent');
    expect(seleinPhase(anchor + 15).name).toBe('Full');
    expect(seleinPhase(anchor + 29).name).toBe('Waning Crescent');
    expect(seleinPhase(anchor + 30).name).toBe('New');
    expect(seleinPhase(anchor - 1).cycleDay).toBe(29);
    expect(seleinPhase(anchor + 7, anchor + 7).name).toBe('New');
  });
});
