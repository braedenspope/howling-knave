// Selein, the natural moon, and the Stillstar.

import { mod, toAbsDay } from './calendar';

export const SELEIN_CYCLE_DAYS = 30;

/** The standard eight-phase sequence (invented incidental), 3.75 days each. */
export const SELEIN_PHASES: readonly string[] = [
  'New',
  'Waxing Crescent',
  'First Quarter',
  'Waxing Gibbous',
  'Full',
  'Waning Gibbous',
  'Last Quarter',
  'Waning Crescent',
];

/** Invented incidental: New Moon on 1 Primis, 1,247 A.S. */
export const SELEIN_NEW_ANCHOR = toAbsDay({ year: 1247, month: 1, day: 1 });

/** The Stillstar does not move, rise, set, or change. */
export const STILLSTAR_LINE = 'The Stillstar holds its station.';

export function seleinPhase(
  abs: number,
  anchor: number = SELEIN_NEW_ANCHOR,
): { name: string; index: number; cycleDay: number } {
  const cycleDay = mod(abs - anchor, SELEIN_CYCLE_DAYS);
  const index = Math.floor(cycleDay / (SELEIN_CYCLE_DAYS / SELEIN_PHASES.length));
  return { name: SELEIN_PHASES[index], index, cycleDay };
}
