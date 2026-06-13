import { Component, OnInit, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { VoyageService } from '../../voyage/voyage.service';
import { ScheduleService } from '../../schedule/schedule.service';
import { CorrectionService } from '../correction.service';
import { Day } from '../../../shared/models';
import { ToastService } from '../../../shared/toast.service';

@Component({
  selector: 'app-duty-ledger',
  standalone: true,
  imports: [FormsModule],
  template: `
    <p class="dm-hint">
      Guner Aldric tracks who carries their weight. When someone leans on the crew too long, he acts:
      lock their training for a day. It is not a punishment from the DM — it is Guner being Guner.
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
        </div>
      }
    </div>
  `,
  styles: [':host { display: block; }'],
})
export class DutyLedgerComponent implements OnInit {
  days = signal<Day[]>([]);
  selectedDay = signal<Record<string, string | undefined>>({});

  constructor(
    private voyageService: VoyageService,
    private scheduleService: ScheduleService,
    public correction: CorrectionService,
    private toast: ToastService,
  ) {}

  async ngOnInit() {
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

  setDay(userId: string, dayId: string) {
    this.selectedDay.update(m => ({ ...m, [userId]: dayId }));
  }

  async intervene(userId: string, name: string) {
    const dayId = this.selectedDay()[userId];
    if (!dayId) return;
    await this.correction.setCorrection(dayId, userId, "Guner's correction detail");
    const day = this.days().find(d => d.id === dayId);
    this.toast.show(`Guner has words for ${name.split(' ')[0]}. Day ${day?.day_number} training is locked.`);
  }

  async clear(userId: string) {
    const dayId = this.selectedDay()[userId];
    if (!dayId) return;
    await this.correction.clear(dayId, userId);
    this.toast.show('Correction lifted — back to normal scheduling.');
  }
}
