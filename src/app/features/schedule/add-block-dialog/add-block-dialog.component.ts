import { Component, inject, signal, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { FormsModule } from '@angular/forms';
import { TrainingService } from '../../dm/training.service';
import { RelationshipService } from '../../dm/relationship.service';
import { ScheduleService } from '../schedule.service';
import { AuthService } from '../../../core/auth/auth.service';
import { CREW_LIST, CREW_COLORS, TIER_NAMES } from '../../../shared/data/training.data';
import { TrainingWithCrew, TrainingSession, SlotWeight, SLOT_WEIGHT_UNITS, SLOT_WEIGHT_LABEL } from '../../../shared/models';

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
  private schedule = inject(ScheduleService);
  private auth = inject(AuthService);

  mode = signal<'training' | 'custom'>('training');
  /** Within training mode: pick a training, then pick a session. */
  trainingStep = signal<'pick' | 'session'>('pick');

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
    this.trainingStep.set('pick');
  }

  /** Return from the session view to the training list. */
  backToTraining() {
    this.trainingStep.set('pick');
    this.selectedTraining.set(null);
    this.selectedSession.set(null);
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
    this.selectedSession.set(null);
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

  selectTraining(training: TrainingWithCrew & { available: boolean; affordable: boolean }) {
    if (!training.available || !training.affordable) return;
    this.selectedTraining.set(training);
    // Default to the next session in sequence that can be taken.
    const next = training.sessions.find(s => this.sessionSelectable(training.topic, s));
    this.selectedSession.set(next ?? null);
    this.trainingStep.set('session');
  }

  sessionCost(session: TrainingSession): number {
    return SLOT_WEIGHT_UNITS[session.length];
  }
  sessionAffordable(session: TrainingSession): boolean {
    return this.sessionCost(session) <= this.data.remainingBudget;
  }

  /** Sessions this player has already booked / passed for the given training. */
  private bookedSessions(topic: string): { scheduled: Set<number>; passed: Set<number> } {
    const scheduled = new Set<number>();
    const passed = new Set<number>();
    const userId = this.data.forUserId ?? this.auth.userId();
    if (!userId) return { scheduled, passed };
    for (const b of this.schedule.blocks()) {
      if (b.user_id === userId && b.crew_member === this.selectedCrew &&
          b.training_topic === topic && b.session_number != null) {
        scheduled.add(b.session_number);
        if (b.status === 'success') passed.add(b.session_number);
      }
    }
    return { scheduled, passed };
  }

  /** A session is done once it has been passed. */
  sessionDone(topic: string, s: TrainingSession): boolean {
    return this.bookedSessions(topic).passed.has(s.session_number);
  }
  /** Sessions must be taken in order — earlier ones booked first. */
  sessionLocked(topic: string, s: TrainingSession): boolean {
    if (s.session_number <= 1) return false;
    const { scheduled, passed } = this.bookedSessions(topic);
    return !scheduled.has(s.session_number - 1) && !passed.has(s.session_number - 1);
  }
  sessionSelectable(topic: string, s: TrainingSession): boolean {
    return !this.sessionDone(topic, s) && !this.sessionLocked(topic, s) && this.sessionAffordable(s);
  }

  selectSession(topic: string, session: TrainingSession) {
    if (!this.sessionSelectable(topic, session)) return;
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
