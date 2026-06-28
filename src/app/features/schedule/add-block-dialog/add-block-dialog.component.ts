import { Component, inject, signal, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { FormsModule } from '@angular/forms';
import { TrainingService } from '../../dm/training.service';
import { RelationshipService } from '../../dm/relationship.service';
import { AuthService } from '../../../core/auth/auth.service';
import { CREW_LIST, CREW_COLORS, TIER_NAMES } from '../../../shared/data/training.data';
import { TrainingWithCrew, TrainingSession, SlotWeight, SLOT_WEIGHT_UNITS, SLOT_WEIGHT_LABEL } from '../../../shared/models';

export interface AddBlockDialogData {
  dayId: string;
  remainingBudget: number;
  forUserId?: string;
  /** Feature #3 — when true, training is barred (Guner's correction). */
  correctionActive?: boolean;
}

export interface AddBlockDialogResult {
  crewMember: string;
  trainingTopic: string;
  slotWeight: SlotWeight;
  sessionNumber?: number | null;
}

@Component({
  selector: 'app-add-block-dialog',
  standalone: true,
  imports: [
    MatDialogModule,
    MatFormFieldModule,
    MatSelectModule,
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

  /** Only the DM should see the roll a session calls for. */
  showRolls = (): boolean => this.auth.isDm();

  // Training mode
  crewList = CREW_LIST;
  selectedCrew = '';
  selectedTraining = signal<(TrainingWithCrew & { available: boolean; affordable: boolean }) | null>(null);
  selectedSession = signal<TrainingSession | null>(null);
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
    if (this.data.correctionActive) {
      this.mode.set('custom');
    }
  }

  lengthLabel(weight: string): string {
    return `${SLOT_WEIGHT_LABEL[weight as SlotWeight]} · ${SLOT_WEIGHT_UNITS[weight as SlotWeight]}`;
  }
  lengthClass(weight: string): string {
    return `wt-${weight}`;
  }
  tierName(tier: number): string {
    return TIER_NAMES[tier] ?? 'Unknown';
  }
  tierFor(crew: string): number {
    const userId = this.data.forUserId ?? this.auth.userId();
    return userId ? this.relationshipService.getTierForCrewMember(userId, crew) : 1;
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
    this.selectedSession.set(null);
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
    // Default to the first session that fits the free space, else the first.
    const fit = training.sessions.find(s => this.sessionAffordable(s));
    this.selectedSession.set(fit ?? training.sessions[0] ?? null);
  }

  sessionCost(session: TrainingSession): number {
    return SLOT_WEIGHT_UNITS[session.length];
  }
  sessionAffordable(session: TrainingSession): boolean {
    return this.sessionCost(session) <= this.data.remainingBudget;
  }
  selectSession(session: TrainingSession) {
    if (!this.sessionAffordable(session)) return;
    this.selectedSession.set(session);
  }

  canConfirm(): boolean {
    if (this.mode() === 'training') {
      const s = this.selectedSession();
      return !!this.selectedTraining() && !!s && this.sessionAffordable(s);
    }
    return !!this.customTopic.trim() && this.isCustomAffordable();
  }

  confirm() {
    if (!this.canConfirm()) return;

    let result: AddBlockDialogResult;
    if (this.mode() === 'training') {
      const t = this.selectedTraining()!;
      const s = this.selectedSession()!;
      result = {
        crewMember: this.selectedCrew,
        trainingTopic: t.topic,
        slotWeight: s.length,
        sessionNumber: s.session_number,
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
