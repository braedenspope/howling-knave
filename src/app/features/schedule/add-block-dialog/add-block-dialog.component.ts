import { Component, inject, signal, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { FormsModule } from '@angular/forms';
import { TrainingService } from '../../dm/training.service';
import { RelationshipService } from '../../dm/relationship.service';
import { ScheduleService } from '../schedule.service';
import { TrainingTrackerService } from '../../dm/training-tracker.service';
import { AuthService } from '../../../core/auth/auth.service';
import { CREW_LIST, CREW_COLORS, TIER_NAMES } from '../../../shared/data/training.data';
import { TrainingWithCrew, SlotWeight, SLOT_WEIGHTS, SLOT_WEIGHT_UNITS, SLOT_WEIGHT_LABEL } from '../../../shared/models';

export interface AddBlockDialogData {
  dayId: string;
  remainingBudget: number;
  forUserId?: string;
  /** Feature #3 — when true, training is barred (Guner's correction). */
  correctionActive?: boolean;
  /** Crew already booked for a training this day — only one per crew per day. */
  takenCrew?: string[];
}

export interface AddBlockDialogResult {
  crewMember: string;
  trainingTopic: string;
  slotWeight: SlotWeight;
}

type TrainingOption = TrainingWithCrew & { available: boolean; affordable: boolean };

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
  private schedule = inject(ScheduleService);
  private auth = inject(AuthService);
  private tracker = inject(TrainingTrackerService);

  mode = signal<'training' | 'custom'>('training');
  /** Within training mode: pick a training, then pick how long to spend on it. */
  trainingStep = signal<'pick' | 'length'>('pick');

  readonly lengths = SLOT_WEIGHTS;

  // Training mode
  crewList = CREW_LIST;
  selectedCrew = '';
  selectedTraining = signal<TrainingOption | null>(null);
  selectedLength = signal<SlotWeight | null>(null);
  availableTrainings = signal<TrainingOption[]>([]);

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
    this.trainingStep.set('pick');
  }

  /** Return from the length view to the training list. */
  backToTraining() {
    this.trainingStep.set('pick');
    this.selectedTraining.set(null);
    this.selectedLength.set(null);
  }

  getCrewColor(name: string): string {
    return CREW_COLORS[name] ?? '#666';
  }

  /** True when this crew member already has a training booked for the day. */
  isCrewTaken(crew: string): boolean {
    return (this.data.takenCrew ?? []).includes(crew);
  }

  getCost(weight: string): number {
    return SLOT_WEIGHT_UNITS[weight as keyof typeof SLOT_WEIGHT_UNITS] ?? 0;
  }

  isCustomAffordable(): boolean {
    return SLOT_WEIGHT_UNITS[this.customWeight] <= this.data.remainingBudget;
  }

  onCrewChange() {
    this.selectedTraining.set(null);
    this.selectedLength.set(null);
    this.trainingStep.set('pick');
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

  selectTraining(training: TrainingOption) {
    if (!training.available || !training.affordable || this.isMastered(training)) return;
    this.selectedTraining.set(training);
    // Default to the longest block that fits without planning past mastery.
    const fits = this.lengths.filter(l => this.lengthAffordable(l));
    const needed = this.pointsNeeded(training) - this.plannedHours(training);
    const pick = [...fits].reverse().find(l => SLOT_WEIGHT_UNITS[l] <= needed) ?? fits[0] ?? null;
    this.selectedLength.set(pick);
    this.trainingStep.set('length');
  }

  lengthAffordable(weight: SlotWeight): boolean {
    return SLOT_WEIGHT_UNITS[weight] <= this.data.remainingBudget;
  }

  selectLength(weight: SlotWeight) {
    if (!this.lengthAffordable(weight)) return;
    this.selectedLength.set(weight);
  }

  // ---- points readout -----------------------------------------------------

  private get userId(): string | null {
    return this.data.forUserId ?? this.auth.userId();
  }

  /** Points already banked toward this training. */
  pointsBanked(t: TrainingWithCrew): number {
    const uid = this.userId;
    const p = uid ? this.tracker.getProgress(uid, t.crew_member_name, t.topic) : undefined;
    return p?.pp_accumulated ?? 0;
  }

  /** Points still to earn before the benefit unlocks. */
  pointsNeeded(t: TrainingWithCrew): number {
    return Math.max(0, t.threshold_pp - this.pointsBanked(t));
  }

  isMastered(t: TrainingWithCrew): boolean {
    const uid = this.userId;
    return !!uid && !!this.tracker.getProgress(uid, t.crew_member_name, t.topic)?.completed;
  }

  /**
   * Hours of this training already on the board but not yet rolled — the most
   * points they could still add. Lets players see how much more they need.
   */
  plannedHours(t: TrainingWithCrew): number {
    const uid = this.userId;
    if (!uid) return 0;
    return this.schedule.blocks()
      .filter(b => b.user_id === uid && !b.is_mandatory && b.status === 'pending' &&
        b.crew_member === t.crew_member_name && b.training_topic === t.topic)
      .reduce((sum, b) => sum + SLOT_WEIGHT_UNITS[b.slot_weight], 0);
  }

  /**
   * True when this block would take the planned hours past what is needed,
   * even if every roll lands — the spare hours become free time at the table.
   */
  overshoots(t: TrainingWithCrew, weight: SlotWeight): boolean {
    return this.plannedHours(t) + SLOT_WEIGHT_UNITS[weight] > this.pointsNeeded(t);
  }

  canConfirm(): boolean {
    if (this.mode() === 'training') {
      const l = this.selectedLength();
      return !!this.selectedTraining() && !!l && this.lengthAffordable(l);
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
        slotWeight: this.selectedLength()!,
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
