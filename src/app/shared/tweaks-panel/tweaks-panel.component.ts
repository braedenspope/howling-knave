import { Component, signal } from '@angular/core';
import { TweaksService, Metalwork, Density } from '../tweaks.service';

@Component({
  selector: 'app-tweaks-panel',
  standalone: true,
  imports: [],
  template: `
    <!-- compass watermark (toggled by the tweak) -->
    @if (tweaks.compass()) {
      <svg class="compass-watermark" viewBox="0 0 200 200" aria-hidden="true">
        <circle cx="100" cy="100" r="72" fill="none" stroke="currentColor" stroke-width="1" />
        <circle cx="100" cy="100" r="96" fill="none" stroke="currentColor" stroke-width="0.75" stroke-dasharray="2 5" />
        <polygon points="100,5 110,100 100,100 90,100" fill="currentColor" />
        <polygon points="195,100 100,110 100,100 100,90" fill="currentColor" />
        <polygon points="100,195 90,100 100,100 110,100" fill="currentColor" />
        <polygon points="5,100 100,90 100,100 100,110" fill="currentColor" />
        <polygon points="142.4,57.6 104.95,104.95 100,100 95.05,95.05" fill="none" stroke="currentColor" stroke-width="1.5" />
        <polygon points="142.4,142.4 95.05,104.95 100,100 104.95,95.05" fill="none" stroke="currentColor" stroke-width="1.5" />
        <polygon points="57.6,142.4 95.05,95.05 100,100 104.95,104.95" fill="none" stroke="currentColor" stroke-width="1.5" />
        <polygon points="57.6,57.6 104.95,95.05 100,100 95.05,104.95" fill="none" stroke="currentColor" stroke-width="1.5" />
        <circle cx="100" cy="100" r="7" fill="currentColor" />
      </svg>
    }

    <button class="tweaks-fab btn-icon" (click)="open.set(!open())" title="Tweaks" aria-label="Tweaks">
      <span class="ms">{{ open() ? 'close' : 'tune' }}</span>
    </button>

    @if (open()) {
      <div class="hk-card corners tweaks-panel fade-up">
        <p class="stamp-label" style="margin: 0 0 12px;">Tweaks</p>

        <div class="tweak-row">
          <label class="stamp-label">Texture intensity</label>
          <input type="range" min="0" max="1" step="0.1"
            [value]="tweaks.textureAlpha()" (input)="setTexture($event)" />
        </div>

        <div class="tweak-row">
          <label class="stamp-label">Metalwork</label>
          <div class="hk-tabs" style="border: none; margin: 0;">
            @for (m of metals; track m) {
              <button class="hk-tab" [class.on]="tweaks.metalwork() === m" (click)="tweaks.metalwork.set(m)">{{ m }}</button>
            }
          </div>
        </div>

        <div class="tweak-row">
          <label class="stamp-label">Board density</label>
          <div class="hk-tabs" style="border: none; margin: 0;">
            <button class="hk-tab" [class.on]="tweaks.density() === 'comfortable'" (click)="setDensity('comfortable')">Comfortable</button>
            <button class="hk-tab" [class.on]="tweaks.density() === 'compact'" (click)="setDensity('compact')">Compact</button>
          </div>
        </div>

        <div class="tweak-row toggle">
          <label class="stamp-label">Compass watermark</label>
          <button class="hk-tab" [class.on]="tweaks.compass()" (click)="tweaks.compass.set(!tweaks.compass())">
            {{ tweaks.compass() ? 'On' : 'Off' }}
          </button>
        </div>

        <button class="btn btn-ghost" style="margin-top: 8px; width: 100%;" (click)="tweaks.reset()">Reset to defaults</button>
      </div>
    }
  `,
  styleUrl: './tweaks-panel.component.scss',
})
export class TweaksPanelComponent {
  open = signal(false);
  metals: Metalwork[] = ['gold', 'copper', 'silver'];

  constructor(public tweaks: TweaksService) {}

  setTexture(e: Event) {
    this.tweaks.textureAlpha.set(+(e.target as HTMLInputElement).value);
  }
  setDensity(d: Density) {
    this.tweaks.density.set(d);
  }
}
