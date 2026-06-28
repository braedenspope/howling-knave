import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { TrainingService, SessionInput, HiddenBonusInput } from '../training.service';
import { CREW_COLORS } from '../../../shared/data/training.data';
import { SlotWeight, TrainingWithCrew, SESSION_PP, SLOT_WEIGHT_LABEL, SLOT_WEIGHT_UNITS } from '../../../shared/models';

interface SessionRow {
  session_number: number;
  length: SlotWeight;
  roll_type: string;
  pp_success: number;
  pp_fail: number;
}

interface TrainingForm {
  topic: string;
  description: string;
  reward: string;
  scene_seed: string;
  narrative_thread: string;
  tier_required: number;
  threshold_pp: number;
  sessions: SessionRow[];
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
  editingId = signal<string | null>(null);
  addingForCrew = signal<number | null>(null);

  editForm: TrainingForm = this.emptyForm();
  addForm: TrainingForm = this.emptyForm();

  readonly lengthLabel = SLOT_WEIGHT_LABEL;

  constructor(public trainingService: TrainingService) {}

  async ngOnInit() {
    await this.trainingService.loadCrewMembers();
    await this.trainingService.loadTrainings();
  }

  getCrewColor(name: string): string {
    return CREW_COLORS[name] ?? '#666';
  }

  lengthCost(weight: SlotWeight): number {
    return SLOT_WEIGHT_UNITS[weight];
  }

  private emptyForm(): TrainingForm {
    return {
      topic: '',
      description: '',
      reward: '',
      scene_seed: '',
      narrative_thread: '',
      tier_required: 1,
      threshold_pp: 3,
      sessions: [this.newSession(1, 'light')],
      hidden_character: '',
      hidden_body: '',
    };
  }

  private newSession(num: number, length: SlotWeight): SessionRow {
    const pp = SESSION_PP[length];
    return { session_number: num, length, roll_type: '', pp_success: pp.success, pp_fail: pp.fail };
  }

  addSession(form: TrainingForm) {
    form.sessions.push(this.newSession(form.sessions.length + 1, 'light'));
  }
  removeSession(form: TrainingForm, index: number) {
    form.sessions.splice(index, 1);
    form.sessions.forEach((s, i) => (s.session_number = i + 1));
  }
  /** When a session's length changes, refresh its PP to the standard rule. */
  onLengthChange(row: SessionRow) {
    const pp = SESSION_PP[row.length];
    row.pp_success = pp.success;
    row.pp_fail = pp.fail;
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
      threshold_pp: training.threshold_pp,
      sessions: training.sessions.length
        ? training.sessions.map(s => ({
            session_number: s.session_number,
            length: s.length,
            roll_type: s.roll_type,
            pp_success: s.pp_success,
            pp_fail: s.pp_fail,
          }))
        : [this.newSession(1, training.slot_weight)],
      hidden_character: training.hidden_bonus?.character_name ?? '',
      hidden_body: training.hidden_bonus?.body ?? '',
    };
  }

  cancelEdit() {
    this.editingId.set(null);
  }

  private buildSessions(form: TrainingForm): SessionInput[] {
    return form.sessions.map((s, i) => ({
      session_number: i + 1,
      length: s.length,
      roll_type: s.roll_type.trim(),
      pp_success: Number(s.pp_success) || 0,
      pp_fail: Number(s.pp_fail) || 0,
    }));
  }

  private buildHiddenBonus(form: TrainingForm): HiddenBonusInput | null {
    if (!form.hidden_character.trim()) return null;
    return { character_name: form.hidden_character.trim(), body: form.hidden_body.trim() };
  }

  private trainingFields(form: TrainingForm) {
    const sessions = form.sessions;
    return {
      topic: form.topic,
      description: form.description,
      reward: form.reward,
      scene_seed: form.scene_seed.trim() || null,
      narrative_thread: form.narrative_thread.trim() || null,
      slot_weight: sessions[0]?.length ?? 'medium',
      sessions_required: sessions.length,
      tier_required: form.tier_required,
      threshold_pp: form.threshold_pp,
    };
  }

  async saveEdit(id: string) {
    await this.trainingService.updateTraining(
      id,
      this.trainingFields(this.editForm),
      this.buildSessions(this.editForm),
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
      { crew_member_id: crewMemberId, ...this.trainingFields(this.addForm) },
      this.buildSessions(this.addForm),
      this.buildHiddenBonus(this.addForm),
    );
    this.addingForCrew.set(null);
  }
}
