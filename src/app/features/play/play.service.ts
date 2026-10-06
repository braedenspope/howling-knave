import { Injectable, NgZone, computed, signal } from '@angular/core';
import { RealtimeChannel } from '@supabase/supabase-js';
import { SupabaseService } from '../../core/supabase/supabase.service';
import { VoyageService } from '../voyage/voyage.service';
import { ScheduleService } from '../schedule/schedule.service';
import { TrainingService } from '../dm/training.service';
import { TrainingTrackerService } from '../dm/training-tracker.service';
import {
  BlockRoll,
  DAY_BUDGET,
  PlayState,
  RollOutcome,
  ScheduleBlock,
  SLOT_WEIGHT_UNITS,
  PITY_MIN_HOURS,
  PITY_POINT,
  POINT_PER_SUCCESS,
  thresholdForTier,
} from '../../shared/models';

/**
 * What the runner puts on screen at one stop:
 *   `roll`   — a training hour; the DM calls for a roll and marks it
 *   `custom` — an independent or home-brewed activity; read it and move on
 *   `duty`   — a ship duty; read it and move on
 */
export type StopKind = 'roll' | 'custom' | 'duty';

/** One hour of one player's day — the unit the runner steps through. */
export interface PlayStop {
  dayId: string;
  dayNumber: number;
  /** 0-based hour of the day (0–7). */
  hour: number;
  userId: string;
  block: ScheduleBlock;
  kind: StopKind;
  /** Which roll of this block's span this stop is (0-based). */
  rollIndex: number;
  /** How many hours — and so how many rolls — this block spans. */
  rollCount: number;
}

/** Points a training has banked, recomputed from its rolls. */
export interface ScoredProgress {
  points: number;
  threshold: number;
  completed: boolean;
}

/**
 * Play mode — the block-by-block montage runner.
 *
 * The voyage is walked one hour at a time: hour 1 for every player in the
 * chosen turn order, then hour 2, and so on across every day. A training that
 * spans four hours is rolled four times.
 *
 * `block_rolls` is the single source of truth for scoring; progress is always
 * recomputed from it rather than incremented, so undo and mid-session
 * corrections land exactly.
 */
@Injectable({ providedIn: 'root' })
export class PlayService {
  readonly state = signal<PlayState | null>(null);
  readonly rolls = signal<BlockRoll[]>([]);

  private stateChannel: RealtimeChannel | null = null;
  private rollChannel: RealtimeChannel | null = null;

  constructor(
    private sb: SupabaseService,
    private voyage: VoyageService,
    private schedule: ScheduleService,
    private trainings: TrainingService,
    private tracker: TrainingTrackerService,
    private ngZone: NgZone,
  ) {}

  readonly isActive = computed(() => this.state()?.active === true);

  /**
   * Every stop of the run, in play order: day, then hour, then turn order.
   * Hours a player has nothing booked for are skipped entirely.
   */
  readonly queue = computed<PlayStop[]>(() => {
    const st = this.state();
    if (!st || st.turn_order.length === 0) return [];

    const blocks = this.schedule.blocks();
    const stops: PlayStop[] = [];

    for (const day of this.voyage.days()) {
      for (let hour = 0; hour < DAY_BUDGET; hour++) {
        for (const userId of st.turn_order) {
          const block = blocks.find(
            b =>
              b.day_id === day.id &&
              b.user_id === userId &&
              b.slot_position <= hour &&
              hour < b.slot_position + SLOT_WEIGHT_UNITS[b.slot_weight],
          );
          if (!block) continue;

          stops.push({
            dayId: day.id,
            dayNumber: day.day_number,
            hour,
            userId,
            block,
            kind: this.kindOf(block),
            rollIndex: hour - block.slot_position,
            rollCount: SLOT_WEIGHT_UNITS[block.slot_weight],
          });
        }
      }
    }
    return stops;
  });

  readonly cursor = computed(() => this.state()?.cursor ?? 0);
  readonly current = computed<PlayStop | null>(() => this.queue()[this.cursor()] ?? null);
  readonly finished = computed(() => {
    const q = this.queue();
    return q.length > 0 && this.cursor() >= q.length;
  });

  /** A duty, or anything with no training record behind it, is just read aloud. */
  private kindOf(block: ScheduleBlock): StopKind {
    if (block.is_mandatory) return 'duty';
    const training = this.trainings.getTraining(block.crew_member, block.training_topic);
    return training ? 'roll' : 'custom';
  }

  // ---- loading & realtime -------------------------------------------------

