import { Component, OnInit, signal, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { TrainingService, HiddenBonusInput } from '../training.service';
import {
  TrainingWithCrew,
  TrainingTag,
  TRAINING_TAGS,
  RollCheck,
  thresholdForTier,
} from '../../../shared/models';
import { CrewService } from '../../crew/crew.service';

interface TrainingForm {
  topic: string;
  description: string;
  reward: string;
  scene_seed: string;
  narrative_thread: string;
  tier_required: number;
  tags: TrainingTag[];
  /** One entry per training point, blank where unset; may run past the tier's goal. */
  roll_checks: RollCheck[];
  hidden_character: string;
  hidden_body: string;
}

@Component({
  selector: 'app-training-editor',
  standalone: true,
  imports: [
    FormsModule,
    MatExpansionModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatDividerModule,
  ],
  templateUrl: './training-editor.component.html',
  styleUrl: './training-editor.component.scss',
})
export class TrainingEditorComponent implements OnInit {
  readonly crew = inject(CrewService);
  editingId = signal<string | null>(null);
  addingForCrew = signal<number | null>(null);

  readonly tagOptions = TRAINING_TAGS;

  editForm: TrainingForm = this.emptyForm();
  addForm: TrainingForm = this.emptyForm();

  constructor(public trainingService: TrainingService) {}

  async ngOnInit() {
    await this.trainingService.loadTrainings();
  }

  getCrewColor(name: string): string {
    return this.crew.colorOf(name);
  }

  /** Points a training at this tier asks for — 12 per tier, never hand-set. */
  thresholdFor(tier: number): number {
    return thresholdForTier(Number(tier) || 1);
  }

  private emptyForm(): TrainingForm {
    return {
      topic: '',
      description: '',
      reward: '',
      scene_seed: '',
      narrative_thread: '',
      tier_required: 1,
      tags: [],
      roll_checks: this.rollSlots([]),
      hidden_character: '',
      hidden_body: '',
    };
  }

  startEdit(training: TrainingWithCrew) {
    this.editingId.set(training.id);
    this.editForm = {
      topic: training.topic,
      description: training.description,
      reward: training.reward,
      scene_seed: training.scene_seed ?? '',
      narrative_thread: training.narrative_thread ?? '',
      tier_required: training.tier_required,
      tags: [...training.tags],
      roll_checks: this.rollSlots(training.roll_checks),
      hidden_character: training.hidden_bonus?.character_name ?? '',
      hidden_body: training.hidden_bonus?.body ?? '',
    };
  }

  cancelEdit() {
    this.editingId.set(null);
  }

  private buildHiddenBonus(form: TrainingForm): HiddenBonusInput | null {
    if (!form.hidden_character.trim()) return null;
    return { character_name: form.hidden_character.trim(), body: form.hidden_body.trim() };
  }

  private rollSlots(saved: RollCheck[]): RollCheck[] {
    return saved.map(r => ({ check: r.check ?? '', dc: r.dc ?? null }));
  }

  /**
   * One editable slot per point the training's tier asks for. Grows the form's
   * list in place when the tier goes up; slots past a lowered tier are kept
   * until save, so nudging the tier down and back up loses nothing.
   */
  pointSlots(form: TrainingForm): RollCheck[] {
    const count = this.thresholdFor(form.tier_required);
    while (form.roll_checks.length < count) form.roll_checks.push({ check: '', dc: null });
    return form.roll_checks.slice(0, count);
  }

  /** Copy each filled check down into the blank points after it. */
  fillDown(form: TrainingForm) {
    let last: RollCheck | null = null;
    for (const r of this.pointSlots(form)) {
      if (r.check.trim() || r.dc !== null) last = r;
      else if (last) Object.assign(r, { check: last.check, dc: last.dc });
    }
  }

  /** Clean the form's slots for saving: cut to the tier's goal, drop blanks off the end. */
  private cleanRollChecks(form: TrainingForm): RollCheck[] {
    const cleaned = this.pointSlots(form).map(r => {
      const dc = Number(r.dc);
      return { check: r.check.trim(), dc: r.dc === null || `${r.dc}`.trim() === '' || !Number.isFinite(dc) ? null : dc };
    });
    while (cleaned.length && !cleaned[cleaned.length - 1].check && cleaned[cleaned.length - 1].dc === null) {
      cleaned.pop();
    }
    return cleaned;
  }

  /** How many of the training's points have a check set. */
  checksSet(training: TrainingWithCrew): number {
    return training.roll_checks.filter(r => r.check || r.dc !== null).length;
  }

  private trainingFields(form: TrainingForm) {
    const tier = Number(form.tier_required) || 1;
    return {
      topic: form.topic,
      description: form.description,
      reward: form.reward,
      scene_seed: form.scene_seed.trim() || null,
      narrative_thread: form.narrative_thread.trim() || null,
      tier_required: tier,
      threshold_pp: thresholdForTier(tier),
      tags: form.tags,
      roll_checks: this.cleanRollChecks(form),
    };
  }

  tagLabel(tag: TrainingTag): string {
    return TRAINING_TAGS.find(t => t.id === tag)?.label ?? tag;
  }

  toggleTag(form: TrainingForm, tag: TrainingTag) {
    form.tags = form.tags.includes(tag)
      ? form.tags.filter(t => t !== tag)
      : TRAINING_TAGS.map(t => t.id).filter(t => t === tag || form.tags.includes(t));
  }

  async saveEdit(id: string) {
    await this.trainingService.updateTraining(
      id,
      this.trainingFields(this.editForm),
      this.buildHiddenBonus(this.editForm),
    );
    this.editingId.set(null);
  }

  async deleteTraining(id: string) {
    await this.trainingService.deleteTraining(id);
    this.editingId.set(null);
  }

  startAdd(crewId: number) {
    this.addingForCrew.set(crewId);
    this.addForm = this.emptyForm();
  }

  cancelAdd() {
    this.addingForCrew.set(null);
  }

  async saveNewTraining(crewMemberId: number) {
    await this.trainingService.createTraining(
      // slot_weight / sessions_required are legacy columns — players pick lengths now.
      { crew_member_id: crewMemberId, ...this.trainingFields(this.addForm), slot_weight: 'medium', sessions_required: 1 },
      this.buildHiddenBonus(this.addForm),
    );
    this.addingForCrew.set(null);
  }
}
