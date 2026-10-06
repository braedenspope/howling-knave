import { Component, OnInit, computed, signal, input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { VoyageService } from '../../voyage/voyage.service';
import { ScheduleService } from '../../schedule/schedule.service';
import { CorrectionService } from '../correction.service';
import { RelationshipService } from '../relationship.service';
import { TrainingService } from '../training.service';
import { Day } from '../../../shared/models';
import { ToastService } from '../../../shared/toast.service';
import { CREW_LIST, CREW_COLORS, TIER_NAMES, TIER_COLORS } from '../../../shared/data/training.data';

@Component({
  selector: 'app-duty-ledger',
  standalone: true,
  imports: [FormsModule],
  template: `
    <p class="dm-hint">
      Guner Aldric tracks who carries their weight. When someone leans on the crew too long, he acts:
      their training is barred for a day and half their watch (4 of 8 hours) goes to ship duties.
      It is not a punishment from the DM — it is Guner being Guner.
    </p>

    <div class="section-title">
      <div class="section-title-row"><h2>The crew's ledger</h2></div>
      <div class="rope-divider"></div>
    </div>
    <div class="ledger-grid">
      @for (p of ledger(); track p.id) {
        <div class="hk-card corners ledger-card" [class.suspicious]="p.received >= 2">
          <div class="crew-rel-head">
            <span class="character-name">{{ p.name }}</span>
          </div>
          <div class="duty-chip-list">
            <span class="duty-chip-dm"><strong>{{ p.given }}</strong> covered for others</span>
            <span class="duty-chip-dm"><strong>{{ p.received }}</strong> duties covered by others</span>
          </div>
          @if (p.received >= 2) {
            <p class="ledger-note">Guner has noticed {{ p.name.split(' ')[0] }} letting the crew carry their watch.</p>
          }
          <div style="display: flex; gap: 8px; align-items: flex-end; margin-top: 12px; flex-wrap: wrap;">
            <div class="hk-field" style="flex: 1; min-width: 120px;">
              <label>Correction day</label>
              <select [ngModel]="selectedDay()[p.id] ?? ''" (ngModelChange)="setDay(p.id, $event)">
                <option value="" disabled>Pick a day</option>
                @for (d of days(); track d.id) {
                  <option [value]="d.id">Day {{ d.day_number }}{{ correction.isCorrected(d.id, p.id) ? ' · on detail' : '' }}</option>
                }
              </select>
            </div>
            @if (selectedDay()[p.id] && correction.isCorrected(selectedDay()[p.id]!, p.id)) {
              <button class="btn btn-ghost" (click)="clear(p.id)">Lift correction</button>
            } @else {
              <button class="btn btn-danger" [disabled]="!selectedDay()[p.id]" (click)="intervene(p.id, p.name)">
                <span class="ms sm">gavel</span> Guner intervenes
              </button>
            }
          </div>

          <!-- crew standing: the DM's quick relationship dial -->
          <button class="standing-toggle" (click)="toggleStanding(p.id)" [attr.aria-expanded]="isStandingOpen(p.id)">
            <span class="ms sm">{{ isStandingOpen(p.id) ? 'expand_less' : 'expand_more' }}</span>
            Crew standing
            <span class="standing-sum">{{ unlockedCount(p.id) }}/{{ totalTrainings() }} trainings open</span>
          </button>
          @if (isStandingOpen(p.id)) {
            <div class="standing-list">
              @for (crew of crewList; track crew) {
                @let tier = tierOf(p.id, crew);
                <div class="standing-row">
                  <span class="crew-dot" [style.background]="crewColor(crew)"></span>
                  <span class="standing-name" [title]="crew">{{ crew.split(' ')[0] }}</span>
                  <div class="standing-pips">
                    <button class="refuse-pip" [class.on]="tier === 0"
                      [style.background]="tier === 0 ? tierColor(0) : null"
                      [style.border-color]="tier === 0 ? tierColor(0) : null"
                      (click)="setTier(p.id, p.name, crew, 0)" [title]="tierName(0) + ' — refuses to train'">
                      <span class="ms">block</span>
                    </button>
                    @for (pip of tierPips; track pip) {
                      <button class="tier-pip"
                        [style.background]="pip <= tier ? tierColor(pip) : null"
                        [style.border-color]="pip <= tier ? tierColor(pip) : null"
                        (click)="setTier(p.id, p.name, crew, pip)" [title]="tierName(pip)"></button>
                    }
                  </div>
                  <span class="standing-tier" [style.color]="tierColor(tier)">{{ tierName(tier) }}</span>
                  <span class="standing-open" [title]="'Trainings open with ' + crew">{{ openWith(p.id, crew) }}</span>
                </div>
              }
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    :host { display: block; }

    .standing-toggle {
      display: flex; align-items: center; gap: 6px; width: 100%;
      margin-top: 14px; padding: 8px 0 0;
      border: none; border-top: 1px solid var(--bg-card-border);
      background: none; color: var(--accent-gold); cursor: pointer;
      font-family: var(--font-heading); font-size: 13px; letter-spacing: 0.3px;
      text-align: left;
    }
    .standing-sum {
      margin-left: auto;
      font-family: var(--font-data); font-size: 11px; color: var(--text-secondary);
    }

    .standing-list { display: flex; flex-direction: column; gap: 2px; margin-top: 8px; }
    .standing-row {
      display: grid;
      grid-template-columns: 8px 58px auto 1fr 26px;
      align-items: center; gap: 8px;
      padding: 3px 0;
    }
    .standing-name {
      font-family: var(--font-heading); font-size: 12px; color: var(--text-primary);
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .standing-pips { display: flex; align-items: center; gap: 4px; }
    .tier-pip, .refuse-pip {
      width: 15px; height: 15px; padding: 0; border-radius: 50%;
      border: 2px solid var(--bg-card-border);
      background: rgba(15, 11, 7, 0.6);
      cursor: pointer; transition: transform 0.12s;
    }
    .tier-pip:hover, .refuse-pip:hover { transform: scale(1.2); }
    .refuse-pip {
      display: flex; align-items: center; justify-content: center;
      color: var(--text-faint); margin-right: 3px;
    }
    .refuse-pip .ms { font-size: 11px; }
    .refuse-pip.on { color: var(--text-primary); }
    .standing-tier { font-family: var(--font-data); font-size: 11px; white-space: nowrap; }
    .standing-open {
      font-family: var(--font-data); font-size: 11px; color: var(--text-secondary); text-align: right;
    }
  `],
})
export class DutyLedgerComponent implements OnInit {
  /**
   * When embedded on the board, the host already loads (and live-subscribes to)
   * voyages, users, corrections, days, and blocks. Re-fetching here would toggle
   * the board's shared `loading` signal and thrash this panel, so we skip it.
   */
  embedded = input(false);

