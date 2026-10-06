import { Injectable, NgZone, signal } from '@angular/core';
import { RealtimeChannel } from '@supabase/supabase-js';
import { SupabaseService } from '../../core/supabase/supabase.service';
import { RelationshipTier } from '../../shared/models';

@Injectable({ providedIn: 'root' })
export class RelationshipService {
  readonly tiers = signal<RelationshipTier[]>([]);

  private channel: RealtimeChannel | null = null;

  constructor(private sb: SupabaseService, private ngZone: NgZone) {}

  /**
   * Load tiers — every player's, or just one player's. A single-player load
   * replaces only that player's rows, so it never drops anyone else's that a
   * DM screen (the ledger, the tracker) is already showing.
   */
  async loadTiers(userId?: string) {
    if (!userId) return this.loadAllTiers();
    const { data } = await this.sb.supabase
      .from('relationship_tiers')
      .select('*')
      .eq('user_id', userId);
    if (data) {
      this.tiers.update(all => [
        ...all.filter(t => t.user_id !== userId),
        ...(data as RelationshipTier[]),
      ]);
    }
  }

  async loadAllTiers() {
    const { data } = await this.sb.supabase
      .from('relationship_tiers')
      .select('*');
    if (data) this.tiers.set(data as RelationshipTier[]);
  }

  /**
   * Follow tier changes live, so a DM's adjustment unlocks (or locks) trainings
   * on every player's screen without a refresh. Owned by the app shell.
   */
  subscribe() {
    if (this.channel) return;
    this.channel = this.sb.supabase
      .channel('relationship-tiers')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'relationship_tiers' }, () => {
        this.ngZone.run(() => this.loadAllTiers());
      })
      .subscribe();
  }

  unsubscribe() {
    this.channel?.unsubscribe();
    this.channel = null;
  }

  getTierForCrewMember(userId: string, crewMember: string): number {
    const tier = this.tiers().find(
      t => t.user_id === userId && t.crew_member === crewMember
    );
    return tier?.tier ?? 1;
  }

  getTiersForUser(userId: string): RelationshipTier[] {
    return this.tiers().filter(t => t.user_id === userId);
  }

  async setTier(userId: string, crewMember: string, tier: number): Promise<string | null> {
    // Optimistic — the DM taps through tiers quickly and shouldn't wait on the round trip.
    const previous = this.tiers();
    const existing = previous.find(t => t.user_id === userId && t.crew_member === crewMember);
    this.tiers.set(
      existing
        ? previous.map(t => (t === existing ? { ...t, tier } : t))
        : [...previous, {
            id: `pending-${userId}-${crewMember}`,
            user_id: userId,
            crew_member: crewMember,
            tier,
            notes: null,
            updated_at: new Date().toISOString(),
          }],
    );

    const { error } = await this.sb.supabase
      .from('relationship_tiers')
      .upsert(
        { user_id: userId, crew_member: crewMember, tier },
        { onConflict: 'user_id,crew_member' }
      );
    if (error) {
      this.tiers.set(previous);
      return error.message;
    }
    await this.loadAllTiers();
    return null;
  }

  async setNotes(userId: string, crewMember: string, notes: string): Promise<string | null> {
    const { error } = await this.sb.supabase
      .from('relationship_tiers')
      .update({ notes })
      .eq('user_id', userId)
      .eq('crew_member', crewMember);
    if (!error) await this.loadAllTiers();
    return error?.message ?? null;
  }
}
