import { Component, OnInit, OnDestroy, effect, computed, signal } from '@angular/core';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { DayRowComponent } from '../../schedule/day-row/day-row.component';
import { DutyLedgerComponent } from '../../dm/duty-ledger/duty-ledger.component';
import { CrewManagerComponent } from '../../dm/crew-manager/crew-manager.component';
import { VoyageService } from '../voyage.service';
import { ScheduleService } from '../../schedule/schedule.service';
import { ConfirmationService } from '../../schedule/confirmation.service';
import { CorrectionService } from '../../dm/correction.service';
import { TrainingService } from '../../dm/training.service';
import { TrainingTrackerService } from '../../dm/training-tracker.service';
import { AuthService } from '../../../core/auth/auth.service';
import { PlayService } from '../../play/play.service';
import { StartVoyageDialogComponent } from '../../play/start-voyage-dialog/start-voyage-dialog.component';

@Component({
  selector: 'app-voyage-board',
  standalone: true,
  imports: [
    MatChipsModule,
    MatProgressSpinnerModule,
    DayRowComponent,
    DutyLedgerComponent,
    CrewManagerComponent,
  ],
  templateUrl: './voyage-board.component.html',
  styleUrl: './voyage-board.component.scss',
})
export class VoyageBoardComponent implements OnInit, OnDestroy {
  /** DM-only side drawer — Guner's Ledger or the crew roster, one at a time. */
  readonly drawer = signal<'ledger' | 'crew' | null>(null);
  readonly isDm = computed(() => this.auth.isDm());

  openDrawer(which: 'ledger' | 'crew') { this.drawer.set(which); }
  closeDrawer() { this.drawer.set(null); }

  /** DM: open the seal check and turn order, or rejoin a run already under way. */
  startVoyage() {
    if (this.play.isActive()) {
      this.router.navigate(['/play']);
      return;
    }
    this.dialog.open(StartVoyageDialogComponent, {
      width: '560px',
      maxWidth: '94vw',
      panelClass: 'hk-dialog',
    });
  }

  constructor(
    public voyageService: VoyageService,
    public scheduleService: ScheduleService,
    private confirmations: ConfirmationService,
    private corrections: CorrectionService,
    private trainingService: TrainingService,
    private tracker: TrainingTrackerService,
    public auth: AuthService,
    public play: PlayService,
    private dialog: MatDialog,
    private router: Router,
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
