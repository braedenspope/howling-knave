import { Injectable, signal } from '@angular/core';
import { SupabaseService } from '../../core/supabase/supabase.service';
import { Training, TrainingWithCrew, CrewMember } from '../../shared/models';

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
        crew_members!inner(name, role)
      `)
      .order('topic');

    if (data) {
      const mapped: TrainingWithCrew[] = data.map((t: any) => ({
        id: t.id,
        crew_member_id: t.crew_member_id,
        topic: t.topic,
        description: t.description,
        reward: t.reward,
        scene_seed: t.scene_seed ?? null,
        slot_weight: t.slot_weight,
        sessions_required: t.sessions_required,
        tier_required: t.tier_required,
        created_at: t.created_at,
        updated_at: t.updated_at,
        crew_member_name: t.crew_members.name,
        crew_member_role: t.crew_members.role,
      }));
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

  getAvailableTrainings(crewName: string, playerTier: number, remainingBudget: number) {
    const crewTrainings = this.getTrainingsForCrewByName(crewName);
    return crewTrainings.map(t => ({
      ...t,
      available: t.tier_required <= playerTier,
      affordable: this.getSlotCost(t.slot_weight) <= remainingBudget,
    }));
  }

  private getSlotCost(weight: string): number {
    switch (weight) {
      case 'heavy': return 4;
      case 'medium': return 2;
      case 'light': return 1;
      default: return 0;
    }
  }

  /** PostgREST raises this when a payload references a column the schema lacks. */
  private isMissingColumn(error: { code?: string; message?: string } | null): boolean {
    if (!error) return false;
    return error.code === 'PGRST204' || /scene_seed/.test(error.message ?? '');
  }

  async createTraining(training: Omit<Training, 'id' | 'created_at' | 'updated_at'>): Promise<string | null> {
    let { error } = await this.sb.supabase.from('trainings').insert(training);
    // Gracefully degrade if the scene_seed migration hasn't been applied yet.
    if (this.isMissingColumn(error)) {
      const { scene_seed, ...rest } = training as Record<string, unknown>;
      ({ error } = await this.sb.supabase.from('trainings').insert(rest));
    }
    if (!error) await this.loadTrainings();
    return error?.message ?? null;
  }

  async updateTraining(id: string, updates: Partial<Training>): Promise<string | null> {
    let { error } = await this.sb.supabase.from('trainings').update(updates).eq('id', id);
    if (this.isMissingColumn(error)) {
      const { scene_seed, ...rest } = updates as Record<string, unknown>;
      ({ error } = await this.sb.supabase.from('trainings').update(rest).eq('id', id));
    }
    if (!error) await this.loadTrainings();
    return error?.message ?? null;
  }

  async deleteTraining(id: string): Promise<string | null> {
    const { error } = await this.sb.supabase
      .from('trainings')
      .delete()
      .eq('id', id);
    if (!error) await this.loadTrainings();
    return error?.message ?? null;
  }
}
