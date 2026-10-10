import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { PlayService, PlayStop, StopKind } from '../play.service';
import { VoyageService } from '../../voyage/voyage.service';
import { ScheduleService } from '../../schedule/schedule.service';
import { TrainingService } from '../../dm/training.service';
import { AuthService } from '../../../core/auth/auth.service';
import { ToastService } from '../../../shared/toast.service';
import { CREW_COLORS } from '../../../shared/data/training.data';
import { RollOutcome, SLOT_WEIGHT_LABEL } from '../../../shared/models';

/** Everything the runner card shows for the stop it is sitting on. */
interface StopView {
  stop: PlayStop;
  kind: StopKind;
  characterName: string;
  crewMember: string;
  crewColor: string;
  topic: string;
  lengthLabel: string;
  /** "Roll 2 of 4" — absent for duty and custom stops. */
  rollLabel: string;
  /**
   * A training hour left over after the training was mastered — no roll; the
   * player describes what they do with the time, and the DM moves on.
   */
  spare: boolean;
  description: string | null;
  sceneSeed: string | null;
  /** One entry per hour of the block: its outcome, or null if not yet rolled. */
  history: (RollOutcome | null)[];
  recorded: RollOutcome | null;
  points: string;
  mastered: boolean;
  /** Only surfaced when this player's character is the one it is keyed to. */
  hiddenBonus: string | null;
}

/**
 * The block-by-block runner. The DM steps through one hour at a time and marks
 * each training roll; every other client watches the same cursor live.
 */
@Component({
  selector: 'app-play-runner',
  standalone: true,
  imports: [],
  templateUrl: './play-runner.component.html',
  styleUrl: './play-runner.component.scss',
})
export class PlayRunnerComponent implements OnInit {
  play = inject(PlayService);
  auth = inject(AuthService);
  voyageService = inject(VoyageService);
  private scheduleService = inject(ScheduleService);
  private trainingService = inject(TrainingService);
  private toast = inject(ToastService);
  private router = inject(Router);

  readonly busy = signal(false);

  async ngOnInit() {
    await this.play.bootstrap();
  }

  readonly isDm = computed(() => this.auth.isDm());

  readonly progressPct = computed(() => {
    const total = this.play.queue().length;
    if (total === 0) return 0;
    return Math.round((Math.min(this.play.cursor(), total) / total) * 100);
  });

  /** How many stops remain on the day currently being run. */
  readonly remainingToday = computed(() => {
    const stop = this.play.current();
    if (!stop) return 0;
    return this.play.queue()
      .slice(this.play.cursor())
      .filter(s => s.dayId === stop.dayId).length;
  });

  readonly view = computed<StopView | null>(() => {
    const stop = this.play.current();
    if (!stop) return null;

    const block = stop.block;
    const training = this.trainingService.getTraining(block.crew_member, block.training_topic);
    const characterName = this.characterName(stop.userId);

    const history: (RollOutcome | null)[] = Array.from(
      { length: stop.rollCount },
      (_, i) => this.play.rollFor(block.id, i)?.outcome ?? null,
    );

    const recorded = history[stop.rollIndex] ?? null;
    const mastered = this.play.isMastered(block);

    const bonus = training?.hidden_bonus;
    const hiddenBonus =
      bonus && bonus.character_name.trim().toLowerCase() === characterName.trim().toLowerCase()
        ? bonus.body
        : null;

    return {
      stop,
      kind: stop.kind,
      characterName,
      crewMember: block.crew_member,
      crewColor: CREW_COLORS[block.crew_member] ?? '#6a6a5a',
      topic: block.training_topic,
      lengthLabel: SLOT_WEIGHT_LABEL[block.slot_weight],
      rollLabel: `Roll ${stop.rollIndex + 1} of ${stop.rollCount}`,
      spare: stop.kind === 'roll' && mastered && !recorded,
      description: training?.description ?? null,
      sceneSeed: training?.scene_seed ?? null,
      history,
      recorded,
      points: this.play.pointsLabel(block),
      mastered,
      hiddenBonus,
    };
  });

  characterName(userId: string): string {
    const user = this.scheduleService.allUsers().find(u => u.id === userId);
    return user?.character_name || user?.display_name || 'Unknown';
  }

  /** The hour label players see on the board: hours run 1–8. */
  hourLabel(stop: PlayStop): string {
    return `Hour ${stop.hour + 1}`;
  }

  // ---- DM controls --------------------------------------------------------

  async mark(outcome: RollOutcome) {
    const stop = this.play.current();
    if (!stop || !this.isDm() || this.busy()) return;

    this.busy.set(true);
    const err = await this.play.recordRoll(stop.block, stop.rollIndex, outcome);
    if (err) {
      this.busy.set(false);
      this.toast.show(err);
      return;
    }

    const points = this.play.pointsLabel(stop.block);
    this.toast.show(
      this.play.isMastered(stop.block)
        ? `${stop.block.training_topic} · UNLOCKED`
        : outcome === 'success'
          ? `Success — ${stop.block.training_topic} · ${points}`
          : `Failure — ${stop.block.training_topic} · ${points}`,
    );

    await this.play.advance();
    this.busy.set(false);
  }

  async next() {
    if (!this.isDm() || this.busy()) return;
    this.busy.set(true);
    await this.play.advance();
    this.busy.set(false);
  }

  async back() {
    if (!this.isDm() || this.busy()) return;
    this.busy.set(true);
    await this.play.back();
    this.busy.set(false);
  }

  async end() {
    if (!this.isDm()) return;
    await this.play.stop();
    this.toast.show('The voyage is called to a close');
    this.router.navigate(['/board']);
  }

  toSetup() {
    this.router.navigate(['/board']);
  }
}
