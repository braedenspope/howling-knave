export const CREW_COLORS: Record<string, string> = {
  'Anna Rose':       '#e63946',
  'Guner Aldric':    '#1a3a6b',
  'Rachel Rose':     '#2ecc40',
  'Lehiri Stars':    '#7b2fbe',
  'Toji Brassboot':  '#f77f00',
  'Porter Tomas':    '#8a8a8a',
  'Shanoa Buckler':  '#3cb4a0',
  'Ardor':           '#00897b',
  'Bryce Morrison':  '#d4af37',
  'Elro Boldfall':   '#a0522d',
  'Delvin Moss':     '#b87333',
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
  1: '#666',
  2: '#4a90d9',
  3: '#2ecc40',
  4: '#d4af37',
  5: '#f0ead6',
};
