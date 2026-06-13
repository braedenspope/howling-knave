import { Injectable, NgZone, signal } from '@angular/core';
import { SupabaseService } from '../../core/supabase/supabase.service';
import { AuthService } from '../../core/auth/auth.service';
import { DayConfirmation } from '../../shared/models';
import { RealtimeChannel } from '@supabase/supabase-js';

/**
 * Feature #1 — wax-seal confirmations. Each player seals a day; when every
 * player has sealed, the day locks (server trigger flips days.locked).
 */
@Injectable({ providedIn: 'root' })
export class ConfirmationService {
  readonly confirmations = signal<DayConfirmation[]>([]);
  private channel: RealtimeChannel | null = null;
  private dayIds: string[] = [];

  constructor(
    private sb: SupabaseService,
    private auth: AuthService,
    private ngZone: NgZone,
  ) {}

  async load(dayIds: string[]) {
    this.dayIds = dayIds;
    if (dayIds.length === 0) {
      this.confirmations.set([]);
      return;
    }
    const { data } = await this.sb.supabase
      .from('day_confirmations')
      .select('*')
      .in('day_id', dayIds);
    if (data) this.confirmations.set(data as DayConfirmation[]);
  }

  subscribe(voyageId: string) {
    this.channel?.unsubscribe();
    this.channel = this.sb.supabase
      .channel(`confirmations-${voyageId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'day_confirmations' }, () => {
        this.ngZone.run(() => this.load(this.dayIds));
      })
      .subscribe();
  }

  sealedFor(dayId: string): string[] {
    return this.confirmations()
      .filter(c => c.day_id === dayId)
      .map(c => c.user_id);
  }

  isSealed(dayId: string, userId: string): boolean {
    return this.confirmations().some(c => c.day_id === dayId && c.user_id === userId);
  }

  allSealed(dayId: string, playerCount: number): boolean {
    if (playerCount === 0) return false;
    return this.sealedFor(dayId).length >= playerCount;
  }

  async seal(dayId: string, forUserId?: string): Promise<string | null> {
    const userId = forUserId ?? this.auth.userId();
    if (!userId) return 'Not authenticated';
    const { error } = await this.sb.supabase
      .from('day_confirmations')
      .upsert({ day_id: dayId, user_id: userId }, { onConflict: 'day_id,user_id' });
    if (!error) await this.load(this.dayIds);
    return error?.message ?? null;
  }

  async withdraw(dayId: string, forUserId?: string): Promise<string | null> {
    const userId = forUserId ?? this.auth.userId();
    if (!userId) return 'Not authenticated';
    const { error } = await this.sb.supabase
      .from('day_confirmations')
      .delete()
      .eq('day_id', dayId)
      .eq('user_id', userId);
    if (!error) await this.load(this.dayIds);
    return error?.message ?? null;
  }

  unsubscribe() {
    this.channel?.unsubscribe();
  }
}
