import { Component } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from './core/auth/auth.service';
import { VoyageService } from './features/voyage/voyage.service';

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
  ],
  template: `
    @if (auth.isAuthed()) {
      <mat-toolbar class="app-nav">
        <span class="app-title gold-text" routerLink="/board">The Last Weaving</span>
        @if (voyageService.activeVoyage(); as voyage) {
          <span class="voyage-name">{{ voyage.name }}</span>
        }
        <span class="spacer"></span>
        <nav class="nav-links">
          <a mat-button routerLink="/board" routerLinkActive="active-link">
            <mat-icon>dashboard</mat-icon>
            <span class="nav-label">Board</span>
          </a>
          <a mat-button routerLink="/voyages" routerLinkActive="active-link">
            <mat-icon>sailing</mat-icon>
            <span class="nav-label">Voyages</span>
          </a>
          <a mat-button routerLink="/progress" routerLinkActive="active-link">
            <mat-icon>trending_up</mat-icon>
            <span class="nav-label">Progress</span>
          </a>
          @if (auth.isDm()) {
            <a mat-button routerLink="/dm" routerLinkActive="active-link">
              <mat-icon>shield</mat-icon>
              <span class="nav-label">DM</span>
            </a>
          }
        </nav>
        <span class="character-chip">{{ auth.profile()?.character_name }}</span>
        <button mat-icon-button (click)="auth.logout()" aria-label="Logout">
          <mat-icon>logout</mat-icon>
        </button>
      </mat-toolbar>
    }
    <main>
      <router-outlet />
    </main>
  `,
  styles: [`
    .app-nav {
      background: var(--bg-nav);
      background-image: var(--wood-grain);
      border-bottom: 3px solid var(--accent-brass);
      box-shadow: 0 2px 8px rgba(0,0,0,0.5), inset 0 -1px 0 rgba(196,154,60,0.2);
      position: sticky;
      top: 0;
      z-index: 100;
    }

    .app-title {
      font-family: var(--font-heading);
      font-size: 18px;
      font-weight: 700;
      cursor: pointer;
      margin-right: 16px;
      letter-spacing: 1px;
      text-shadow: 0 1px 3px rgba(0,0,0,0.5);
    }

    .voyage-name {
      font-family: var(--font-data);
      font-size: 12px;
      color: var(--text-secondary);
      padding: 2px 10px;
      border-radius: 2px;
      border: 1px solid var(--bg-card-border);
    }

    .nav-links {
      display: flex;
      gap: 4px;
    }

    .nav-label {
      margin-left: 4px;
      font-family: var(--font-heading);
      font-size: 12px;
      letter-spacing: 0.5px;
    }

    .active-link {
      color: var(--accent-gold) !important;
    }

    .character-chip {
      font-family: var(--font-data);
      font-size: 11px;
      padding: 4px 10px;
      border-radius: 2px;
      background: rgba(196,154,60,0.1);
      color: var(--accent-gold);
      border: 1px solid rgba(196,154,60,0.2);
      margin: 0 8px;
    }

    main {
      min-height: calc(100vh - 64px);
    }

    @media (max-width: 600px) {
      .nav-label {
        display: none;
      }

      .voyage-name {
        display: none;
      }

      .app-title {
        font-size: 14px;
        margin-right: 8px;
      }
    }
  `],
})
export class App {
  constructor(
    public auth: AuthService,
    public voyageService: VoyageService,
  ) {}
}