  days = signal<Day[]>([]);
  selectedDay = signal<Record<string, string | undefined>>({});

  readonly crewList = CREW_LIST;
  readonly tierPips = [1, 2, 3, 4, 5];
  private openStanding = signal<Set<string>>(new Set());

  constructor(
    private voyageService: VoyageService,
    private scheduleService: ScheduleService,
    public correction: CorrectionService,
    private relationships: RelationshipService,
    private trainings: TrainingService,
    private toast: ToastService,
  ) {}

  async ngOnInit() {
    // Tiers and trainings aren't part of the board's shared load — fetch them
    // here either way. The app shell keeps tiers live from then on.
    this.relationships.loadAllTiers();
    if (this.trainings.trainings().length === 0) this.trainings.loadTrainings();

    if (this.embedded()) {
      // Mirror the day list the board already loaded; don't re-fetch anything.
      const days = this.voyageService.days();
      if (days.length) {
        this.days.set(days);
      } else {
        const voyage = this.voyageService.activeVoyage();
        if (voyage) this.days.set(await this.voyageService.loadDaysForVoyage(voyage.id));
      }
      return;
    }

    await Promise.all([
      this.voyageService.loadVoyages(),
      this.scheduleService.loadAllUsers(),
      this.correction.loadAll(),
    ]);
    const voyage = this.voyageService.activeVoyage();
    if (voyage) {
      const days = await this.voyageService.loadDaysForVoyage(voyage.id);
      this.days.set(days);
      await this.scheduleService.loadBlocks(days.map(d => d.id));
    }
  }

  ledger = computed(() => {
    const blocks = this.scheduleService.blocks();
    return this.scheduleService.allUsers().map(u => ({
      id: u.id,
      name: u.character_name,
      // duties this player is carrying that originally belonged to someone else
      given: blocks.filter(b => b.is_mandatory && b.user_id === u.id && b.covered_by && b.covered_by !== u.id).length,
      // this player's own duties now carried by someone else
      received: blocks.filter(b => b.is_mandatory && b.covered_by === u.id && b.user_id !== u.id).length,
    }));
  });

  // ---- crew standing ----------------------------------------------------

  toggleStanding(userId: string) {
    this.openStanding.update(set => {
      const next = new Set(set);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }
  isStandingOpen(userId: string): boolean {
    return this.openStanding().has(userId);
  }

  tierOf(userId: string, crew: string): number {
    return this.relationships.getTierForCrewMember(userId, crew);
  }
  tierName(tier: number): string {
    return TIER_NAMES[tier] ?? 'Unknown';
  }
  tierColor(tier: number): string {
    return TIER_COLORS[tier] ?? '#5a5040';
  }
  crewColor(crew: string): string {
    return CREW_COLORS[crew] ?? '#666';
  }

  totalTrainings = computed(() => this.trainings.trainings().length);

  /** "2/3" — how many of this crewmate's trainings the player's tier opens. */
  openWith(userId: string, crew: string): string {
    const list = this.trainings.getTrainingsForCrewByName(crew);
    const tier = this.tierOf(userId, crew);
    return `${list.filter(t => t.tier_required <= tier).length}/${list.length}`;
  }

  unlockedCount(userId: string): number {
    return this.trainings.trainings()
      .filter(t => t.tier_required <= this.tierOf(userId, t.crew_member_name)).length;
  }

  async setTier(userId: string, name: string, crew: string, tier: number) {
    if (this.tierOf(userId, crew) === tier) return;
    const err = await this.relationships.setTier(userId, crew, tier);
    if (err) {
      this.toast.warn(err);
      return;
    }
    const who = name.split(' ')[0];
    this.toast.show(
      tier === 0
        ? `${crew} won't train ${who} for now`
        : `${who} and ${crew.split(' ')[0]} — ${this.tierName(tier)}`,
    );
  }

  setDay(userId: string, dayId: string) {
    this.selectedDay.update(m => ({ ...m, [userId]: dayId }));
  }

  async intervene(userId: string, name: string) {
    const dayId = this.selectedDay()[userId];
    if (!dayId) return;
    await this.correction.setCorrection(dayId, userId, "Guner's correction detail");
    await this.scheduleService.assignCorrectionDuties(dayId, userId);
    const day = this.days().find(d => d.id === dayId);
    this.toast.show(`Guner has words for ${name.split(' ')[0]}. Day ${day?.day_number}: training barred, half the day on ship duties.`);
  }

  async clear(userId: string) {
    const dayId = this.selectedDay()[userId];
    if (!dayId) return;
    await this.correction.clear(dayId, userId);
    this.toast.show('Correction lifted — back to normal scheduling.');
  }
}
