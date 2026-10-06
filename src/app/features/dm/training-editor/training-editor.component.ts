import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { TrainingService, HiddenBonusInput } from '../training.service';
import { CREW_COLORS } from '../../../shared/data/training.data';
import { TrainingWithCrew, thresholdForTier } from '../../../shared/models';

interface TrainingForm {
  topic: string;
  description: string;
  reward: string;
  scene_seed: string;
  narrative_thread: string;
  tier_required: number;
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

  constructor(public trainingService: TrainingService) {}

  async ngOnInit() {
    await this.trainingService.loadCrewMembers();
    await this.trainingService.loadTrainings();
  }

  getCrewColor(name: string): string {
    return CREW_COLORS[name] ?? '#666';
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
    };
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
