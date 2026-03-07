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
  templateUrl: './voyage-board.component.html',
  styleUrl: './voyage-board.component.scss',
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
