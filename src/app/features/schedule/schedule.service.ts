import { Injectable, NgZone, signal } from '@angular/core';
import { SupabaseService } from '../../core/supabase/supabase.service';
import { AuthService } from '../../core/auth/auth.service';
import { ScheduleBlock, SlotWeight, SLOT_WEIGHT_UNITS, DAY_BUDGET } from '../../shared/models';
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
  ): Promise<string | null> {
    const userId = this.auth.userId();
    if (!userId) return 'Not authenticated';

    const remaining = this.getRemainingBudget(dayId, userId);
    const cost = SLOT_WEIGHT_UNITS[slotWeight];
    if (cost > remaining) return 'Not enough budget remaining';

    const currentBlocks = this.getBlocksForDayUser(dayId, userId);
    const nextPosition = currentBlocks.length > 0
      ? Math.max(...currentBlocks.map(b => b.slot_position)) + 1
      : 0;

    const { error } = await this.sb.supabase.from('schedule_blocks').insert({
      day_id: dayId,
      user_id: userId,
      crew_member: crewMember,
      training_topic: trainingTopic,
      slot_weight: slotWeight,
      slot_position: nextPosition,
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

  async insertMandatoryBlock(
    dayId: string,
    userId: string,
    crewMember: string,
    taskDescription: string,
    slotWeight: SlotWeight,
  ): Promise<string | null> {
    const { error } = await this.sb.supabase.from('schedule_blocks').insert({
      day_id: dayId,
      user_id: userId,
      crew_member: crewMember,
      training_topic: taskDescription,
      slot_weight: slotWeight,
      slot_position: -1,
      status: 'locked',
      is_mandatory: true,
    });
    return error?.message ?? null;
  }

  unsubscribe() {
    this.channel?.unsubscribe();
  }
}
