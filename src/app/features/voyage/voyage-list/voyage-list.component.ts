import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DatePipe } from '@angular/common';
import { VoyageService } from '../voyage.service';
import { AuthService } from '../../../core/auth/auth.service';

@Component({
  selector: 'app-voyage-list',
  standalone: true,
  imports: [
    FormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatDividerModule,
    MatTooltipModule,
    DatePipe,
  ],
  template: `
    <div class="voyage-list-container">
      @if (auth.isDm()) {
        <mat-card class="create-card">
          <mat-card-header>
            <mat-card-title class="gold-text">Create New Voyage</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <form (ngSubmit)="onCreate()" class="create-form">
              <mat-form-field appearance="outline">
                <mat-label>Voyage Name</mat-label>
                <input matInput [(ngModel)]="newName" name="name" required />
              </mat-form-field>

              <mat-form-field appearance="outline" class="day-count-field">
                <mat-label>Days (1–30)</mat-label>
                <input matInput type="number" [(ngModel)]="newDayCount" name="dayCount"
                       min="1" max="30" required />
              </mat-form-field>

              <button mat-raised-button color="primary" type="submit" [disabled]="creating()">
                Create Voyage
              </button>
            </form>
            @if (error()) {
              <p class="error-text">{{ error() }}</p>
            }
          </mat-card-content>
        </mat-card>
        <mat-divider></mat-divider>
      }

      <h2 class="gold-text section-title">All Voyages</h2>

      @for (voyage of voyageService.voyages(); track voyage.id) {
        <mat-card class="voyage-card" [class.active-voyage]="voyage.is_active">
          <mat-card-header>
            <mat-card-title>{{ voyage.name }}</mat-card-title>
            <mat-card-subtitle>
              {{ voyage.day_count }} days &middot; {{ voyage.created_at | date:'mediumDate' }}
            </mat-card-subtitle>
          </mat-card-header>
          <mat-card-actions>
            @if (voyage.is_active) {
              <button mat-raised-button color="primary" (click)="openBoard()">
                <mat-icon>dashboard</mat-icon>
                Open Board
              </button>
            } @else if (auth.isDm()) {
              <button mat-stroked-button (click)="setActive(voyage.id)">
                Set Active
              </button>
              <button mat-icon-button color="warn" (click)="onDelete(voyage.id, voyage.name)"
                      matTooltip="Delete Voyage">
                <mat-icon>delete</mat-icon>
              </button>
            }
          </mat-card-actions>
        </mat-card>
      } @empty {
        <p class="empty-state">No voyages yet.</p>
      }
    </div>
  `,
  styles: [`
    .voyage-list-container {
      max-width: 900px;
      margin: 32px auto;
      padding: 0 24px;
    }

    .create-card {
      margin-bottom: 24px;
      border-radius: 2px !important;
    }

    .create-form {
      display: flex;
      gap: 12px;
      align-items: flex-start;
      flex-wrap: wrap;

      mat-form-field {
        flex: 1;
        min-width: 200px;
      }

      .day-count-field {
        max-width: 140px;
      }

      button {
        margin-top: 4px;
      }
    }

    .section-title {
      margin: 32px 0 16px;
      font-family: var(--font-heading);
      font-size: 24px;
      letter-spacing: 1px;
    }

    .voyage-card {
      margin-bottom: 16px;
      padding: 20px;
      transition: border-color 0.2s;
      border-radius: 2px !important;

      &.active-voyage {
        border-color: var(--accent-gold);
        box-shadow: 0 0 12px rgba(212,168,67,0.15);
      }

      mat-card-title {
        font-family: var(--font-heading);
        font-size: 20px;
        letter-spacing: 0.5px;
      }

      mat-card-subtitle {
        font-family: var(--font-data);
        font-size: 14px;
      }
    }

    .error-text {
      color: var(--failure-red);
      margin-top: 8px;
      font-size: 14px;
    }

    .empty-state {
      color: var(--text-secondary);
      text-align: center;
      padding: 32px 0;
      font-style: italic;
    }
  `],
})
export class VoyageListComponent implements OnInit {
  newName = '';
  newDayCount = 7;
  creating = signal(false);
  error = signal<string | null>(null);

  constructor(
    public voyageService: VoyageService,
    public auth: AuthService,
    private router: Router,
  ) {}

  ngOnInit() {
    this.voyageService.loadVoyages();
  }

  async onCreate() {
    this.creating.set(true);
    this.error.set(null);
    const err = await this.voyageService.createVoyage(this.newName, this.newDayCount);
    this.creating.set(false);
    if (err) {
      this.error.set(err);
    } else {
      this.newName = '';
      this.newDayCount = 7;
    }
  }

  async setActive(voyageId: string) {
    await this.voyageService.setActiveVoyage(voyageId);
  }

  async onDelete(voyageId: string, name: string) {
    if (!confirm(`Delete voyage "${name}"? This will remove all days and training blocks.`)) return;
    const err = await this.voyageService.deleteVoyage(voyageId);
    if (err) this.error.set(err);
  }

  openBoard() {
    this.router.navigate(['/board']);
  }
}
