import { Injectable, NgZone, signal, computed, effect } from '@angular/core';
import { SupabaseService } from '../../core/supabase/supabase.service';
import { AuthService } from '../../core/auth/auth.service';
import { ScheduleService } from './schedule.service';
import { ToastService } from '../../shared/toast.service';
import {
  DutyRequest,
  DutyRequestStatus,
  ScheduleBlock,
  SLOT_WEIGHT_UNITS,
} from '../../shared/models';
import { RealtimeChannel } from '@supabase/supabase-js';

/**
 * Feature #2b — duty hand-off requests. A player asks a crewmate to take a
 * ship duty; the target accepts or denies, and on accept the duty moves to
 * their row. Realtime drives the modals on both sides.
 */
@Injectable({ providedIn: 'root' })
export class DutyRequestService {
  readonly requests = signal<DutyRequest[]>([]);
  /** Block the current player is composing a request for (picker open). */
  readonly composeBlock = signal<ScheduleBlock | null>(null);
  private readonly acknowledged = signal<Set<string>>(new Set());

  private channel: RealtimeChannel | null = null;

  constructor(
    private sb: SupabaseService,
    private auth: AuthService,
    private schedule: ScheduleService,
    private toast: ToastService,
    private ngZone: NgZone,
  ) {
    // (Re)load + subscribe whenever the signed-in user changes.
    effect(() => {
      const uid = this.auth.userId();
      if (uid) {
        this.load();
        this.subscribe();
      } else {
        this.requests.set([]);
        this.channel?.unsubscribe();
        this.channel = null;
      }
    });
  }

  private me(): string | null {
    return this.auth.userId();
  }

  async load() {
    const { data } = await this.sb.supabase.from('duty_requests').select('*');
    if (data) this.requests.set(data as DutyRequest[]);
  }

  private subscribe() {
    this.channel?.unsubscribe();
    this.channel = this.sb.supabase
      .channel('duty-requests-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'duty_requests' }, () => {
        this.ngZone.run(() => this.load());
      })
      .subscribe();
  }

  // ----- current-user views -----
  readonly incoming = computed(() =>
    this.requests().filter(r => r.to_user === this.me() && r.status === 'pending'),
  );
  readonly outgoingPending = computed(() =>
    this.requests().filter(r => r.from_user === this.me() && r.status === 'pending'),
  );
  readonly outgoingResolved = computed(() =>
    this.requests().filter(
      r =>
        r.from_user === this.me() &&
        (r.status === 'accepted' || r.status === 'denied') &&
        !this.acknowledged().has(r.id),
    ),
  );

  // ----- compose / send -----
  startCompose(block: ScheduleBlock) {
    this.composeBlock.set(block);
  }
  cancelCompose() {
    this.composeBlock.set(null);
  }

  async send(toUserId: string): Promise<void> {
    const block = this.composeBlock();
    const from = this.me();
    if (!block || !from) return;
    this.composeBlock.set(null);
    const { error } = await this.sb.supabase.from('duty_requests').insert({
      block_id: block.id,
      day_id: block.day_id,
      from_user: from,
      to_user: toUserId,
      status: 'pending',
    });
    if (error) this.toast.show(`Could not send request: ${error.message}`);
    else await this.load();
  }

  // ----- responses -----
  async accept(req: DutyRequest): Promise<void> {
    // Pull the day's current blocks so we move the right duty.
    const dayBlocks = await this.schedule.loadBlocksByDayIds([req.day_id]);
    const block = dayBlocks.find(b => b.id === req.block_id);
    if (!block) {
      await this.setStatus(req, 'denied'); // duty vanished — treat as a no
      return;
    }
    // The duty keeps its hour — it can only move to a crewmate whose same hour is free.
    if (!this.slotFreeFor(dayBlocks, req.to_user, block.slot_position)) {
      this.toast.show('That hour is no longer free for you — decline, or clear the slot first.');
      return; // leave pending so the requester still sees "waiting"
    }
    await this.schedule.reassignDuty(block, req.to_user, block.slot_position);
    await this.setStatus(req, 'accepted');
    this.toast.show('You took on the watch.');
  }

  async deny(req: DutyRequest): Promise<void> {
    await this.setStatus(req, 'denied');
  }

  /** Requester cancels while still waiting. */
  async cancel(req: DutyRequest): Promise<void> {
    await this.sb.supabase.from('duty_requests').delete().eq('id', req.id);
    await this.load();
  }

  /** Requester dismisses the accepted/denied result. */
  async acknowledge(req: DutyRequest): Promise<void> {
    this.acknowledged.update(s => new Set(s).add(req.id));
    await this.sb.supabase.from('duty_requests').delete().eq('id', req.id);
    await this.load();
  }

  private async setStatus(req: DutyRequest, status: DutyRequestStatus): Promise<void> {
    await this.sb.supabase
      .from('duty_requests')
      .update({ status, resolved_at: new Date().toISOString() })
      .eq('id', req.id);
    await this.load();
  }

  /** Is `slot` free for `userId` on this day (i.e. the duty can land in the same hour)? */
  slotFreeFor(dayBlocks: ScheduleBlock[], userId: string, slot: number): boolean {
    return !dayBlocks.some(b => {
      if (b.user_id !== userId) return false;
      const span = SLOT_WEIGHT_UNITS[b.slot_weight];
      return slot >= b.slot_position && slot < b.slot_position + span;
    });
  }
}
