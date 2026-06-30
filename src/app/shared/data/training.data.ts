export const CREW_COLORS: Record<string, string> = {
  'Anna Rose':       '#a63d2f',
  'Guner Aldric':    '#2a4a6b',
  'Rachel Rose':     '#5a8a4a',
  'Lehiri Stars':    '#6b3a8b',
  'Toji Brassboot':  '#b87333',
  'Porter Tomas':    '#6a6a5a',
  'Shanoa Buckler':  '#3a7a6a',
  'Ardor':           '#2a6a5a',
  'Bryce Morrison':  '#c49a3c',
  'Elro Boldfall':   '#7a4a2a',
  'Delvin Moss':     '#8a6a3a',
};

export const CREW_LIST = [
  'Anna Rose',
  'Guner Aldric',
  'Rachel Rose',
  'Lehiri Stars',
  'Toji Brassboot',
  'Porter Tomas',
  'Shanoa Buckler',
  'Ardor',
  'Bryce Morrison',
  'Elro Boldfall',
  'Delvin Moss',
] as const;

export type CrewName = typeof CREW_LIST[number];

/** Pool of ship-duty tasks drawn from when the app rolls the watch each day. */
export const DUTY_TASKS = [
  'Stand watch — forecastle',
  'Haul rigging — mainmast',
  'Run cargo below decks',
  'Assist navigation — chart room',
  'Swab and tar — weather deck',
  "Stand watch — crow's nest",
  'Galley supply run',
  'Pump the bilge',
] as const;

/** Default ship-duty hours placed per player per day. */
export const DEFAULT_DUTY_HOURS = 2;

export interface CrewMeta {
  role: string;
  line: string;
}

/** Role + one-line character read for each crew member (Crew roster / dossiers). */
export const CREW_META: Record<string, CrewMeta> = {
  'Anna Rose':       { role: 'Captain',             line: 'Runs the ship like a held breath — nothing happens she hasn\'t already noticed.' },
  'Guner Aldric':    { role: 'First Mate',          line: 'There is a procedure. Then there\'s Anna. Two years in, he\'s stopped being sure which one he trusts.' },
  'Rachel Rose':     { role: "Ship's Surgeon",      line: 'Stops the bleeding first. Everything else is conversation.' },
  'Lehiri Stars':    { role: 'Navigator',           line: 'Plots the safest course and the fastest one. Never says which she\'s giving you.' },
  'Toji Brassboot':  { role: 'Quartermaster',       line: 'Argues with the engine. Usually wins.' },
  'Porter Tomas':    { role: 'Cargo Master',        line: 'Knows what everything weighs and what it’s worth in three ports.' },
  'Shanoa Buckler':  { role: 'Master-at-Arms',      line: 'New aboard, sharp on the glass. Watches the Empire\'s flag like it might still recognize her.' },
  'Ardor':           { role: 'Passenger',           line: 'Charming, useful, paid in full — and nobody\'s quite sure why he\'s still aboard.' },
  'Bryce Morrison':  { role: "Bosun's Apprentice",  line: 'Means well. Arrives late. Stays anyway.' },
  'Elro Boldfall':   { role: "Ship's Cook",         line: 'Feeds the wound before it\'s named. Forgets to feed himself.' },
  'Delvin Moss':     { role: 'Deckhand · Herbalist', line: 'Always has what the ship needs. Always pours one more than he should.' },
};

export const TIER_NAMES: Record<number, string> = {
  1: 'Stranger',
  2: 'Familiar',
  3: 'Trusted',
  4: 'Close',
  5: 'Bound',
};

export const TIER_COLORS: Record<number, string> = {
  1: '#5a5040',
  2: '#4a7a8a',
  3: '#5a8a4a',
  4: '#c49a3c',
  5: '#dcd0be',
};
