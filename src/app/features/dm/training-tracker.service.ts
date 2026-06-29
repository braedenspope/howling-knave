import { Injectable, signal } from '@angular/core';
import { SupabaseService } from '../../core/supabase/supabase.service';
import { TrainingProgress } from '../../shared/models';

/** Outcome details needed to score one resolved session. */
export interface SessionOutcome {
  isShort: boolean;
  success: boolean;
  ppSuccess: number;
  ppFail: number;
  threshold: number;
}

export interface OutcomeResult {
  pp: number;
  threshold: number;
  completed: boolean;
  /** True when the short-session mercy rule completed the training. */
  pity: boolean;
}

/** Number of failed short sessions after which the next one completes the training. */
const SHORT_FAIL_MERCY = 2;

@Injectable({ providedIn: 'root' })
export class TrainingTrackerService {
  readonly progress = signal<TrainingProgress[]>([]);

  constructor(private sb: SupabaseService) {}

  async loadAllProgress() {
    const { data } = await this.sb.supabase
      .from('training_progress')
      .select('*');
    if (data) this.progress.set(data as TrainingProgress[]);
  }

  async loadProgressForUser(userId: string) {
    const { data } = await this.sb.supabase
      .from('training_progress')
      .select('*')
      .eq('user_id', userId);
    if (data) this.progress.set(data as TrainingProgress[]);
  }

  getProgress(userId: string, crewMember: string, topic: string): TrainingProgress | undefined {
    return this.progress().find(
      p => p.user_id === userId && p.crew_member === crewMember && p.training_topic === topic
    );
  }

  getProgressForUser(userId: string): TrainingProgress[] {
    return this.progress().filter(p => p.user_id === userId);
  }

  /**
   * Score a resolved session. PP accrues toward the threshold; failed short
   * sessions are tallied, and once two have failed the next short session
   * completes the training outright (the mercy rule).
   */
  async markSession(
    userId: string,
    crewMember: string,
    topic: string,
    o: SessionOutcome,
  ): Promise<OutcomeResult> {
    const existing = this.getProgress(userId, crewMember, topic);
    const prevPp = existing?.pp_accumulated ?? 0;
    const prevFails = existing?.short_fails ?? 0;

    const delta = o.success ? o.ppSuccess : o.ppFail;
    const pp = Math.max(0, Math.min(prevPp + delta, o.threshold));
    const shortFails = prevFails + (o.isShort && !o.success ? 1 : 0);

    const pity = o.isShort && prevFails >= SHORT_FAIL_MERCY;
    const completed = pity || pp >= o.threshold;

    await this.write(userId, crewMember, topic, existing?.id, {
      pp,
      shortFails,
      threshold: o.threshold,
      completed,
    });

    return { pp, threshold: o.threshold, completed, pity };
  }

  /** Undo a previously-scored session (when an outcome is changed or reset). */
  async revertSession(
    userId: string,
    crewMember: string,
    topic: string,
    o: { status: 'success' | 'failure'; isShort: boolean; ppSuccess: number; ppFail: number; threshold: number },
  ): Promise<string | null> {
    const existing = this.getProgress(userId, crewMember, topic);
    if (!existing) return null;

    const delta = o.status === 'success' ? o.ppSuccess : o.ppFail;
    const pp = Math.max(0, Math.min(existing.pp_accumulated - delta, o.threshold));
    const shortFails = o.status === 'failure' && o.isShort
      ? Math.max(0, existing.short_fails - 1)
      : existing.short_fails;
    // Recompute completion from scratch — this also drops a mercy-rule completion.
    const pity = shortFails >= SHORT_FAIL_MERCY + 1; // only a logged 3rd+ short fail keeps it
    const completed = pity || pp >= o.threshold;

    return this.write(userId, crewMember, topic, existing.id, {
      pp,
      shortFails,
      threshold: o.threshold,
      completed,
    });
  }

  async resetProgress(
    userId: string,
    crewMember: string,
    topic: string,
  ): Promise<string | null> {
    const existing = this.getProgress(userId, crewMember, topic);
    if (!existing) return null;

    const { error } = await this.sb.supabase
      .from('training_progress')
      .update({
        pp_accumulated: 0,
        short_fails: 0,
        successes_accumulated: 0,
        completed: false,
      })
      .eq('id', existing.id);

    if (!error) await this.loadAllProgress();
    return error?.message ?? null;
  }

  private async write(
    userId: string,
    crewMember: string,
    topic: string,
    id: string | undefined,
    v: { pp: number; shortFails: number; threshold: number; completed: boolean },
  ): Promise<string | null> {
    const row = {
      pp_accumulated: v.pp,
      threshold_pp: v.threshold,
      short_fails: v.shortFails,
      // Legacy mirror columns kept in sync for back-compat.
      successes_accumulated: v.pp,
      successes_required: v.threshold,
      completed: v.completed,
      last_trained_at: new Date().toISOString(),
    };

    const { error } = id
      ? await this.sb.supabase.from('training_progress').update(row).eq('id', id)
      : await this.sb.supabase.from('training_progress').insert({
          user_id: userId,
          crew_member: crewMember,
          training_topic: topic,
          ...row,
        });

    if (!error) await this.loadAllProgress();
    return error?.message ?? null;
  }
}
