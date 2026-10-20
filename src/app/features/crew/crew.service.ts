import { Injectable, NgZone, computed, signal } from '@angular/core';
import { RealtimeChannel } from '@supabase/supabase-js';
import { SupabaseService } from '../../core/supabase/supabase.service';
import { CrewMember, CrewUnavailability } from '../../shared/models';

/** The editable fields of a crewmate. */
export type CrewMemberInput = Pick<CrewMember, 'name' | 'role' | 'color' | 'line'>;

/** Drawn for anything whose crewmate isn't on the roster (removed, or still loading). */
export const UNKNOWN_CREW_COLOR = '#666';

/**
 * The ship's roster and who is off-limits on which day. The database is the
 * one source of truth for crew names, roles, colors and order; the DM edits
 * them from the Crew tab and the app shell follows changes live.
 */
@Injectable({ providedIn: 'root' })
export class CrewService {
  readonly members = signal<CrewMember[]>([]);
  readonly unavailability = signal<CrewUnavailability[]>([]);

  /** Crew names in roster order. */
  readonly names = computed(() => this.members().map(m => m.name));

  private readonly byName = computed(() => new Map(this.members().map(m => [m.name, m])));
  private channel: RealtimeChannel | null = null;

  constructor(private sb: SupabaseService, private ngZone: NgZone) {}

  async load() {
    await Promise.all([this.loadMembers(), this.loadUnavailability()]);
  }

  async loadMembers() {
    const { data } = await this.sb.supabase
      .from('crew_members')
      .select('*')
      .order('sort_order')
      .order('id');
    if (data) this.members.set(data as CrewMember[]);
  }

  async loadUnavailability() {
    const { data } = await this.sb.supabase.from('crew_unavailability').select('*');
    if (data) this.unavailability.set(data as CrewUnavailability[]);
  }

  /** Follow roster edits and day blocks live. Owned by the app shell. */
  subscribe() {
    if (this.channel) return;
    this.load();
    this.channel = this.sb.supabase
      .channel('crew')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'crew_members' }, () => {
        this.ngZone.run(() => this.loadMembers());
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'crew_unavailability' }, () => {
        this.ngZone.run(() => this.loadUnavailability());
      })
      .subscribe();
  }

  unsubscribe() {
    this.channel?.unsubscribe();
    this.channel = null;
  }

  // ----- lookups -----

  get(name: string): CrewMember | undefined {
    return this.byName().get(name);
  }
  colorOf(name: string, fallback = UNKNOWN_CREW_COLOR): string {
    return this.get(name)?.color ?? fallback;
  }
  roleOf(name: string): string {
    return this.get(name)?.role ?? '';
  }
  lineOf(name: string): string {
    return this.get(name)?.line ?? '';
  }

  /** The DM's block on this crewmate for this day, if there is one. */
  unavailableOn(name: string, dayId: string): CrewUnavailability | undefined {
    const id = this.get(name)?.id;
    if (id === undefined) return undefined;
    return this.unavailability().find(u => u.crew_member_id === id && u.day_id === dayId);
  }

  // ----- roster edits (DM) -----

  async create(input: CrewMemberInput): Promise<string | null> {
    const sort_order = Math.max(0, ...this.members().map(m => m.sort_order)) + 1;
    const { error } = await this.sb.supabase
      .from('crew_members')
      .insert({ ...this.clean(input), sort_order });
    if (!error) await this.loadMembers();
    return this.message(error);
  }

  /** A rename is carried to every row that names the crewmate by the database. */
  async update(id: number, input: CrewMemberInput): Promise<string | null> {
    const { data, error } = await this.sb.supabase
      .from('crew_members')
      .update(this.clean(input))
      .eq('id', id)
      .select('id');
    if (error) return this.message(error);
    if (!data?.length) return 'Not permitted to edit the crew';
    await this.loadMembers();
    return null;
  }

  /** Removes the crewmate with their trainings, standings, progress and unrolled blocks. */
  async remove(id: number): Promise<string | null> {
    const { error } = await this.sb.supabase.rpc('remove_crew_member', { p_id: id });
    if (!error) await this.load();
    return error?.message ?? null;
  }

  /** Swap a crewmate with their neighbour in roster order. */
  async move(id: number, direction: -1 | 1): Promise<string | null> {
    const list = this.members();
    const i = list.findIndex(m => m.id === id);
    const j = i + direction;
    if (i < 0 || j < 0 || j >= list.length) return null;

    // Renumber the whole roster so ties from older rows can't stall a swap.
    const reordered = [...list];
    [reordered[i], reordered[j]] = [reordered[j], reordered[i]];
    const renumbered = reordered.map((m, n) => ({ ...m, sort_order: n + 1 }));
    this.members.set(renumbered);

    const changed = renumbered.filter(m => list.find(o => o.id === m.id)?.sort_order !== m.sort_order);
    for (const m of changed) {
      const { error } = await this.sb.supabase
        .from('crew_members')
        .update({ sort_order: m.sort_order })
        .eq('id', m.id);
      if (error) {
        await this.loadMembers();
        return error.message;
      }
    }
    return null;
  }

  // ----- day blocks (DM) -----

  async block(crewMemberId: number, dayId: string): Promise<string | null> {
    const row = { crew_member_id: crewMemberId, day_id: dayId };
    const previous = this.unavailability();
    this.unavailability.set([
      ...previous.filter(u => !(u.crew_member_id === crewMemberId && u.day_id === dayId)),
      { ...row, created_at: new Date().toISOString() },
    ]);
    const { error } = await this.sb.supabase.from('crew_unavailability').upsert(row);
    if (error) {
      this.unavailability.set(previous);
      return error.message;
    }
    return null;
  }

  async unblock(crewMemberId: number, dayId: string): Promise<string | null> {
    const previous = this.unavailability();
    this.unavailability.set(
      previous.filter(u => !(u.crew_member_id === crewMemberId && u.day_id === dayId)),
    );
    const { error } = await this.sb.supabase
      .from('crew_unavailability')
      .delete()
      .eq('crew_member_id', crewMemberId)
      .eq('day_id', dayId);
    if (error) {
      this.unavailability.set(previous);
      return error.message;
    }
    return null;
  }

  private clean(input: CrewMemberInput): CrewMemberInput {
    return {
      name: input.name.trim(),
      role: input.role.trim(),
      color: input.color.toLowerCase(),
      line: input.line.trim(),
    };
  }

  private message(error: { code?: string; message: string } | null): string | null {
    if (!error) return null;
    if (error.code === '23505') return 'A crewmate with that name is already aboard';
    return error.message;
  }
}
