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

  async recordSuccess(
    userId: string,
    crewMember: string,
    topic: string,
    successCount: number,
    sessionsRequired: number,
  ): Promise<string | null> {
    const existing = this.getProgress(userId, crewMember, topic);

    if (existing) {
      const newAccumulated = Math.min(
        existing.successes_accumulated + successCount,
        sessionsRequired,
      );
      const completed = newAccumulated >= sessionsRequired;

      const { error } = await this.sb.supabase
        .from('training_progress')
        .update({
          successes_accumulated: newAccumulated,
          completed,
          last_trained_at: new Date().toISOString(),
        })
        .eq('id', existing.id);

      if (!error) await this.loadAllProgress();
      return error?.message ?? null;
    } else {
      const completed = successCount >= sessionsRequired;
      const { error } = await this.sb.supabase
        .from('training_progress')
        .insert({
          user_id: userId,
          crew_member: crewMember,
          training_topic: topic,
          successes_accumulated: Math.min(successCount, sessionsRequired),
          successes_required: sessionsRequired,
          completed,
          last_trained_at: new Date().toISOString(),
        });

      if (!error) await this.loadAllProgress();
      return error?.message ?? null;
    }
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
        successes_accumulated: 0,
        completed: false,
      })
      .eq('id', existing.id);

    if (!error) await this.loadAllProgress();
    return error?.message ?? null;
  }
}
