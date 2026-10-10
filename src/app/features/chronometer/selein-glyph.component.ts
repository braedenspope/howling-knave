import { Component, computed, input } from '@angular/core';
import { SELEIN_CYCLE_DAYS } from './engine';

const R = 20;
const C = 24;

/** Selein's face for a cycle day — a dark disc with its lit portion drawn over it. */
@Component({
  selector: 'app-selein-glyph',
  standalone: true,
  template: `
    <svg viewBox="0 0 48 48" [attr.width]="size()" [attr.height]="size()" aria-hidden="true">
      <circle [attr.cx]="c" [attr.cy]="c" [attr.r]="r" class="dark" />
      <path [attr.d]="lit()" class="lit" />
      <circle [attr.cx]="c" [attr.cy]="c" [attr.r]="r" class="rim" />
    </svg>
  `,
  styles: [`
    :host { display: inline-flex; }
    .dark { fill: var(--bg-deep); }
    .lit { fill: var(--parchment); }
    .rim { fill: none; stroke: var(--accent-brass); stroke-width: 1; opacity: 0.6; }
  `],
})
export class SeleinGlyphComponent {
  readonly cycleDay = input.required<number>();
  readonly size = input(48);

  protected readonly c = C;
  protected readonly r = R;

  /**
   * The lit region: the outer half-circle on the lit side, closed by the
   * terminator — a half-ellipse whose x-radius shrinks to nothing at the
   * quarters and swells to the full radius at new and full.
   */
  protected readonly lit = computed(() => {
    const p = this.cycleDay() / SELEIN_CYCLE_DAYS; // 0 new, 0.5 full
    const waxing = p < 0.5;
    const crescent = p < 0.25 || p > 0.75;
    const rx = Math.abs(R * Math.cos(2 * Math.PI * p));
    const outer = waxing ? 1 : 0;
    const term = waxing === crescent ? 0 : 1;
    return (
      `M ${C} ${C - R} A ${R} ${R} 0 0 ${outer} ${C} ${C + R} ` +
      `A ${rx} ${R} 0 0 ${term} ${C} ${C - R} Z`
    );
  });
}
