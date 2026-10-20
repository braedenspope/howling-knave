import { Component, OnInit, effect, inject, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CrewService, CrewMemberInput } from '../../crew/crew.service';
import { TrainingService } from '../training.service';
import { VoyageService } from '../../voyage/voyage.service';
import { ScheduleService } from '../../schedule/schedule.service';
import { ToastService } from '../../../shared/toast.service';
import { CrewMember, Day, ScheduleBlock } from '../../../shared/models';

/** Swatches offered in the color picker — the ship's palette, plus any hex via the wheel. */
const PALETTE = [
  '#a63d2f', '#8b2500', '#b87333', '#c49a3c', '#8a6a3a', '#7a4a2a',
  '#5a8a4a', '#3a7a6a', '#2a6a5a', '#4a7a8a', '#2a4a6b', '#6b3a8b',
  '#8a4a6a', '#6a6a5a', '#9a8b78',
];

const HEX = /^#[0-9a-fA-F]{6}$/;

@Component({
  selector: 'app-crew-manager',
  standalone: true,
  imports: [FormsModule, NgTemplateOutlet],
  templateUrl: './crew-manager.component.html',
  styleUrl: './crew-manager.component.scss',
})
export class CrewManagerComponent implements OnInit {
  readonly crew = inject(CrewService);
  private trainings = inject(TrainingService);
  private voyages = inject(VoyageService);
  private schedule = inject(ScheduleService);
  private toast = inject(ToastService);

  readonly palette = PALETTE;

  // ----- roster editing -----
  /** The crewmate being edited, `'new'` while adding one, or null. */
  readonly editing = signal<number | 'new' | null>(null);
  form: CrewMemberInput = this.emptyForm();
  readonly saving = signal(false);

  // ----- availability grid -----
  readonly voyageList = this.voyages.voyages;
  readonly voyageId = signal<string | null>(null);
  readonly days = signal<Day[]>([]);
  /** Training blocks already on the board for the shown voyage — to flag clashes. */
  private readonly blocks = signal<ScheduleBlock[]>([]);

  constructor() {
    // Follow the active voyage until the DM picks another one.
    effect(() => {
      const active = this.voyages.activeVoyage();
      if (active && !this.voyageId()) this.showVoyage(active.id);
    });
  }

  async ngOnInit() {
    await Promise.all([
      this.crew.load(),
      this.trainings.loadTrainings(),
      this.voyages.voyages().length ? Promise.resolve() : this.voyages.loadVoyages(),
    ]);
  }

  // ----- roster -----

  trainingCount(m: CrewMember): number {
    return this.trainings.getTrainingsForCrew(m.id).length;
  }

  startAdd() {
    this.form = this.emptyForm();
    this.editing.set('new');
  }

  startEdit(m: CrewMember) {
    this.form = { name: m.name, role: m.role, color: m.color, line: m.line };
    this.editing.set(m.id);
  }

  cancelEdit() {
    this.editing.set(null);
  }

  validHex(color: string): boolean {
    return HEX.test(color);
  }

  canSave(): boolean {
    return !!this.form.name.trim() && this.validHex(this.form.color) && !this.saving();
  }

  async save() {
    const target = this.editing();
    if (target === null || !this.canSave()) return;

    this.saving.set(true);
    const renamed = target !== 'new' && this.crew.members().find(m => m.id === target)?.name !== this.form.name.trim();
    const err = target === 'new'
      ? await this.crew.create(this.form)
      : await this.crew.update(target, this.form);
    this.saving.set(false);

    if (err) {
      this.toast.warn(err);
      return;
    }
    // Trainings carry the crewmate's name from a join — refresh them after a rename.
    if (renamed) await this.trainings.loadTrainings();
    this.toast.show(target === 'new' ? `${this.form.name.trim()} has come aboard` : 'Crewmate updated');
    this.editing.set(null);
  }

  async remove(m: CrewMember) {
    const count = this.trainingCount(m);
    const ok = confirm(
      `Remove ${m.name} from the crew?\n\n` +
      `This deletes their ${count} training${count === 1 ? '' : 's'}, every player's standing and ` +
      `progress with them, and any of their unrolled blocks on the board. Blocks already rolled stay as history.\n\n` +
      `This can't be undone.`,
    );
    if (!ok) return;
    const err = await this.crew.remove(m.id);
    if (err) {
      this.toast.warn(err);
      return;
    }
    if (this.editing() === m.id) this.editing.set(null);
    await this.trainings.loadTrainings();
    this.toast.show(`${m.name} has left the ship`);
  }

  async move(m: CrewMember, direction: -1 | 1) {
    const err = await this.crew.move(m.id, direction);
    if (err) this.toast.warn(err);
  }

  // ----- availability -----

  async showVoyage(voyageId: string) {
    this.voyageId.set(voyageId);
    const days = await this.voyages.loadDaysForVoyage(voyageId);
    this.days.set(days);
    this.blocks.set(await this.schedule.loadBlocksByDayIds(days.map(d => d.id)));
  }

  isBlocked(m: CrewMember, day: Day): boolean {
    return this.crew.unavailableOn(m.name, day.id) !== undefined;
  }

  /** Trainings with this crewmate already on the board for the day. */
  bookedCount(m: CrewMember, day: Day): number {
    return this.blocks().filter(b => b.day_id === day.id && !b.is_mandatory && b.crew_member === m.name).length;
  }

  async toggle(m: CrewMember, day: Day) {
    const err = this.isBlocked(m, day)
      ? await this.crew.unblock(m.id, day.id)
      : await this.crew.block(m.id, day.id);
    if (err) this.toast.warn(err);
  }

  private emptyForm(): CrewMemberInput {
    const used = new Set(this.crew.members().map(m => m.color));
    return { name: '', role: '', color: PALETTE.find(c => !used.has(c)) ?? PALETTE[0], line: '' };
  }
}
