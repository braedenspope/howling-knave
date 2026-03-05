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
