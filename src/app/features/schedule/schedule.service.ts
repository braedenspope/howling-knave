import { Injectable, NgZone, signal } from '@angular/core';
import { SupabaseService } from '../../core/supabase/supabase.service';
import { AuthService } from '../../core/auth/auth.service';
import { ScheduleBlock, SlotWeight, SLOT_WEIGHT_UNITS, DAY_BUDGET } from '../../shared/models';
import { DUTY_TASKS, DEFAULT_DUTY_HOURS } from '../../shared/data/training.data';
import { RealtimeChannel } from '@supabase/supabase-js';

@Injectable({ providedIn: 'root' })
export class ScheduleService {
  readonly blocks = signal<ScheduleBlock[]>([]);
  readonly allUsers = signal<{ id: string; display_name: string; character_name: string }[]>([]);

  private channel: RealtimeChannel | null = null;
  private currentVoyageDayIds: string[] = [];

  constructor(
    private sb: SupabaseService,
    private auth: AuthService,
    private ngZone: NgZone,
  ) {}

  async loadAllUsers() {
    const { data } = await this.sb.supabase
      .from('users')
      .select('id, display_name, character_name')
      .neq('role', 'dm')
      .order('character_name');
    if (data) this.allUsers.set(data);
  }

  async loadBlocksByDayIds(dayIds: string[]): Promise<ScheduleBlock[]> {
    if (dayIds.length === 0) return [];
    const { data } = await this.sb.supabase
      .from('schedule_blocks')
      .select('*')
      .in('day_id', dayIds)
      .order('slot_position', { ascending: true });
    return (data as ScheduleBlock[]) ?? [];
  }

  async loadBlocks(dayIds: string[]) {
    this.currentVoyageDayIds = dayIds;
    if (dayIds.length === 0) {
      this.blocks.set([]);
      return;
    }
    const { data } = await this.sb.supabase
      .from('schedule_blocks')
      .select('*')
      .in('day_id', dayIds)
      .order('slot_position', { ascending: true });
    if (data) this.blocks.set(data as ScheduleBlock[]);
  }