  /**
   * Load everything the runner and its setup screen need for the active
   * voyage, and wire up the realtime subscriptions that keep every player's
   * screen on the DM's cursor.
   */
  async bootstrap(): Promise<void> {
    await Promise.all([
      this.voyage.loadVoyages(),
      this.schedule.loadAllUsers(),
      this.trainings.loadTrainings(),
      this.tracker.loadAllProgress(),
    ]);

    const voyage = this.voyage.activeVoyage();
    if (!voyage) return;

    await this.voyage.loadDays(voyage.id);
    await this.schedule.loadBlocks(this.voyage.days().map(d => d.id));
    await this.load(voyage.id);

    this.subscribe(voyage.id);
    this.schedule.subscribeToBlocks(voyage.id);
  }

  async load(voyageId: string) {
    const { data } = await this.sb.supabase
      .from('voyage_play_state')
      .select('*')
      .eq('voyage_id', voyageId)
      .maybeSingle();
    this.state.set((data as PlayState) ?? null);
    await this.loadRolls();
  }

  /**
   * Every roll in the campaign — a handful per training hour, so a small table.
   * Fetched whole rather than filtered by block id, which would put hundreds of
   * UUIDs in the query string on a long voyage.
   */
  async loadRolls() {
    const { data } = await this.sb.supabase.from('block_rolls').select('*');
    this.rolls.set((data as BlockRoll[]) ?? []);
  }

  subscribe(voyageId: string) {
    this.stateChannel?.unsubscribe();
    this.stateChannel = this.sb.supabase
      .channel(`play-state-${voyageId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'voyage_play_state' }, () => {
        this.ngZone.run(() => this.load(voyageId));
      })
      .subscribe();

    this.rollChannel?.unsubscribe();
    this.rollChannel = this.sb.supabase
      .channel(`play-rolls-${voyageId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'block_rolls' }, () => {
        this.ngZone.run(() => this.loadRolls());
      })
      .subscribe();
  }

  unsubscribe() {
    this.stateChannel?.unsubscribe();
    this.rollChannel?.unsubscribe();
  }

  // ---- run control --------------------------------------------------------

  async start(voyageId: string, turnOrder: string[]): Promise<string | null> {
    return this.writeState({ voyage_id: voyageId, active: true, turn_order: turnOrder, cursor: 0 });
  }

  async stop(): Promise<string | null> {
    const st = this.state();
    if (!st) return null;
    return this.writeState({ ...st, active: false });
  }

  async setTurnOrder(turnOrder: string[]): Promise<string | null> {
    const st = this.state();
    if (!st) return null;
    return this.writeState({ ...st, turn_order: turnOrder });
  }

  /** Step forward; stopping one past the last stop, which renders as "finished". */
  async advance(): Promise<string | null> {
    const st = this.state();
    if (!st) return null;
    return this.writeState({ ...st, cursor: Math.min(st.cursor + 1, this.queue().length) });
  }

  /** Step back one stop. Recorded outcomes stay put so they can be overwritten. */
  async back(): Promise<string | null> {
    const st = this.state();
    if (!st) return null;
    return this.writeState({ ...st, cursor: Math.max(0, st.cursor - 1) });
  }

  async jumpTo(index: number): Promise<string | null> {
    const st = this.state();
    if (!st) return null;
    return this.writeState({ ...st, cursor: Math.max(0, Math.min(index, this.queue().length)) });
  }

  private async writeState(next: Omit<PlayState, 'updated_at'>): Promise<string | null> {
    const row = {
      voyage_id: next.voyage_id,
      active: next.active,
      turn_order: next.turn_order,
      cursor: next.cursor,
      updated_at: new Date().toISOString(),
    };
    // Optimistic — realtime confirms shortly, but the DM shouldn't wait on it.
    this.state.set(row as PlayState);
    const { error } = await this.sb.supabase
      .from('voyage_play_state')
      .upsert(row, { onConflict: 'voyage_id' });
    return error?.message ?? null;
  }

  // ---- rolls --------------------------------------------------------------

  rollFor(blockId: string, rollIndex: number): BlockRoll | undefined {
    return this.rolls().find(r => r.block_id === blockId && r.roll_index === rollIndex);
  }

  rollsForBlock(blockId: string): BlockRoll[] {
    return this.rolls()
      .filter(r => r.block_id === blockId)
      .sort((a, b) => a.roll_index - b.roll_index);
  }

  /** Record (or overwrite) one hour's outcome, then rescore the training. */
  async recordRoll(
    block: ScheduleBlock,
    rollIndex: number,
    outcome: RollOutcome,
  ): Promise<string | null> {
    const { error } = await this.sb.supabase
      .from('block_rolls')
      .upsert({ block_id: block.id, roll_index: rollIndex, outcome }, { onConflict: 'block_id,roll_index' });
    if (error) return error.message;

    await this.loadRolls();
    return this.settle(block);
  }

