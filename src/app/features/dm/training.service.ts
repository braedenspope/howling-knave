import { Injectable, signal } from '@angular/core';
import { SupabaseService } from '../../core/supabase/supabase.service';
import {
  Training,
  TrainingWithCrew,
  TrainingSession,
  TrainingHiddenBonus,
  CrewMember,
  SLOT_WEIGHT_UNITS,
} from '../../shared/models';

/** A session as edited/created, before it has a DB id. */
export type SessionInput = Omit<TrainingSession, 'id' | 'training_id'>;
/** A hidden bonus as edited/created, before it has a DB id. */
export type HiddenBonusInput = Omit<TrainingHiddenBonus, 'id' | 'training_id'>;

@Injectable({ providedIn: 'root' })
export class TrainingService {
  readonly trainings = signal<TrainingWithCrew[]>([]);
  readonly crewMembers = signal<CrewMember[]>([]);
  readonly loading = signal(false);

  constructor(private sb: SupabaseService) {}

  async loadCrewMembers() {
    const { data } = await this.sb.supabase
      .from('crew_members')
      .select('*')
      .order('id');
    if (data) this.crewMembers.set(data as CrewMember[]);
  }

  async loadTrainings() {
    this.loading.set(true);
    const { data } = await this.sb.supabase
      .from('trainings')
      .select(`
        *,
        crew_members!inner(name, role),
        training_sessions(*),
        training_hidden_bonuses(*)
      `)
      .order('topic');

    if (data) {
      const mapped: TrainingWithCrew[] = data.map((t: any) => {
        const sessions: TrainingSession[] = (t.training_sessions ?? [])
          .map((s: any) => ({
            id: s.id,
            training_id: s.training_id,
            session_number: s.session_number,
            length: s.length,
            roll_type: s.roll_type,
            pp_success: s.pp_success,
            pp_fail: s.pp_fail,
          }))
          .sort((a: TrainingSession, b: TrainingSession) => a.session_number - b.session_number);

        const hb = (t.training_hidden_bonuses ?? [])[0];
        const hidden_bonus: TrainingHiddenBonus | null = hb
          ? { id: hb.id, training_id: hb.training_id, character_name: hb.character_name, body: hb.body }
          : null;

        return {
          id: t.id,
          crew_member_id: t.crew_member_id,
          topic: t.topic,
          description: t.description,
          reward: t.reward,
          scene_seed: t.scene_seed ?? null,
          narrative_thread: t.narrative_thread ?? null,
          slot_weight: t.slot_weight,
          sessions_required: t.sessions_required,
          tier_required: t.tier_required,
          threshold_pp: t.threshold_pp ?? 3,
          created_at: t.created_at,
          updated_at: t.updated_at,
          crew_member_name: t.crew_members.name,
          crew_member_role: t.crew_members.role,
          sessions,
          hidden_bonus,
        };
      });
      this.trainings.set(mapped);
    }
    this.loading.set(false);
  }

  getTrainingsForCrew(crewMemberId: number): TrainingWithCrew[] {
    return this.trainings().filter(t => t.crew_member_id === crewMemberId);
  }

  getTrainingsForCrewByName(crewName: string): TrainingWithCrew[] {
    return this.trainings().filter(t => t.crew_member_name === crewName);
  }

  getTraining(crewName: string, topic: string): TrainingWithCrew | undefined {
    return this.trainings().find(t => t.crew_member_name === crewName && t.topic === topic);
  }

  getAvailableTrainings(crewName: string, playerTier: number, remainingBudget: number) {
    const crewTrainings = this.getTrainingsForCrewByName(crewName);
    return crewTrainings.map(t => ({
      ...t,
      available: t.tier_required <= playerTier,
      // Affordable if at least the shortest session fits the free space.
      affordable: this.minSessionCost(t) <= remainingBudget,
    }));
  }

  private minSessionCost(t: TrainingWithCrew): number {
    const costs = t.sessions.map(s => SLOT_WEIGHT_UNITS[s.length]);
    if (costs.length === 0) return SLOT_WEIGHT_UNITS[t.slot_weight];
    return Math.min(...costs);
  }

  async createTraining(
    training: Omit<Training, 'id' | 'created_at' | 'updated_at'>,
    sessions: SessionInput[] = [],
    hiddenBonus: HiddenBonusInput | null = null,
  ): Promise<string | null> {
    const { data, error } = await this.sb.supabase
      .from('trainings')
      .insert(training)
      .select('id')
      .single();
    if (error) return error.message;

    const trainingId = (data as { id: string }).id;
    const sessErr = await this.replaceSessions(trainingId, sessions);
    if (sessErr) return sessErr;
    const hbErr = await this.replaceHiddenBonus(trainingId, hiddenBonus);
    if (hbErr) return hbErr;

    await this.loadTrainings();
    return null;
  }

  async updateTraining(
    id: string,
    updates: Partial<Training>,
    sessions?: SessionInput[],
    hiddenBonus?: HiddenBonusInput | null,
  ): Promise<string | null> {
    const { error } = await this.sb.supabase.from('trainings').update(updates).eq('id', id);
    if (error) return error.message;

    if (sessions) {
      const sessErr = await this.replaceSessions(id, sessions);
      if (sessErr) return sessErr;
    }
    if (hiddenBonus !== undefined) {
      const hbErr = await this.replaceHiddenBonus(id, hiddenBonus);
      if (hbErr) return hbErr;
    }

    await this.loadTrainings();
    return null;
  }

  async deleteTraining(id: string): Promise<string | null> {
    // training_sessions / training_hidden_bonuses cascade via FK.
    const { error } = await this.sb.supabase
      .from('trainings')
      .delete()
      .eq('id', id);
    if (!error) await this.loadTrainings();
    return error?.message ?? null;
  }

  /** Replace-all: wipe a training's sessions and re-insert the given set. */
  private async replaceSessions(trainingId: string, sessions: SessionInput[]): Promise<string | null> {
    const { error: delErr } = await this.sb.supabase
      .from('training_sessions')
      .delete()
      .eq('training_id', trainingId);
    if (delErr) return delErr.message;

    if (sessions.length === 0) return null;
    const rows = sessions.map((s, i) => ({
      training_id: trainingId,
      session_number: s.session_number || i + 1,
      length: s.length,
      roll_type: s.roll_type,
      pp_success: s.pp_success,
      pp_fail: s.pp_fail,
    }));
    const { error } = await this.sb.supabase.from('training_sessions').insert(rows);
    return error?.message ?? null;
  }

  /** Replace-all: drop any existing hidden bonus, insert the new one if present. */
  private async replaceHiddenBonus(
    trainingId: string,
    hiddenBonus: HiddenBonusInput | null,
  ): Promise<string | null> {
    const { error: delErr } = await this.sb.supabase
      .from('training_hidden_bonuses')
      .delete()
      .eq('training_id', trainingId);
    if (delErr) return delErr.message;

    if (!hiddenBonus || !hiddenBonus.character_name.trim()) return null;
    const { error } = await this.sb.supabase.from('training_hidden_bonuses').insert({
      training_id: trainingId,
      character_name: hiddenBonus.character_name.trim(),
      body: hiddenBonus.body,
    });
    return error?.message ?? null;
  }
}
