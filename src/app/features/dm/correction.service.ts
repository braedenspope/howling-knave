import { Injectable, NgZone, signal } from '@angular/core';
import { SupabaseService } from '../../core/supabase/supabase.service';
import { Correction } from '../../shared/models';
import { RealtimeChannel } from '@supabase/supabase-js';

/**
 * Feature #3 — Guner's correction detail. The DM locks one player's training
 * for a single day; their training slots are barred while the correction stands.
 */
@Injectable({ providedIn: 'root' })
export class CorrectionService {
  readonly corrections = signal<Correction[]>([]);
  private channel: RealtimeChannel | null = null;

  constructor(private sb: SupabaseService, private ngZone: NgZone) {}

  async loadAll() {
    const { data } = await this.sb.supabase.from('corrections').select('*');
    if (data) this.corrections.set(data as Correction[]);
  }

  subscribe() {
    this.channel?.unsubscribe();
    this.channel = this.sb.supabase
      .channel('corrections-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'corrections' }, () => {
        this.ngZone.run(() => this.loadAll());
      })
      .subscribe();
  }

  isCorrected(dayId: string, userId: string): boolean {
    return this.corrections().some(c => c.day_id === dayId && c.user_id === userId);
  }

  countForUser(userId: string): number {
    return this.corrections().filter(c => c.user_id === userId).length;
  }

  async setCorrection(dayId: string, userId: string, reason: string): Promise<string | null> {
    const { error } = await this.sb.supabase
      .from('corrections')
      .upsert({ day_id: dayId, user_id: userId, reason }, { onConflict: 'day_id,user_id' });
    if (!error) await this.loadAll();
    return error?.message ?? null;
  }

  async clear(dayId: string, userId: string): Promise<string | null> {
    const { error } = await this.sb.supabase
      .from('corrections')
      .delete()
      .eq('day_id', dayId)
      .eq('user_id', userId);
    if (!error) await this.loadAll();
    return error?.message ?? null;
  }

  unsubscribe() {
    this.channel?.unsubscribe();
  }
}
