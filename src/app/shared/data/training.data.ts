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

export const TIER_NAMES: Record<number, string> = {
  0: 'Wary',
  1: 'Stranger',
  2: 'Familiar',
  3: 'Trusted',
  4: 'Close',
  5: 'Bound',
};

export const TIER_COLORS: Record<number, string> = {
  0: '#8a4a3a',
  1: '#5a5040',
  2: '#4a7a8a',
  3: '#5a8a4a',
  4: '#c49a3c',
  5: '#dcd0be',
};