  /** Mark every hour of a block at once — used by the Outcomes grid. */
  async setAllRolls(block: ScheduleBlock, outcome: RollOutcome): Promise<string | null> {
    const rows = Array.from({ length: SLOT_WEIGHT_UNITS[block.slot_weight] }, (_, i) => ({
      block_id: block.id,
      roll_index: i,
      outcome,
    }));
    const { error } = await this.sb.supabase
      .from('block_rolls')
      .upsert(rows, { onConflict: 'block_id,roll_index' });
    if (error) return error.message;

    await this.loadRolls();
    return this.settle(block);
  }

  /** Wipe a block's rolls and rescore — the undo path. */
  async clearBlockRolls(block: ScheduleBlock): Promise<string | null> {
    const { error } = await this.sb.supabase
      .from('block_rolls')
      .delete()
      .eq('block_id', block.id);
    if (error) return error.message;

    await this.loadRolls();
    return this.settle(block);
  }

  /** Update the block's summary status, then rescore its training. */
  private async settle(block: ScheduleBlock): Promise<string | null> {
    const err = await this.schedule.updateBlockStatus(block.id, this.statusOf(block));
    if (err) return err;
    if (block.is_mandatory) return null;
    return this.rescore(block.user_id, block.crew_member, block.training_topic);
  }

  /**
   * A block stays `pending` until every one of its hours has been rolled; then
   * it reads as a success if any hour landed, a failure if none did.
   */
  private statusOf(block: ScheduleBlock): ScheduleBlock['status'] {
    if (block.is_mandatory) return 'locked';
    const rolls = this.rollsForBlock(block.id);
    if (rolls.length < SLOT_WEIGHT_UNITS[block.slot_weight]) return 'pending';
    return rolls.some(r => r.outcome === 'success') ? 'success' : 'failure';
  }

  // ---- scoring ------------------------------------------------------------

  /**
   * Recompute a training's points from every roll ever recorded against it —
   * across all voyages, not just the loaded one — and write the result.
   */
  async rescore(userId: string, crewMember: string, topic: string): Promise<string | null> {
    const scored = await this.score(userId, crewMember, topic);
    return this.tracker.setProgress(userId, crewMember, topic, scored);
  }

  /**
   * Each successful roll is worth a point. If a training was rolled for at
   * least `PITY_MIN_HOURS` on a given day and every one of those rolls failed,
   * that day is worth a single point for the attempt instead.
   */
  private async score(userId: string, crewMember: string, topic: string): Promise<ScoredProgress> {
    const threshold = this.thresholdOf(crewMember, topic);

    const { data: blockRows } = await this.sb.supabase
      .from('schedule_blocks')
      .select('id, day_id')
      .eq('user_id', userId)
      .eq('crew_member', crewMember)
      .eq('training_topic', topic)
      .eq('is_mandatory', false);

    const blocks = (blockRows as { id: string; day_id: string }[]) ?? [];
    if (blocks.length === 0) return { points: 0, threshold, completed: false };

    const { data: rollRows } = await this.sb.supabase
      .from('block_rolls')
      .select('block_id, outcome')
      .in('block_id', blocks.map(b => b.id));

    const rolls = (rollRows as { block_id: string; outcome: RollOutcome }[]) ?? [];
    const dayOf = new Map(blocks.map(b => [b.id, b.day_id]));

    // Group outcomes by day — the pity point is awarded per training, per day.
    const byDay = new Map<string, RollOutcome[]>();
    for (const roll of rolls) {
      const dayId = dayOf.get(roll.block_id);
      if (!dayId) continue;
      const list = byDay.get(dayId) ?? [];
      list.push(roll.outcome);
      byDay.set(dayId, list);
    }

    let points = 0;
    for (const outcomes of byDay.values()) {
      const successes = outcomes.filter(o => o === 'success').length;
      if (successes > 0) points += successes * POINT_PER_SUCCESS;
      else if (outcomes.length >= PITY_MIN_HOURS) points += PITY_POINT;
    }

    points = Math.min(points, threshold);
    return { points, threshold, completed: points >= threshold };
  }

  private thresholdOf(crewMember: string, topic: string): number {
    return this.trainings.getTraining(crewMember, topic)?.threshold_pp ?? thresholdForTier(1);
  }

  /** Points banked so far, for the runner's progress readout. */
  pointsLabel(block: ScheduleBlock): string {
    const p = this.tracker.getProgress(block.user_id, block.crew_member, block.training_topic);
    return `${p?.pp_accumulated ?? 0}/${p?.threshold_pp ?? this.thresholdOf(block.crew_member, block.training_topic)}`;
  }

  isMastered(block: ScheduleBlock): boolean {
    return this.tracker.getProgress(block.user_id, block.crew_member, block.training_topic)?.completed ?? false;
  }
}
