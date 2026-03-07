import { Component, inject, signal, OnInit } from '@angular/core';
import { UpperCasePipe } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { FormsModule } from '@angular/forms';
import { TrainingService } from '../../dm/training.service';
import { RelationshipService } from '../../dm/relationship.service';
import { AuthService } from '../../../core/auth/auth.service';
import { CREW_LIST, CREW_COLORS } from '../../../shared/data/training.data';
import { TrainingWithCrew, SlotWeight, SLOT_WEIGHT_UNITS } from '../../../shared/models';

export interface AddBlockDialogData {
  dayId: string;
  remainingBudget: number;
  forUserId?: string;
}

export interface AddBlockDialogResult {
  crewMember: string;
  trainingTopic: string;
  slotWeight: SlotWeight;
}

@Component({
  selector: 'app-add-block-dialog',
  standalone: true,
  imports: [
    UpperCasePipe,
    MatDialogModule,
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatIconModule,
    FormsModule,
  ],
  templateUrl: './add-block-dialog.component.html',
  styleUrl: './add-block-dialog.component.scss',
})
export class AddBlockDialogComponent implements OnInit {
  data = inject<AddBlockDialogData>(MAT_DIALOG_DATA);
  private dialogRef = inject(MatDialogRef<AddBlockDialogComponent>);
  private trainingService = inject(TrainingService);
  private relationshipService = inject(RelationshipService);
  private auth = inject(AuthService);

  mode = signal<'training' | 'custom'>('training');

  // Training mode
  crewList = CREW_LIST;
  selectedCrew = '';
  selectedTraining = signal<(TrainingWithCrew & { available: boolean; affordable: boolean }) | null>(null);
  availableTrainings = signal<(TrainingWithCrew & { available: boolean; affordable: boolean })[]>([]);

  // Custom mode
  customCrew = '';
  customTopic = '';
  customWeight: SlotWeight = 'light';

  ngOnInit() {
    const userId = this.data.forUserId ?? this.auth.userId();
    if (userId) {
      this.relationshipService.loadTiers(userId);
    }
  }

  setMode(mode: 'training' | 'custom') {
    this.mode.set(mode);
  }

  getCrewColor(name: string): string {
    return CREW_COLORS[name] ?? '#666';
  }

  getCost(weight: string): number {
    return SLOT_WEIGHT_UNITS[weight as keyof typeof SLOT_WEIGHT_UNITS] ?? 0;
  }

  isCustomAffordable(): boolean {
    return SLOT_WEIGHT_UNITS[this.customWeight] <= this.data.remainingBudget;
  }

  onCrewChange() {
    this.selectedTraining.set(null);
    const userId = this.data.forUserId ?? this.auth.userId();
    if (!userId || !this.selectedCrew) {
      this.availableTrainings.set([]);
      return;
    }
    const tier = this.relationshipService.getTierForCrewMember(userId, this.selectedCrew);
    const options = this.trainingService.getAvailableTrainings(
      this.selectedCrew,
      tier,
      this.data.remainingBudget,
    );
    this.availableTrainings.set(options);
  }

  selectTraining(training: TrainingWithCrew & { available: boolean; affordable: boolean }) {
    if (!training.available || !training.affordable) return;
    this.selectedTraining.set(training);
  }

  canConfirm(): boolean {
    if (this.mode() === 'training') {
      return !!this.selectedTraining();
    }
    return !!this.customTopic.trim() && this.isCustomAffordable();
  }

  confirm() {
    if (!this.canConfirm()) return;

    let result: AddBlockDialogResult;
    if (this.mode() === 'training') {
      const t = this.selectedTraining()!;
      result = {
        crewMember: this.selectedCrew,
        trainingTopic: t.topic,
        slotWeight: t.slot_weight,
      };
    } else {
      result = {
        crewMember: this.customCrew || 'Independent',
        trainingTopic: this.customTopic.trim(),
        slotWeight: this.customWeight,
      };
    }
    this.dialogRef.close(result);
  }
}
