import { Component, computed, inject, signal, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { FormsModule } from '@angular/forms';
import { TrainingService } from '../../dm/training.service';
import { RelationshipService } from '../../dm/relationship.service';
import { ScheduleService } from '../schedule.service';
import { TrainingTrackerService } from '../../dm/training-tracker.service';
import { AuthService } from '../../../core/auth/auth.service';
import { CREW_LIST, CREW_COLORS, CREW_META, TIER_NAMES, TIER_COLORS } from '../../../shared/data/training.data';
import { ScheduleBlock, TrainingWithCrew, SlotWeight, SLOT_WEIGHTS, SLOT_WEIGHT_UNITS, SLOT_WEIGHT_LABEL } from '../../../shared/models';

export interface AddBlockDialogData {
  dayId: string;
  remainingBudget: number;
  forUserId?: string;
  /** Feature #3 — when true, training is barred (Guner's correction). */
  correctionActive?: boolean;
  /** Crew already booked for a training this day — only one per crew per day. */
  takenCrew?: string[];
  /**
   * Edit mode: change the length of a block already on the board. The dialog
   * opens straight on the length buttons; `remainingBudget` is the room from
   * the block's start with the block itself counted as free.
   */
  editBlock?: ScheduleBlock;
}

export interface AddBlockDialogResult {
  crewMember: string;
  trainingTopic: string;
  slotWeight: SlotWeight;
}

type PickerFilter = 'all' | 'progress' | 'new';

/** One crewmate's section of the picker — only trainings the player has unlocked. */
interface PickerGroup {
  crew: string;
  role: string;
  tier: number;
  /** Already training with this crewmate today — one training per crewmate per day. */
  taken: boolean;
  trainings: TrainingWithCrew[];
}

@Component({
  selector: 'app-add-block-dialog',
  standalone: true,
  imports: [
    MatDialogModule,
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
  selectedTraining = signal<TrainingWithCrew | null>(null);
  selectedLength = signal<SlotWeight | null>(null);
  filter = signal<PickerFilter>('all');
  readonly filters: { id: PickerFilter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'progress', label: 'In progress' },
    { id: 'new', label: 'Not started' },
  ];

  /**
   * The catalog of trainings this player can actually book, grouped by
   * crewmate. Anything the relationship hasn't unlocked — and every training
   * from a crewmate who is Wary of them — is left out entirely, as are
   * trainings they've already mastered.
   */
  readonly groups = computed<PickerGroup[]>(() => {
    const userId = this.userId;
    if (!userId) return [];
    this.relationshipService.tiers();   // re-run when a tier changes live
    this.tracker.progress();
    const filter = this.filter();

    const groups: PickerGroup[] = [];
    for (const crew of CREW_LIST) {
      const tier = this.relationshipService.getTierForCrewMember(userId, crew);
      if (tier <= 0) continue;
      const trainings = this.trainingService.getTrainingsForCrewByName(crew)
        .filter(t => t.tier_required <= tier && !this.isMastered(t))
        .filter(t => filter === 'all' || (filter === 'progress') === this.pointsBanked(t) > 0)
        .sort((a, b) => a.tier_required - b.tier_required || a.topic.localeCompare(b.topic));
      if (trainings.length === 0) continue;
      groups.push({
        crew,
        role: CREW_META[crew]?.role ?? '',
        tier,
        taken: this.isCrewTaken(crew),
        trainings,
      });
    }
    // Crewmates already booked today sink to the bottom.
    return groups.sort((a, b) => Number(a.taken) - Number(b.taken));
  });

  // Custom mode
  customCrew = '';
  customTopic = '';
  customWeight: SlotWeight = 'light';

  /** True when changing an existing block's length rather than planning a new one. */
  readonly editing = !!this.data.editBlock;

  ngOnInit() {
    const userId = this.data.forUserId ?? this.auth.userId();
    if (userId) {
      this.relationshipService.loadTiers(userId);
    }

    const block = this.data.editBlock;
    if (block) {
      const training = this.trainingService.getTraining(block.crew_member, block.training_topic);
      if (training) {
        this.selectedTraining.set(training);
        this.selectedLength.set(block.slot_weight);
        this.trainingStep.set('length');
      } else {
        this.mode.set('custom');
        this.customCrew = block.crew_member;
        this.customTopic = block.training_topic;
        this.customWeight = block.slot_weight;
      }
      return;
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
  lengthName(weight: SlotWeight): string {
    return SLOT_WEIGHT_LABEL[weight];
  }
  /** One pip per hour the block takes. */
  hourPips(weight: SlotWeight): number[] {
    return Array.from({ length: SLOT_WEIGHT_UNITS[weight] });
  }
  tierName(tier: number): string {
    return TIER_NAMES[tier] ?? 'Unknown';
  }
  tierColor(tier: number): string {
    return TIER_COLORS[tier] ?? '#5a5040';
  }
  pipArray(n: number): number[] {
    return Array.from({ length: n }, (_, i) => i);
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

  selectTraining(training: TrainingWithCrew) {
    if (this.isCrewTaken(training.crew_member_name) || this.isMastered(training)) return;
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
    // The block being re-sized doesn't count — its new length is what's being chosen.
    return this.schedule.blocks()
      .filter(b => b.user_id === uid && !b.is_mandatory && b.status === 'pending' &&
        b.id !== this.data.editBlock?.id &&
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
      if (!this.selectedTraining() || !l || !this.lengthAffordable(l)) return false;
      return !this.editing || l !== this.data.editBlock!.slot_weight;
    }
    if (!this.customTopic.trim() || !this.isCustomAffordable()) return false;
    return !this.editing || this.customWeight !== this.data.editBlock!.slot_weight;
  }

  confirm() {
    if (!this.canConfirm()) return;

    let result: AddBlockDialogResult;
    if (this.mode() === 'training') {
      const t = this.selectedTraining()!;
      result = {
        crewMember: t.crew_member_name,
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
