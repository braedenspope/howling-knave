import { Component, OnInit, computed, signal } from '@angular/core';
import { VoyageService } from '../../voyage/voyage.service';
import { ScheduleService } from '../../schedule/schedule.service';
import { SpotlightService } from '../spotlight.service';
import { CREW_COLORS } from '../../../shared/data/training.data';
import { ScheduleBlock } from '../../../shared/models';
import { ToastService } from '../../../shared/toast.service';

interface FlaggedSession {
  block: ScheduleBlock;
  playerName: string;
}

@Component({
  selector: 'app-spotlight-tracker',
  standalone: true,
  imports: [],
  template: `
    <p class="dm-hint">
      Players flag sessions they want played out at the table. Pick one per voyage window — the
      rotation below keeps the spotlight fair (no one should wait more than two voyages).
    </p>

    <div class="section-title">
      <div class="section-title-row"><h2>Rotation</h2></div>
      <div class="rope-divider"></div>
    </div>
    <div class="rotation-grid">
      @for (p of rotation(); track p.id) {
        <div class="hk-card corners rotation-card" [class.overdue]="p.overdue">
          <span class="ms" [style.color]="p.overdue ? 'var(--failure-red)' : 'var(--accent-gold)'">{{ p.overdue ? 'priority_high' : 'theater_comedy' }}</span>
          <div>
            <span class="character-name">{{ p.name }}</span>
            <span class="stamp-label" style="display: block;">
              {{ p.since === null ? 'No spotlight yet' : p.since === 0 ? 'Spotlit this voyage' : p.since + ' voyage' + (p.since === 1 ? '' : 's') + ' since spotlight' }}
              {{ p.overdue ? ' · overdue' : '' }}
            </span>
          </div>
        </div>
      }
    </div>

    <div class="section-title">
      <div class="section-title-row"><h2>Flagged sessions</h2></div>
      <div class="rope-divider"></div>
    </div>
    @if (flagged().length === 0) {
      <div class="empty-state"><span class="ms">flag</span><p>No sessions flagged this voyage. Pick by narrative weight, or wait for a player to raise the pennant.</p></div>
    } @else {
      <div style="display: flex; flex-direction: column; gap: 8px;">
        @for (f of flagged(); track f.block.id) {
          <div class="outcome-row" [class.chosen]="isChosen(f.block.id)">
            <div class="outcome-info">
              <span class="flagged-tag"><span class="ms sm">flag</span> Flagged</span>
              <span class="crew-dot" [style.background]="crewColor(f.block.crew_member)"></span>
              <span class="character-name" style="font-size: 15px;">{{ f.playerName }}</span>
              <span class="block-topic" style="-webkit-line-clamp: 1;">{{ f.block.training_topic }}</span>
            </div>
            <div class="outcome-actions">
              @if (isChosen(f.block.id)) {
                <span class="chosen-tag"><span class="ms sm">check</span> On the table</span>
              } @else {
                <button class="btn btn-copper" (click)="choose(f)"><span class="ms sm">play_arrow</span> Play it at the table</button>
              }
            </div>
          </div>
        }
      </div>
    }
  `,
  styles: [':host { display: block; }'],
})
export class SpotlightTrackerComponent implements OnInit {
  private chosenIds = signal<Set<string>>(new Set());

  constructor(
    private voyageService: VoyageService,
    private scheduleService: ScheduleService,
    private spotlight: SpotlightService,
    private toast: ToastService,
  ) {}

  async ngOnInit() {
    await Promise.all([
      this.voyageService.loadVoyages(),
      this.scheduleService.loadAllUsers(),
      this.spotlight.loadAll(),
    ]);
    const voyage = this.voyageService.activeVoyage();
    if (voyage) {
      const days = await this.voyageService.loadDaysForVoyage(voyage.id);
      await this.scheduleService.loadBlocks(days.map(d => d.id));
    }
  }

  crewColor(name: string): string { return CREW_COLORS[name] ?? '#666'; }

  rotation = computed(() => {
    this.spotlight.log();
    const voyages = this.voyageService.voyages();
    return this.scheduleService.allUsers().map(u => {
      const since = this.spotlight.voyagesSinceSpotlight(u.id, voyages);
      return {
        id: u.id,
        name: u.character_name,
        since: since === Infinity ? null : since,
        overdue: this.spotlight.isOverdue(u.id, voyages),
      };
    });
  });

  flagged = computed<FlaggedSession[]>(() => {
    const users = this.scheduleService.allUsers();
    return this.scheduleService.blocks()
      .filter(b => b.spotlight && !b.is_mandatory && b.crew_member !== 'Independent')
      .map(b => ({ block: b, playerName: users.find(u => u.id === b.user_id)?.character_name ?? 'Unknown' }));
  });

  isChosen(blockId: string): boolean { return this.chosenIds().has(blockId); }

  async choose(f: FlaggedSession) {
    const voyage = this.voyageService.activeVoyage();
    if (!voyage) return;
    await this.spotlight.choose(f.block.user_id, voyage.id, f.block.id);
    this.chosenIds.update(s => new Set(s).add(f.block.id));
    this.toast.show(`Spotlight — ${f.playerName}'s "${f.block.training_topic}" plays at the table`);
  }
}
