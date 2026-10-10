// Festivals of Argous — canon names, dates, and player-safe blurbs.

import { ArgousDate, VEIL_MONTH, fromAbsDay } from './calendar';

export type FestivalKind = 'shared' | 'faith' | 'national' | 'veil';

export interface Festival {
  id: string;
  name: string;
  kind: FestivalKind;
  nation?: string;
  blurb: string;
  match(d: ArgousDate): boolean;
}

const on =
  (month: number, day: number) =>
  (d: ArgousDate): boolean =>
    d.month === month && d.day === day;

const span =
  (month: number, from: number, to: number) =>
  (d: ArgousDate): boolean =>
    d.month === month && d.day >= from && d.day <= to;

export const FESTIVALS: readonly Festival[] = [
  // ---- fixed single days ----
  {
    id: 'firstlight',
    name: 'Firstlight',
    kind: 'shared',
    blurb: 'The new year is called in with lamps and beacons at dawn.',
    match: on(1, 1),
  },
  {
    id: 'stillwatch',
    name: 'The Stillwatch',
    kind: 'faith',
    blurb: 'Folk sit up through the deep-winter night to watch the Stillstar.',
    match: on(1, 18),
  },
  {
    id: 'tending',
    name: 'The Tending',
    kind: 'faith',
    blurb: "Theslyn's high day; healers work without fee, graves are cleared, mourners fed.",
    match: on(2, 23),
  },
  {
    id: 'seedwake',
    name: 'Seedwake',
    kind: 'shared',
    blurb: "Seed-grain is blessed, sung over, and traded on winter's last day.",
    match: on(2, 36),
  },
  {
    id: 'firstfurrow',
    name: 'Firstfurrow',
    kind: 'shared',
    blurb: "The year's first furrow cut at dawn; the plow garlanded.",
    match: on(3, 6),
  },
  {
    id: 'charter-day',
    name: 'Charter Day',
    kind: 'national',
    nation: 'Prairie Commonwealth',
    blurb: 'Anniversary of the Commonwealth Charter; civic fairs and public readings.',
    match: on(3, 15),
  },
  {
    id: 'binding',
    name: 'The Binding',
    kind: 'shared',
    blurb: 'The yearly renewal of oaths, apprenticeships, and marriages.',
    match: on(4, 15),
  },
  {
    id: 'kindling',
    name: 'The Kindling',
    kind: 'faith',
    blurb: "The Pyre Clergy's flame-rite; embers carried from temple to hearth.",
    match: on(5, 9),
  },
  {
    id: 'half-turn',
    name: 'The Half-Turn (Sundering Day)',
    kind: 'shared',
    blurb: 'The anniversary of the Sundering; every nation keeps it differently.',
    match: on(5, 36),
  },
  {
    id: 'longlight',
    name: 'Longlight',
    kind: 'shared',
    blurb:
      'The longest day; straw sun-wheels raised at dawn and burned at dusk. All work stops at noon.',
    match: on(6, 18),
  },
  {
    id: 'far-calling',
    name: 'The Far-Calling',
    kind: 'faith',
    blurb:
      "Aelorun's festival; letters to the distant, bargains struck at dawn, travelers fed free.",
    match: on(7, 4),
  },
  {
    id: 'harvest-home',
    name: 'Harvest Home',
    kind: 'shared',
    blurb: 'The great ingathering feast; the last sheaf carried in procession.',
    match: on(8, 30),
  },
  {
    id: 'ascendance',
    name: 'Ascendance Festival',
    kind: 'national',
    nation: 'Sovereign Empire',
    blurb: "Anniversary of the Empire's declaration; flame-games and pageantry.",
    match: on(9, 12),
  },
  {
    id: 'gravetide',
    name: 'Gravetide',
    kind: 'shared',
    blurb: 'The day of the dead; lamps set on graves and on the water.',
    match: on(9, 29),
  },
  {
    id: 'forgetide',
    name: 'Forgetide',
    kind: 'national',
    nation: 'Ironheart Federation',
    blurb: "The great forges relit for winter; apprentices show their first year's work.",
    match: on(10, 1),
  },

  // ---- spans (fixed spans for canon's loose dates are invented incidentals) ----
  {
    id: 'verdancy',
    name: 'The Verdancy',
    kind: 'national',
    nation: 'Sylvan Concordat',
    blurb: 'Tree-blessing and renewal rites through the forest cities.',
    match: span(4, 1, 6),
  },
  {
    id: 'high-winds',
    name: 'The High Winds',
    kind: 'national',
    nation: 'Skybourne Reaches',
    blurb: "Gusthaven's aerial games on the summer thermals.",
    match: span(6, 31, 36),
  },
  {
    id: 'salt-court',
    name: 'The Salt Court',
    kind: 'national',
    nation: 'Pirate Isles',
    blurb:
      'The Council of Salt convenes; races, duels, and markets of things no customs house sees.',
    match: span(7, 16, 21),
  },
  {
    id: 'veiltide',
    name: 'Veiltide',
    kind: 'veil',
    blurb:
      'The days without names. Debts settled or forgiven, hearths relit, masks in the streets.',
    match: d => d.month === VEIL_MONTH,
  },
];

export function festivalsOn(d: ArgousDate): Festival[] {
  return FESTIVALS.filter(f => f.match(d));
}

/**
 * The next festival to *begin* strictly after `abs`. A span already under way
 * (e.g. the third day of the Verdancy) is not "next" — its following day is
 * skipped and the scan moves on to the next festival that starts. Every
 * festival recurs yearly, so the scan always ends within a year.
 */
export function nextFestival(abs: number): {
  festival: Festival;
  absDay: number;
  daysUntil: number;
} {
  let prev = fromAbsDay(abs);
  for (let n = 1; n <= 367; n++) {
    const date = fromAbsDay(abs + n);
    const starting = FESTIVALS.find(f => f.match(date) && !f.match(prev));
    if (starting) return { festival: starting, absDay: abs + n, daysUntil: n };
    prev = date;
  }
  throw new Error('No festival within a year — the festival table is empty.');
}
