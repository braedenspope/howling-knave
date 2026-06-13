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
  'Anna Rose':       { role: 'Captain',             line: 'Runs the ship like a held breath — nothing happens she hasn’t already noticed.' },
  'Guner Aldric':    { role: 'First Mate',          line: 'Observes, remembers, and at some point — acts.' },
  'Rachel Rose':     { role: "Ship's Surgeon",      line: 'Stops the bleeding first. Everything else is conversation.' },
  'Lehiri Stars':    { role: 'Navigator',           line: 'Knows the fixed lights by name, and a few that move.' },
  'Toji Brassboot':  { role: 'Quartermaster',       line: 'If it’s broken, bring it to her. If it explodes, bring it faster.' },
  'Porter Tomas':    { role: 'Cargo Master',        line: 'Knows what everything weighs and what it’s worth in three ports.' },
  'Shanoa Buckler':  { role: 'Master-at-Arms',      line: 'Teaches patience the hard way — by making you hold it.' },
  'Ardor':           { role: 'Passenger',           line: 'Speaks rarely. The pauses say more.' },
  'Bryce Morrison':  { role: "Bosun's Apprentice",  line: 'Trying his best, usually at the worst possible moment.' },
  'Elro Boldfall':   { role: "Ship's Cook",         line: 'Insists the galley is harder than swordwork. May be right.' },
  'Delvin Moss':     { role: 'Deckhand · Herbalist', line: 'Quiet hands, green thumbs, salt-stained pockets.' },
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
