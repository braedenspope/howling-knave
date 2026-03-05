import { Injectable, signal } from '@angular/core';
import { SupabaseService } from '../../core/supabase/supabase.service';
import { RelationshipTier } from '../../shared/models';

@Injectable({ providedIn: 'root' })
export class RelationshipService {
  readonly tiers = signal<RelationshipTier[]>([]);

  constructor(private sb: SupabaseService) {}

  async loadTiers(userId?: string) {
    let query = this.sb.supabase.from('relationship_tiers').select('*');
    if (userId) {
      query = query.eq('user_id', userId);
    }
    const { data } = await query;
    if (data) this.tiers.set(data as RelationshipTier[]);
  }

  async loadAllTiers() {
    const { data } = await this.sb.supabase
      .from('relationship_tiers')
      .select('*');
    if (data) this.tiers.set(data as RelationshipTier[]);
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
    const { error } = await this.sb.supabase
      .from('relationship_tiers')
      .upsert(
        { user_id: userId, crew_member: crewMember, tier },
        { onConflict: 'user_id,crew_member' }
      );
    if (!error) await this.loadAllTiers();
    return error?.message ?? null;
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
