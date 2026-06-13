import { Component, OnInit, computed } from '@angular/core';
import { TrainingTrackerService } from '../../dm/training-tracker.service';
import { TrainingService } from '../../dm/training.service';
import { RelationshipService } from '../../dm/relationship.service';
import { AuthService } from '../../../core/auth/auth.service';
import {
  CREW_COLORS,
  CREW_META,
  TIER_NAMES,
  TIER_COLORS,
} from '../../../shared/data/training.data';
import {
  TrainingProgress,
  TrainingWithCrew,
  SlotWeight,
  SLOT_WEIGHT_LABEL,
  SLOT_WEIGHT_UNITS,
} from '../../../shared/models';

interface ProgressRow {
  progress: TrainingProgress;
  training?: TrainingWithCrew;
}

interface CrewGroup {
  crew: string;
  role: string;
  tier: number;
  rows: ProgressRow[];
}

interface EarnedAbility {
  topic: string;
  reward: string;
  crew: string;
  color: string;
}

@Component({
  selector: 'app-player-progress',
  standalone: true,
  imports: [],
  templateUrl: './player-progress.component.html',
  styleUrl: './player-progress.component.scss',
})
export class PlayerProgressComponent implements OnInit {
  constructor(
    private tracker: TrainingTrackerService,
    private training: TrainingService,
    private relationships: RelationshipService,
    public auth: AuthService,
  ) {}

  async ngOnInit() {
    const userId = this.auth.userId();
    await Promise.all([
      userId ? this.tracker.loadProgressForUser(userId) : Promise.resolve(),
      this.training.loadTrainings(),
      this.relationships.loadAllTiers(),
    ]);
  }

  private myProgress(): TrainingProgress[] {
    const userId = this.auth.userId();
    return userId ? this.tracker.getProgressForUser(userId) : [];
  }

  private findTraining(crew: string, topic: string): TrainingWithCrew | undefined {
    return this.training
      .trainings()
      .find(t => t.crew_member_name === crew && t.topic === topic);
  }

  masteredCount = computed(() => this.myProgress().filter(p => p.completed).length);
  inProgressCount = computed(() =>
    this.myProgress().filter(p => !p.completed && p.successes_accumulated > 0).length,
  );

  earnedAbilities = computed<EarnedAbility[]>(() => {
    this.training.trainings();
    return this.myProgress()
      .filter(p => p.completed)
      .map(p => {
        const t = this.findTraining(p.crew_member, p.training_topic);
        return {
          topic: p.training_topic,
          reward: t?.reward ?? '',
          crew: p.crew_member,
          color: CREW_COLORS[p.crew_member] ?? '#666',
        };
      });
  });

  groupedProgress = computed<CrewGroup[]>(() => {
    this.training.trainings();
    this.relationships.tiers();
    const userId = this.auth.userId();
    const progress = this.myProgress();
    const map = new Map<string, ProgressRow[]>();
    for (const p of progress) {
      const rows = map.get(p.crew_member) ?? [];
      rows.push({ progress: p, training: this.findTraining(p.crew_member, p.training_topic) });
      map.set(p.crew_member, rows);
    }
    return Array.from(map.entries())
      .map(([crew, rows]) => ({
        crew,
        role: CREW_META[crew]?.role ?? '',
        tier: userId ? this.relationships.getTierForCrewMember(userId, crew) : 1,
        rows,
      }))
      .sort((a, b) => b.tier - a.tier || a.crew.localeCompare(b.crew));
  });

  getCrewColor(name: string): string {
    return CREW_COLORS[name] ?? '#666';
  }
  tierName(tier: number): string {
    return TIER_NAMES[tier] ?? 'Unknown';
  }
  tierColor(tier: number): string {
    return TIER_COLORS[tier] ?? '#5a5040';
  }
  tierPips(tier: number): { n: number; on: boolean; color: string }[] {
    return [1, 2, 3, 4, 5].map(n => ({ n, on: n <= tier, color: TIER_COLORS[n] }));
  }
  lengthLabel(weight: SlotWeight): string {
    return `${SLOT_WEIGHT_LABEL[weight]} · ${SLOT_WEIGHT_UNITS[weight]}`;
  }
  lengthClass(weight: SlotWeight): string {
    return `wt-${weight}`;
  }
  pipArray(n: number): number[] {
    return Array.from({ length: n }, (_, i) => i);
  }
}
