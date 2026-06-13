import { Injectable, signal, effect } from '@angular/core';

export type Metalwork = 'gold' | 'copper' | 'silver';
export type Density = 'comfortable' | 'compact';

interface TweaksState {
  textureAlpha: number;
  metalwork: Metalwork;
  compass: boolean;
  density: Density;
}

const METAL_PALETTES: Record<Metalwork, { gold: string; brass: string; copper: string; dim: string }> = {
  gold:   { gold: '#d4a843', brass: '#c49a3c', copper: '#b87333', dim: 'rgba(212,168,67,0.35)' },
  copper: { gold: '#d98a4a', brass: '#c47a35', copper: '#a65a28', dim: 'rgba(217,138,74,0.35)' },
  silver: { gold: '#c9c2b0', brass: '#ada594', copper: '#8a8270', dim: 'rgba(201,194,176,0.35)' },
};

const STORAGE_KEY = 'hk-tweaks';
const DEFAULTS: TweaksState = { textureAlpha: 1, metalwork: 'gold', compass: false, density: 'comfortable' };

/** Feature #6 — live theme tweaks, persisted to localStorage. */
@Injectable({ providedIn: 'root' })
export class TweaksService {
  readonly textureAlpha = signal(DEFAULTS.textureAlpha);
  readonly metalwork = signal<Metalwork>(DEFAULTS.metalwork);
  readonly compass = signal(DEFAULTS.compass);
  readonly density = signal<Density>(DEFAULTS.density);

  constructor() {
    this.restore();
    effect(() => {
      const state: TweaksState = {
        textureAlpha: this.textureAlpha(),
        metalwork: this.metalwork(),
        compass: this.compass(),
        density: this.density(),
      };
      this.apply(state);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* ignore */ }
    });
  }

  private restore() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const s = { ...DEFAULTS, ...JSON.parse(raw) } as TweaksState;
      this.textureAlpha.set(s.textureAlpha);
      this.metalwork.set(s.metalwork);
      this.compass.set(s.compass);
      this.density.set(s.density);
    } catch { /* ignore */ }
  }

  private apply(s: TweaksState) {
    const root = document.documentElement;
    root.style.setProperty('--texture-alpha', String(s.textureAlpha));
    const p = METAL_PALETTES[s.metalwork];
    root.style.setProperty('--accent-gold', p.gold);
    root.style.setProperty('--accent-brass', p.brass);
    root.style.setProperty('--accent-copper', p.copper);
    root.style.setProperty('--accent-gold-dim', p.dim);
    document.body.classList.toggle('density-compact', s.density === 'compact');
    document.body.classList.toggle('show-compass', s.compass);
  }

  reset() {
    this.textureAlpha.set(DEFAULTS.textureAlpha);
    this.metalwork.set(DEFAULTS.metalwork);
    this.compass.set(DEFAULTS.compass);
    this.density.set(DEFAULTS.density);
  }
}