  subscribeToBlocks(voyageId: string) {
    this.channel?.unsubscribe();
    this.channel = this.sb.supabase
      .channel(`blocks-${voyageId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'schedule_blocks',
      }, (payload) => {
        this.ngZone.run(() => {
          const newBlock = payload.new as ScheduleBlock;
          if (this.currentVoyageDayIds.includes(newBlock.day_id)) {
            this.blocks.update(blocks => [...blocks, newBlock]);
          }
        });
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'schedule_blocks',
      }, (payload) => {
        this.ngZone.run(() => {
          const updated = payload.new as ScheduleBlock;
          this.blocks.update(blocks =>
            blocks.map(b => b.id === updated.id ? updated : b)
          );
        });
      })
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'schedule_blocks',
      }, (payload) => {
        this.ngZone.run(() => {
          const deleted = payload.old as { id: string };
          this.blocks.update(blocks => blocks.filter(b => b.id !== deleted.id));
        });
      })
      .subscribe();
  }

  getBlocksForDayUser(dayId: string, userId: string): ScheduleBlock[] {
    return this.blocks()
      .filter(b => b.day_id === dayId && b.user_id === userId)
      .sort((a, b) => a.slot_position - b.slot_position);
  }

  getUsedBudget(dayId: string, userId: string): number {
    return this.getBlocksForDayUser(dayId, userId)
      .reduce((sum, b) => sum + SLOT_WEIGHT_UNITS[b.slot_weight], 0);
  }

  getRemainingBudget(dayId: string, userId: string): number {
    return DAY_BUDGET - this.getUsedBudget(dayId, userId);
  }

  async addBlock(
    dayId: string,
    crewMember: string,
    trainingTopic: string,
    slotWeight: SlotWeight,
    forUserId?: string,
    atPosition?: number,
    sessionNumber?: number | null,
  ): Promise<string | null> {
    const userId = forUserId ?? this.auth.userId();
    if (!userId) return 'Not authenticated';

    // One training per crew member per day (independent activities may repeat).
    if (crewMember !== 'Independent') {
      const already = this.getBlocksForDayUser(dayId, userId)
        .some(b => !b.is_mandatory && b.crew_member === crewMember);
      if (already) return `Already training with ${crewMember} today`;
    }

    const remaining = this.getRemainingBudget(dayId, userId);
    const cost = SLOT_WEIGHT_UNITS[slotWeight];
    if (cost > remaining) return 'Not enough budget remaining';

    const currentBlocks = this.getBlocksForDayUser(dayId, userId);
    const position = atPosition ?? (currentBlocks.length > 0
      ? Math.max(...currentBlocks.map(b => b.slot_position)) + 1
      : 0);

    // A crew member can't run two *different* trainings in overlapping hours.
    // (Several players joining the *same* training at the same time is fine.)
    if (crewMember !== 'Independent') {
      const end = position + cost;
      const clash = this.blocks().some(b =>
        b.day_id === dayId &&
        !b.is_mandatory &&
        b.crew_member === crewMember &&
        b.training_topic !== trainingTopic &&
        b.slot_position < end &&
        b.slot_position + SLOT_WEIGHT_UNITS[b.slot_weight] > position,
      );
      if (clash) return `${crewMember} is already teaching another training at that hour`;
    }

    const { error } = await this.sb.supabase.from('schedule_blocks').insert({
      day_id: dayId,
      user_id: userId,
      crew_member: crewMember,
      training_topic: trainingTopic,
      slot_weight: slotWeight,
      slot_position: position,
      session_number: sessionNumber ?? null,
    });

    return error?.message ?? null;
  }

  async removeBlock(blockId: string): Promise<string | null> {
    const { error } = await this.sb.supabase
      .from('schedule_blocks')
      .delete()
      .eq('id', blockId);
    return error?.message ?? null;
  }

  async updateBlockPosition(blockId: string, newPosition: number): Promise<string | null> {
    const { error } = await this.sb.supabase
      .from('schedule_blocks')
      .update({ slot_position: newPosition })
      .eq('id', blockId);
    return error?.message ?? null;
  }

  async updateBlockStatus(blockId: string, status: ScheduleBlock['status']): Promise<string | null> {
    const { error } = await this.sb.supabase
      .from('schedule_blocks')
      .update({ status })
      .eq('id', blockId);
    return error?.message ?? null;
  }

  /**
   * Feature #2 — hand a ship duty to another player's row (or take it onto
   * your own). The duty moves to `newUserId` at `newSlotPosition`; `covered_by`
   * remembers the original owner so the ledger can track who carried whom.
   */
  async reassignDuty(
    block: ScheduleBlock,
    newUserId: string,
    newSlotPosition: number,
  ): Promise<string | null> {
    const originalOwner = block.covered_by ?? block.user_id;
    const coveredBy = newUserId === originalOwner ? null : originalOwner;

    this.blocks.update(blocks =>
      blocks.map(b =>
        b.id === block.id
          ? { ...b, user_id: newUserId, covered_by: coveredBy, slot_position: newSlotPosition }
          : b,
      ),
    );
    const { error } = await this.sb.supabase
      .from('schedule_blocks')
      .update({ user_id: newUserId, covered_by: coveredBy, slot_position: newSlotPosition })
      .eq('id', block.id);
    return error?.message ?? null;
  }

  /** Feature #4 — toggle the spotlight flag on a training block. */
  async toggleSpotlight(blockId: string, spotlight: boolean): Promise<string | null> {
    this.blocks.update(blocks =>
      blocks.map(b => (b.id === blockId ? { ...b, spotlight } : b)),
    );
    const { error } = await this.sb.supabase
      .from('schedule_blocks')
      .update({ spotlight })
      .eq('id', blockId);
    return error?.message ?? null;
  }

  async insertMandatoryBlock(
    dayId: string,
    userId: string,
    crewMember: string,
    taskDescription: string,
    slotWeight: SlotWeight,
    slotPosition: number = 0,
  ): Promise<string | null> {
    const { error } = await this.sb.supabase.from('schedule_blocks').insert({
      day_id: dayId,
      user_id: userId,
      crew_member: crewMember,
      training_topic: taskDescription,
      slot_weight: slotWeight,
      slot_position: slotPosition,
      status: 'locked',
      is_mandatory: true,
    });
    return error?.message ?? null;
  }

  /**
   * Randomly place ship-duty hours for a single day — each player gets their
   * own `hoursPerPlayer` distinct 1-block duties in random slots, drawn from
   * the duty-task pool. Clears any existing duties on the day first.
   */
  async placeRandomDuties(
    dayId: string,
    hoursPerPlayer: number = DEFAULT_DUTY_HOURS,
    users?: { id: string }[],
  ): Promise<string | null> {
    const players = users ?? this.allUsers();
    if (players.length === 0) return null;

    await this.removeMandatoryBlocks(dayId);

    const count = Math.max(0, Math.min(hoursPerPlayer, DAY_BUDGET));
    for (const user of players) {
      const slots = this.pickRandomSlots(DAY_BUDGET, count);
      for (const slot of slots) {
        const task = DUTY_TASKS[Math.floor(Math.random() * DUTY_TASKS.length)];
        const err = await this.insertMandatoryBlock(dayId, user.id, 'Ship Duty', task, 'light', slot);
        if (err) return err;
      }
    }
    return null;
  }

  /** Roll duties across every day of a voyage (used when a crossing is declared). */
  async placeRandomDutiesForDays(
    dayIds: string[],
    hoursPerPlayer: number = DEFAULT_DUTY_HOURS,
    users?: { id: string }[],
  ): Promise<string | null> {
    for (const dayId of dayIds) {
      const err = await this.placeRandomDuties(dayId, hoursPerPlayer, users);
      if (err) return err;
    }
    return null;
  }

  /**
   * Feature #3 — Guner's correction detail. Resets the corrected player's day
   * (clearing their training / independent blocks and their own duties, while
   * leaving any watch they're covering for someone else intact) and places
   * `count` one-block ship duties — half the day by default (4 of 8).
   */
  async assignCorrectionDuties(
    dayId: string,
    userId: string,
    count: number = DAY_BUDGET / 2,
  ): Promise<string | null> {
    const keepCovering = (b: ScheduleBlock) =>
      b.is_mandatory && !!b.covered_by && b.covered_by !== userId;

    const { error: delErr } = await this.sb.supabase
      .from('schedule_blocks')
      .delete()
      .eq('day_id', dayId)
      .eq('user_id', userId)
      .or(`covered_by.is.null,covered_by.eq.${userId}`);
    if (delErr) return delErr.message;

    this.blocks.update(blocks =>
      blocks.filter(b => !(b.day_id === dayId && b.user_id === userId && !keepCovering(b))),
    );

    // Place duties only in slots a kept (covering) duty doesn't already hold.
    const occupied = new Set<number>();
    for (const b of this.getBlocksForDayUser(dayId, userId)) {
      const span = SLOT_WEIGHT_UNITS[b.slot_weight];
      for (let s = 0; s < span; s++) occupied.add(b.slot_position + s);
    }
    const free = Array.from({ length: DAY_BUDGET }, (_, i) => i).filter(i => !occupied.has(i));
    for (let i = free.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [free[i], free[j]] = [free[j], free[i]];
    }
    const slots = free.slice(0, Math.max(0, Math.min(count, DAY_BUDGET))).sort((a, b) => a - b);

    for (const slot of slots) {
      const task = DUTY_TASKS[Math.floor(Math.random() * DUTY_TASKS.length)];
      const err = await this.insertMandatoryBlock(dayId, userId, 'Ship Duty', task, 'light', slot);
      if (err) return err;
    }
    return null;
  }

  private pickRandomSlots(total: number, count: number): number[] {
    const pool = Array.from({ length: total }, (_, i) => i);
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, count).sort((a, b) => a - b);
  }

  async removeMandatoryBlocks(dayId: string): Promise<string | null> {
    const { error } = await this.sb.supabase
      .from('schedule_blocks')
      .delete()
      .eq('day_id', dayId)
      .eq('is_mandatory', true);
    if (!error) {
      this.blocks.update(blocks =>
        blocks.filter(b => !(b.day_id === dayId && b.is_mandatory))
      );
    }
    return error?.message ?? null;
  }

  async moveMandatoryBlocks(dayId: string, newPosition: number): Promise<string | null> {
    // Update all mandatory blocks on this day to the new position
    const { error } = await this.sb.supabase
      .from('schedule_blocks')
      .update({ slot_position: newPosition })
      .eq('day_id', dayId)
      .eq('is_mandatory', true);
    if (!error) {
      this.blocks.update(blocks =>
        blocks.map(b =>
          b.day_id === dayId && b.is_mandatory ? { ...b, slot_position: newPosition } : b
        )
      );
    }
    return error?.message ?? null;
  }

  unsubscribe() {
    this.channel?.unsubscribe();
  }
}
