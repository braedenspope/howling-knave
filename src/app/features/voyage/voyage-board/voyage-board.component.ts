import { Component, OnInit, OnDestroy, effect, computed } from '@angular/core';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { DayRowComponent } from '../../schedule/day-row/day-row.component';
import { VoyageService } from '../voyage.service';
import { ScheduleService } from '../../schedule/schedule.service';
import { TrainingService } from '../../dm/training.service';
import { AuthService } from '../../../core/auth/auth.service';
import { CREW_COLORS } from '../../../shared/data/training.data';

@Component({
  selector: 'app-voyage-board',
  standalone: true,
  imports: [
    MatChipsModule,
    MatProgressSpinnerModule,
    DayRowComponent,
  ],
  template: `
    @if (voyageService.loading()) {
      <div class="loading-container">
        <mat-spinner diameter="40"></mat-spinner>
      </div>
    } @else if (!voyageService.activeVoyage()) {
      <div class="empty-state">
        <h2 class="gold-text">No Active Voyage</h2>
        <p>Ask your DM to create or activate a voyage.</p>
      </div>
    } @else {
      <div class="board-container">
        <div class="player-legend">
          @for (user of scheduleService.allUsers(); track user.id) {
            <span class="player-chip">
              {{ user.character_name }}
            </span>
          }
        </div>

        <div class="day-list">
          @for (day of voyageService.days(); track day.id) {
            <app-day-row [day]="day" [users]="scheduleService.allUsers()" />
          }
        </div>
      </div>
    }
  `,
  styles: [`
    .loading-container {
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 64px;
    }

    .empty-state {
      text-align: center;
      padding: 64px 16px;

      p {
        color: var(--text-secondary);
      }
    }

    .board-container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 16px;
    }

    .player-legend {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      margin-bottom: 16px;
      padding: 12px;
      background: var(--bg-card);
      border: 1px solid var(--bg-card-border);
      border-radius: 8px;
    }

    .player-chip {
      font-size: 12px;
      padding: 4px 10px;
      border-radius: 12px;
      background: rgba(232, 213, 163, 0.1);
      color: var(--accent-gold);
      border: 1px solid rgba(232, 213, 163, 0.2);
    }

    .day-list {
      display: flex;
      flex-direction: column;
      gap: 0;
    }
  `],
})
export class VoyageBoardComponent implements OnInit, OnDestroy {
  constructor(
    public voyageService: VoyageService,
    public scheduleService: ScheduleService,
    private trainingService: TrainingService,
    private auth: AuthService,
  ) {
    // React to active voyage changes — load days and subscribe to blocks
    effect(async () => {
      const voyage = this.voyageService.activeVoyage();
      if (voyage) {
        await this.voyageService.loadDays(voyage.id);
        this.voyageService.subscribeToDays(voyage.id);
        this.scheduleService.subscribeToBlocks(voyage.id);

        // Load blocks once days are available
        const days = this.voyageService.days();
        if (days.length > 0) {
          const dayIds = days.map(d => d.id);
          await this.scheduleService.loadBlocks(dayIds);
        }
      }
    });
  }

  async ngOnInit() {
    await Promise.all([
      this.voyageService.loadVoyages(),
      this.scheduleService.loadAllUsers(),
      this.trainingService.loadCrewMembers(),
      this.trainingService.loadTrainings(),
    ]);

    this.voyageService.subscribeToVoyages();

    // Load days and blocks for active voyage
    const voyage = this.voyageService.activeVoyage();
    if (voyage) {
      await this.voyageService.loadDays(voyage.id);
      this.voyageService.subscribeToDays(voyage.id);
      this.scheduleService.subscribeToBlocks(voyage.id);
      const dayIds = this.voyageService.days().map(d => d.id);
      if (dayIds.length > 0) {
        await this.scheduleService.loadBlocks(dayIds);
      }
    }
  }

  ngOnDestroy() {
    this.voyageService.unsubscribe();
    this.scheduleService.unsubscribe();
  }
}
