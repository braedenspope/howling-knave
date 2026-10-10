import { Injectable, NgZone, computed, inject, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { Observable, filter, map } from 'rxjs';
import { RealtimeChannel } from '@supabase/supabase-js';
import { SupabaseService } from '../../core/supabase/supabase.service';
import { AuthService } from '../../core/auth/auth.service';
import { CalendarEvent, CalendarEventVisibility } from '../../shared/models';
import { ArgousDate, addDays, fromAbsDay, toAbsDay } from './engine';

export interface CalendarEventDraft {
  abs_day: number;
  title: string;
  body: string | null;
  visibility: CalendarEventVisibility;
}

/**
 * The campaign's in-game date and its dated events. One clock row, watched live
 * by every client; only the DM writes (RLS enforces it — these methods just
 * surface the refusal). Owned by the app shell so the header banner is always
 * current.
 */
@Injectable({ providedIn: 'root' })
export class ChronometerService {
  private sb = inject(SupabaseService);
  private auth = inject(AuthService);
  private ngZone = inject(NgZone);

  /** Null until the clock row has loaded. */
  readonly currentAbsDay = signal<number | null>(null);
  /** True once the clock has been fetched — tells "loading" from "no clock row". */
  readonly clockLoaded = signal(false);
  readonly currentDate = computed(() => {
    const abs = this.currentAbsDay();
    return abs === null ? null : fromAbsDay(abs);
  });
  /** Every event this viewer may read — all of them for the DM, `player` ones otherwise. */
  readonly events = signal<CalendarEvent[]>([]);

  readonly currentAbsDay$: Observable<number> = toObservable(this.currentAbsDay).pipe(
    filter((abs): abs is number => abs !== null),
  );
  readonly currentDate$: Observable<ArgousDate> = this.currentAbsDay$.pipe(map(fromAbsDay));
  private readonly events$all = toObservable(this.events);

  private channel: RealtimeChannel | null = null;

  /** Events on days `fromAbs`..`toAbs` inclusive, soonest first. */
  events$(fromAbs: number, toAbs: number): Observable<CalendarEvent[]> {
    return this.events$all.pipe(
      map(events => events.filter(e => e.abs_day >= fromAbs && e.abs_day <= toAbs)),
    );
  }

  async load() {
    await Promise.all([this.loadClock(), this.loadEvents()]);
  }

  private async loadClock() {
    const { data } = await this.sb.supabase
      .from('campaign_clock')
      .select('current_abs_day')
      .maybeSingle();
    if (data) this.currentAbsDay.set(data.current_abs_day);
    this.clockLoaded.set(true);
  }

  private async loadEvents() {
    const { data } = await this.sb.supabase
      .from('calendar_events')
      .select('*')
      .order('abs_day')
      .order('created_at');
    if (data) this.events.set(data as CalendarEvent[]);
  }

  /**
   * Follow the clock and events live. Realtime applies RLS, so a player is never
   * sent a DM-only row — but that also means they get no notice when the DM
   * hides an event they could already see. The `events-changed` broadcast the
   * DM sends after every event write covers that: everyone refetches.
   */
  subscribe() {
    if (this.channel) return;
    this.channel = this.sb.supabase
      .channel('chronometer')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'campaign_clock' }, payload => {
        const row = payload.new as { current_abs_day?: number };
        this.ngZone.run(() => {
          if (typeof row?.current_abs_day === 'number') this.currentAbsDay.set(row.current_abs_day);
          else this.loadClock();
        });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'calendar_events' }, () => {
        this.ngZone.run(() => this.loadEvents());
      })
      .on('broadcast', { event: 'events-changed' }, () => {
        this.ngZone.run(() => this.loadEvents());
      })
      .subscribe();
  }

  unsubscribe() {
    this.channel?.unsubscribe();
    this.channel = null;
  }

  // ----- clock (DM) -----

  /** The single entry point for moving time forward — the voyage module may call this later. */
  async advanceDays(n: number): Promise<void> {
    const abs = this.currentAbsDay();
    if (abs === null) throw new Error('The clock has not loaded yet.');
    await this.writeClock(addDays(abs, n));
  }

  /** Throws a RangeError (from the engine) for a date that doesn't exist. */
  async setDate(d: ArgousDate): Promise<void> {
    await this.writeClock(toAbsDay(d));
  }

  private async writeClock(abs: number) {
    const { data, error } = await this.sb.supabase
      .from('campaign_clock')
      .update({
        current_abs_day: abs,
        updated_at: new Date().toISOString(),
        updated_by: this.auth.userId(),
      })
      .eq('id', true)
      .select('current_abs_day');
    if (error) throw new Error(error.message);
    // RLS refusals on update come back as zero rows, not an error.
    if (!data?.length) throw new Error('Only the DM can change the date.');
    this.currentAbsDay.set(abs);
  }

  // ----- events (DM) -----

  async createEvent(draft: CalendarEventDraft): Promise<void> {
    const { error } = await this.sb.supabase
      .from('calendar_events')
      .insert({ ...draft, created_by: this.auth.userId() });
    await this.afterEventWrite(error);
  }

  async updateEvent(id: string, draft: CalendarEventDraft): Promise<void> {
    const { error } = await this.sb.supabase.from('calendar_events').update(draft).eq('id', id);
    await this.afterEventWrite(error);
  }

  async deleteEvent(id: string): Promise<void> {
    const { error } = await this.sb.supabase.from('calendar_events').delete().eq('id', id);
    await this.afterEventWrite(error);
  }

  private async afterEventWrite(error: { message: string } | null) {
    if (error) throw new Error(error.message);
    await this.loadEvents();
    this.channel?.send({ type: 'broadcast', event: 'events-changed', payload: {} });
  }

  // ----- day notes (DM only; RLS returns nothing to anyone else) -----

  async getNote(abs: number): Promise<string> {
    const { data } = await this.sb.supabase
      .from('calendar_day_notes')
      .select('body')
      .eq('abs_day', abs)
      .maybeSingle();
    return data?.body ?? '';
  }

  /** Saves the note; an empty note removes the row. */
  async saveNote(abs: number, body: string): Promise<void> {
    const { error } = body.trim()
      ? await this.sb.supabase
          .from('calendar_day_notes')
          .upsert({ abs_day: abs, body, updated_at: new Date().toISOString() })
      : await this.sb.supabase.from('calendar_day_notes').delete().eq('abs_day', abs);
    if (error) throw new Error(error.message);
  }
}
