import { Component, OnInit, signal } from '@angular/core';
import { UpperCasePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { TrainingService } from '../training.service';
import { CREW_COLORS } from '../../../shared/data/training.data';
import { CrewMember, SlotWeight, TrainingWithCrew } from '../../../shared/models';

interface TrainingForm {
  topic: string;
  description: string;
  reward: string;
  scene_seed: string;
  slot_weight: SlotWeight;
  sessions_required: number;
  tier_required: number;
}

@Component({
  selector: 'app-training-editor',
  standalone: true,
  imports: [
    UpperCasePipe,
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

  private emptyForm(): TrainingForm {
    return {
      topic: '',
      description: '',
      reward: '',
      scene_seed: '',
      slot_weight: 'medium',
      sessions_required: 3,
      tier_required: 1,
    };
  }

  startEdit(training: TrainingWithCrew) {
    this.editingId.set(training.id);
    this.editForm = {
      topic: training.topic,
      description: training.description,
      reward: training.reward,
      scene_seed: training.scene_seed ?? '',
      slot_weight: training.slot_weight,
      sessions_required: training.sessions_required,
      tier_required: training.tier_required,
    };
  }

  cancelEdit() {
    this.editingId.set(null);
  }

  async saveEdit(id: string) {
    await this.trainingService.updateTraining(id, {
      ...this.editForm,
      scene_seed: this.editForm.scene_seed.trim() || null,
    });
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
    await this.trainingService.createTraining({
      crew_member_id: crewMemberId,
      ...this.addForm,
      scene_seed: this.addForm.scene_seed.trim() || null,
    });
    this.addingForCrew.set(null);
  }
}
