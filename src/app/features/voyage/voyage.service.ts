import { Injectable, NgZone, signal, computed } from '@angular/core';
import { SupabaseService } from '../../core/supabase/supabase.service';
import { AuthService } from '../../core/auth/auth.service';
import { Voyage, Day } from '../../shared/models';
import { RealtimeChannel } from '@supabase/supabase-js';

@Injectable({ providedIn: 'root' })
export class VoyageService {
  readonly voyages = signal<Voyage[]>([]);
  readonly activeVoyage = computed(() => this.voyages().find(v => v.is_active) ?? null);
  readonly days = signal<Day[]>([]);
  readonly loading = signal(false);

  private voyageChannel: RealtimeChannel | null = null;
  private dayChannel: RealtimeChannel | null = null;

  constructor(
    private sb: SupabaseService,
    private auth: AuthService,
    private ngZone: NgZone,
  ) {}

  async loadVoyages() {
    this.loading.set(true);
    const { data } = await this.sb.supabase
      .from('voyages')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) this.voyages.set(data as Voyage[]);
    this.loading.set(false);
  }

  async loadDays(voyageId: string) {
    const { data } = await this.sb.supabase
      .from('days')
      .select('*')
      .eq('voyage_id', voyageId)
      .order('day_number', { ascending: true });
    if (data) this.days.set(data as Day[]);
  }

  subscribeToVoyages() {
    this.voyageChannel?.unsubscribe();
    this.voyageChannel = this.sb.supabase
      .channel('voyages-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'voyages' }, () => {
        this.ngZone.run(() => this.loadVoyages());
      })
      .subscribe();
  }

  subscribeToDays(voyageId: string) {
    this.dayChannel?.unsubscribe();
    this.dayChannel = this.sb.supabase
      .channel(`days-${voyageId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'days',
        filter: `voyage_id=eq.${voyageId}`,
      }, () => {
        this.ngZone.run(() => this.loadDays(voyageId));
      })
      .subscribe();
  }

  async createVoyage(name: string, dayCount: number): Promise<string | null> {
    const userId = this.auth.userId();
    if (!userId) return 'Not authenticated';

    // Deactivate any active voyage
    await this.sb.supabase
      .from('voyages')
      .update({ is_active: false })
      .eq('is_active', true);

    // Create new voyage
    const { data: voyage, error } = await this.sb.supabase
      .from('voyages')
      .insert({ name, day_count: dayCount, is_active: true, created_by: userId })
      .select()
      .single();

    if (error) return error.message;

    // Generate day rows
    const dayRows = Array.from({ length: dayCount }, (_, i) => ({
      voyage_id: voyage.id,
      day_number: i + 1,
    }));

    const { error: dayError } = await this.sb.supabase.from('days').insert(dayRows);
    if (dayError) return dayError.message;

    await this.loadVoyages();
    return null;
  }

  async setActiveVoyage(voyageId: string): Promise<string | null> {
    await this.sb.supabase
      .from('voyages')
      .update({ is_active: false })
      .eq('is_active', true);

    const { error } = await this.sb.supabase
      .from('voyages')
      .update({ is_active: true })
      .eq('id', voyageId);

    if (error) return error.message;
    await this.loadVoyages();
    return null;
  }

  async updateDayDuty(dayId: string, duty: Day['mandatory_duty']): Promise<string | null> {
    const { error } = await this.sb.supabase
      .from('days')
      .update({ mandatory_duty: duty })
      .eq('id', dayId);
    return error?.message ?? null;
  }

  unsubscribe() {
    this.voyageChannel?.unsubscribe();
    this.dayChannel?.unsubscribe();
  }
}
