import { Component, effect, signal } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from './core/auth/auth.service';
import { VoyageService } from './features/voyage/voyage.service';
import { PlayService } from './features/play/play.service';
import { RelationshipService } from './features/dm/relationship.service';
import { TweaksPanelComponent } from './shared/tweaks-panel/tweaks-panel.component';
import { DutyRequestModalsComponent } from './features/schedule/duty-request-modals/duty-request-modals.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    TweaksPanelComponent,
    DutyRequestModalsComponent,
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  menuOpen = signal(false);

  /** The voyage whose play state is already subscribed to. */
  private watchedVoyageId: string | null = null;

  constructor(
    public auth: AuthService,
    public voyageService: VoyageService,
    public play: PlayService,
    private relationships: RelationshipService,
  ) {
    // Own the play-state subscription at the shell so the nav link — and every
    // player's screen — follows the DM's cursor without visiting /play first.
    // Guarded on the id: reloading the voyage list hands back a fresh object
    // each time, and re-subscribing on every one of those would churn channels.
    effect(() => {
      const voyage = this.voyageService.activeVoyage();
      if (!this.auth.isAuthed() || !voyage || voyage.id === this.watchedVoyageId) return;
      this.watchedVoyageId = voyage.id;
      this.play.load(voyage.id);
      this.play.subscribe(voyage.id);
    });

    // Relationship tiers gate which trainings a player can book; follow them
    // live so a DM's adjustment lands on every screen at once.
    effect(() => {
      if (this.auth.isAuthed()) this.relationships.subscribe();
      else this.relationships.unsubscribe();
    });
  }

  toggleMenu() {
    this.menuOpen.update(v => !v);
  }

  closeMenu() {
    this.menuOpen.set(false);
  }
}
