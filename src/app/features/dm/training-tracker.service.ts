import { Injectable, signal } from '@angular/core';
import { SupabaseService } from '../../core/supabase/supabase.service';
import { TrainingProgress } from '../../shared/models';

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
   * Apply a Progress-Point delta (positive for an outcome, negative to undo a
   * reset). PP is clamped to [0, threshold]; completion flips at >= threshold.
   */
  async applyPp(
    userId: string,
    crewMember: string,
    topic: string,
    deltaPp: number,
    thresholdPp: number,
  ): Promise<string | null> {
    const existing = this.getProgress(userId, crewMember, topic);

    if (existing) {
      const newAccumulated = Math.max(0, Math.min(existing.pp_accumulated + deltaPp, thresholdPp));
      const completed = newAccumulated >= thresholdPp;

      const { error } = await this.sb.supabase
        .from('training_progress')
        .update({
          pp_accumulated: newAccumulated,
          threshold_pp: thresholdPp,
          successes_accumulated: newAccumulated,
          successes_required: thresholdPp,
          completed,
          last_trained_at: new Date().toISOString(),
        })
        .eq('id', existing.id);

      if (!error) await this.loadAllProgress();
      return error?.message ?? null;
    }

    const accumulated = Math.max(0, Math.min(deltaPp, thresholdPp));
    const completed = accumulated >= thresholdPp;
    const { error } = await this.sb.supabase
      .from('training_progress')
      .insert({
        user_id: userId,
        crew_member: crewMember,
        training_topic: topic,
        pp_accumulated: accumulated,
        threshold_pp: thresholdPp,
        successes_accumulated: accumulated,
        successes_required: thresholdPp,
        completed,
        last_trained_at: new Date().toISOString(),
      });

    if (!error) await this.loadAllProgress();
    return error?.message ?? null;
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
        successes_accumulated: 0,
        completed: false,
      })
      .eq('id', existing.id);

    if (!error) await this.loadAllProgress();
    return error?.message ?? null;
  }
}
