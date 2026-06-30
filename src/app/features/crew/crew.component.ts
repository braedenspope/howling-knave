import { Component, OnInit, signal, computed } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { TrainingService } from '../dm/training.service';
import { RelationshipService } from '../dm/relationship.service';
import { TrainingTrackerService } from '../dm/training-tracker.service';
import { ScheduleService } from '../schedule/schedule.service';
import { AuthService } from '../../core/auth/auth.service';
import {
  CREW_LIST,
  CREW_COLORS,
  CREW_META,
  TIER_NAMES,
  TIER_COLORS,
} from '../../shared/data/training.data';
import {
  TrainingWithCrew,
  SlotWeight,
  SLOT_WEIGHT_LABEL,
  SLOT_WEIGHT_UNITS,
} from '../../shared/models';

type StatusKind = 'mastered' | 'progress' | 'locked' | 'available';

interface PathStatus {
  kind: StatusKind;
  /** Progress Points accumulated toward the threshold. */
  pp: number;
  /** PP threshold to unlock the benefit. */
  threshold: number;
  /** true when this locked path unlocks at exactly the next tier */
  next: boolean;
}

interface CatalogGroup {
  crew: string;
  role: string;
  tier: number;
  paths: { training: TrainingWithCrew; status: PathStatus }[];
}

const CATALOG_FILTERS: { id: 'all' | StatusKind; label: string }[] = [
  { id: 'all', label: 'All paths' },
  { id: 'available', label: 'Available now' },
  { id: 'progress', label: 'In progress' },
  { id: 'locked', label: 'Locked' },
  { id: 'mastered', label: 'Mastered' },
];

@Component({
  selector: 'app-crew',
  standalone: true,
  imports: [NgTemplateOutlet],
  templateUrl: './crew.component.html',
  styleUrl: './crew.component.scss',
})
export class CrewComponent implements OnInit {
  readonly tierNames = TIER_NAMES;
  readonly catalogFilters = CATALOG_FILTERS;

  // view state
  readonly view = signal<'roster' | 'catalog'>('roster');
  readonly detail = signal<string | null>(null);
  readonly filter = signal<'all' | StatusKind>('all');
  readonly viewAs = signal<string | null>(null); // DM: selected player id

  constructor(
    public training: TrainingService,
    private relationships: RelationshipService,
    private tracker: TrainingTrackerService,
    public schedule: ScheduleService,
    public auth: AuthService,
  ) {}

  async ngOnInit() {
    await Promise.all([
      this.training.loadCrewMembers(),
      this.training.loadTrainings(),
      this.relationships.loadAllTiers(),
      this.tracker.loadAllProgress(),
      this.schedule.loadAllUsers(),
    ]);
    if (this.auth.isDm() && !this.viewAs()) {
      this.viewAs.set(this.schedule.allUsers()[0]?.id ?? null);
    }
  }

  // ----- identity / viewing context -----
  readonly viewId = computed(() =>
    this.auth.isDm() ? this.viewAs() : this.auth.userId(),
  );

  readonly viewName = computed(() => {
    const id = this.viewId();
    if (!this.auth.isDm()) return this.auth.profile()?.character_name ?? 'You';
    return this.schedule.allUsers().find(u => u.id === id)?.character_name ?? '';
  });

  // ----- crew sorted by relationship -----
  readonly sortedCrew = computed(() => {
    // touch the tiers signal so this recomputes when relationships load/change
    this.relationships.tiers();
    return [...CREW_LIST].sort((a, b) => this.tierOf(b) - this.tierOf(a));
  });

  readonly catalogGroups = computed<CatalogGroup[]>(() => {
    this.relationships.tiers();
    this.tracker.progress();
    const f = this.filter();
    return CREW_LIST.map(crew => {
      const tier = this.tierOf(crew);
      const paths = this.training
        .getTrainingsForCrewByName(crew)
        .map(t => ({ training: t, status: this.statusFor(crew, t, tier) }))
        .filter(p => f === 'all' || p.status.kind === f);
      return { crew, role: this.crewRole(crew), tier, paths };
    }).filter(g => g.paths.length > 0);
  });

  // ----- helpers -----
  crewColor(name: string): string {
    return CREW_COLORS[name] ?? '#666';
  }
  crewRole(name: string): string {
    // Single source of truth: the database crew_members.role (falls back to
    // the static roster only until the live data has loaded).
    const fromDb = this.training.crewMembers().find(c => c.name === name)?.role;
    return fromDb ?? CREW_META[name]?.role ?? '';
  }
  crewLine(name: string): string {
    return CREW_META[name]?.line ?? '';
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

  tierOf(crew: string): number {
    const id = this.viewId();
    return id ? this.relationships.getTierForCrewMember(id, crew) : 1;
  }

  pathsFor(crew: string): TrainingWithCrew[] {
    return this.training.getTrainingsForCrewByName(crew);
  }

  statusFor(crew: string, t: TrainingWithCrew, tier: number): PathStatus {
    const id = this.viewId();
    const prog = id ? this.tracker.getProgress(id, crew, t.topic) : undefined;
    if (prog?.completed) {
      return { kind: 'mastered', pp: prog.pp_accumulated, threshold: t.threshold_pp, next: false };
    }
    if (prog) {
      return { kind: 'progress', pp: prog.pp_accumulated, threshold: t.threshold_pp, next: false };
    }
    if (tier < t.tier_required) {
      return { kind: 'locked', pp: 0, threshold: t.threshold_pp, next: t.tier_required === tier + 1 };
    }
    return { kind: 'available', pp: 0, threshold: t.threshold_pp, next: false };
  }

  lengthLabel(weight: SlotWeight): string {
    const blocks = SLOT_WEIGHT_UNITS[weight];
    return `${SLOT_WEIGHT_LABEL[weight]} · ${blocks}`;
  }
  lengthClass(weight: SlotWeight): string {
    return `wt-${weight}`;
  }
  pipArray(n: number): number[] {
    return Array.from({ length: n }, (_, i) => i);
  }

  // ----- dossier derived stats -----
  dossierStats(crew: string) {
    const id = this.viewId();
    const paths = this.pathsFor(crew);
    const progs = paths
      .map(t => (id ? this.tracker.getProgress(id, crew, t.topic) : undefined))
      .filter((p): p is NonNullable<typeof p> => !!p);
    const mastered = progs.filter(p => p.completed).length;
    const pp = progs.reduce((a, p) => a + p.pp_accumulated, 0);
    return { pathCount: paths.length, mastered, pp };
  }

  nextUnlocks(crew: string): TrainingWithCrew[] {
    const tier = this.tierOf(crew);
    if (tier >= 5) return [];
    return this.pathsFor(crew).filter(t => t.tier_required === tier + 1);
  }

  nextUnlocksTopics(crew: string): string {
    return this.nextUnlocks(crew).map(t => t.topic).join(', ');
  }

  firstName(crew: string): string {
    return crew.split(' ')[0];
  }

  // ----- actions -----
  openDossier(crew: string) {
    this.detail.set(crew);
    window.scrollTo(0, 0);
  }
  closeDossier() {
    this.detail.set(null);
  }
  onCardKey(e: KeyboardEvent, crew: string) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      this.openDossier(crew);
    }
  }
}
