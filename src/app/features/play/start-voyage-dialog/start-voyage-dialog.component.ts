import { Component } from '@angular/core';
import { MatDialogModule } from '@angular/material/dialog';
import { PlaySetupComponent } from '../play-setup/play-setup.component';

/** The board's "Start voyage" gate — the seal check and turn order, in a dialog. */
@Component({
  selector: 'app-start-voyage-dialog',
  standalone: true,
  imports: [MatDialogModule, PlaySetupComponent],
  template: `
    <div class="sv-modal">
      <button class="sv-close" mat-dialog-close aria-label="Close"><span class="ms">close</span></button>
      <h2 class="sv-title gold-text">Start voyage</h2>
      <app-play-setup [embedded]="true" />
    </div>
  `,
  styles: [`
    .sv-modal { position: relative; padding: 8px 6px 6px; }
    .sv-close {
      position: absolute; top: -4px; right: -4px;
      background: none; border: none; color: var(--text-secondary);
      cursor: pointer; padding: 6px; line-height: 0; border-radius: 50%;
    }
    .sv-close:hover { color: var(--accent-gold); }
    .sv-close .ms { font-size: 24px; }
    .sv-title { margin: 0 0 12px; font-size: 28px; letter-spacing: 0.5px; padding-right: 30px; }
  `],
})
export class StartVoyageDialogComponent {}
