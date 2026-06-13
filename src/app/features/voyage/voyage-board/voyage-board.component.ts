import { Component, OnInit, OnDestroy, effect, computed } from '@angular/core';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { DayRowComponent } from '../../schedule/day-row/day-row.component';
import { VoyageService } from '../voyage.service';
import { ScheduleService } from '../../schedule/schedule.service';
import { ConfirmationService } from '../../schedule/confirmation.service';
import { CorrectionService } from '../../dm/correction.service';
import { TrainingService } from '../../dm/training.service';
import { TrainingTrackerService } from '../../dm/training-tracker.service';
import { AuthService } from '../../../core/auth/auth.service';

@Component({
  selector: 'app-voyage-board',
  standalone: true,
  imports: [
    MatChipsModule,
    MatProgressSpinnerModule,
    DayRowComponent,
  ],
  templateUrl: './voyage-board.component.html',
  styleUrl: './voyage-board.component.scss',
})
export class VoyageBoardComponent implements OnInit, OnDestroy {
  constructor(
    public voyageService: VoyageService,
    public scheduleService: ScheduleService,
    private confirmations: ConfirmationService,
    private corrections: CorrectionService,
    private trainingService: TrainingService,
    private tracker: TrainingTrackerService,
    private auth: AuthService,
  ) {
    // React to active voyage changes — load days and subscribe to blocks
    effect(async () => {
      const voyage = this.voyageService.activeVoyage();
      if (voyage) {
        await this.voyageService.loadDays(voyage.id);
        this.voyageService.subscribeToDays(voyage.id);
        this.scheduleService.subscribeToBlocks(voyage.id);
        this.confirmations.subscribe(voyage.id);
        this.corrections.subscribe();

        // Load blocks once days are available
        const days = this.voyageService.days();
        if (days.length > 0) {
          const dayIds = days.map(d => d.id);
          await Promise.all([
            this.scheduleService.loadBlocks(dayIds),
            this.confirmations.load(dayIds),
          ]);
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
      this.tracker.loadAllProgress(),
      this.corrections.loadAll(),
    ]);

    this.voyageService.subscribeToVoyages();

    // Load days and blocks for active voyage
    const voyage = this.voyageService.activeVoyage();
    if (voyage) {
      await this.voyageService.loadDays(voyage.id);
      this.voyageService.subscribeToDays(voyage.id);
      this.scheduleService.subscribeToBlocks(voyage.id);
      this.confirmations.subscribe(voyage.id);
      this.corrections.subscribe();
      const dayIds = this.voyageService.days().map(d => d.id);
      if (dayIds.length > 0) {
        await Promise.all([
          this.scheduleService.loadBlocks(dayIds),
          this.confirmations.load(dayIds),
        ]);
      }
    }
  }

  ngOnDestroy() {
    this.voyageService.unsubscribe();
    this.scheduleService.unsubscribe();
    this.confirmations.unsubscribe();
    this.corrections.unsubscribe();
  }
}
