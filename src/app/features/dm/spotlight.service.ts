import { Injectable, signal } from '@angular/core';
import { SupabaseService } from '../../core/supabase/supabase.service';
import { SpotlightLogEntry, Voyage } from '../../shared/models';

/**
 * Feature #4 — spotlight rotation ledger. Tracks which voyage each player last
 * had a spotlight scene, so the DM can keep the table fair.
 */
@Injectable({ providedIn: 'root' })
export class SpotlightService {
  readonly log = signal<SpotlightLogEntry[]>([]);

  constructor(private sb: SupabaseService) {}

  async loadAll() {
    const { data } = await this.sb.supabase
      .from('spotlight_log')
      .select('*')
      .order('created_at', { ascending: true });
    if (data) this.log.set(data as SpotlightLogEntry[]);
  }

  /**
   * How many voyages back the player's last spotlight was, given voyages
   * ordered newest-first. Returns Infinity if they've never been spotlit.
   */
  voyagesSinceSpotlight(userId: string, voyagesNewestFirst: Voyage[]): number {
    const last = [...this.log()].reverse().find(e => e.user_id === userId);
    if (!last) return Infinity;
    const idx = voyagesNewestFirst.findIndex(v => v.id === last.voyage_id);
    return idx < 0 ? Infinity : idx;
  }

  isOverdue(userId: string, voyagesNewestFirst: Voyage[]): boolean {
    return this.voyagesSinceSpotlight(userId, voyagesNewestFirst) > 2;
  }

  async choose(userId: string, voyageId: string, blockId: string): Promise<string | null> {
    const { error } = await this.sb.supabase
      .from('spotlight_log')
      .insert({ user_id: userId, voyage_id: voyageId, block_id: blockId });
    if (!error) await this.loadAll();
    return error?.message ?? null;
  }
}
