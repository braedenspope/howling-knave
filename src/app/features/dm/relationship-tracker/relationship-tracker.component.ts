import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RelationshipService } from '../relationship.service';
import { ScheduleService } from '../../schedule/schedule.service';
import { CREW_LIST, CREW_COLORS, TIER_NAMES, TIER_COLORS } from '../../../shared/data/training.data';
import { ToastService } from '../../../shared/toast.service';

@Component({
  selector: 'app-relationship-tracker',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './relationship-tracker.component.html',
  styleUrl: './relationship-tracker.component.scss',
})
export class RelationshipTrackerComponent implements OnInit {
  crewList = CREW_LIST;
  private openNotes = signal<Set<string>>(new Set());
  private noteTimers: Record<string, ReturnType<typeof setTimeout>> = {};

  constructor(
    private relationshipService: RelationshipService,
    public scheduleService: ScheduleService,
    private toast: ToastService,
  ) {}

  selectedPlayerId = signal<string | null>(null);

  async ngOnInit() {
    await Promise.all([
      this.relationshipService.loadAllTiers(),
      this.scheduleService.loadAllUsers(),
    ]);
    this.selectedPlayerId.set(this.scheduleService.allUsers()[0]?.id ?? null);
  }

  firstName(name: string): string {
    return name.split(' ')[0];
  }

  getCrewColor(name: string): string {
    return CREW_COLORS[name] ?? '#666';
  }

  getTier(userId: string, crewMember: string): number {
    return this.relationshipService.getTierForCrewMember(userId, crewMember);
  }

  getTierName(userId: string, crewMember: string): string {
    const tier = this.getTier(userId, crewMember);
    return TIER_NAMES[tier] ?? 'Unknown';
  }

  getTierNameByNum(tier: number): string {
    return TIER_NAMES[tier] ?? 'Unknown';
  }

  getTierColor(tier: number): string {
    return TIER_COLORS[tier] ?? '#333';
  }

  async setTier(userId: string, crewMember: string, tier: number) {
    const err = await this.relationshipService.setTier(userId, crewMember, tier);
    if (err) this.toast.warn(err);
  }

  hasNotes(userId: string, crewMember: string): boolean {
    const tiers = this.relationshipService.getTiersForUser(userId);
    const t = tiers.find(r => r.crew_member === crewMember);
    return !!t?.notes;
  }

  getNotesValue(userId: string, crewMember: string): string {
    const tiers = this.relationshipService.getTiersForUser(userId);
    const t = tiers.find(r => r.crew_member === crewMember);
    return t?.notes ?? '';
  }

  toggleNotes(userId: string, crewMember: string) {
    const key = `${userId}:${crewMember}`;
    this.openNotes.update(set => {
      const next = new Set(set);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  isNotesOpen(userId: string, crewMember: string): boolean {
    return this.openNotes().has(`${userId}:${crewMember}`);
  }

  updateNotes(userId: string, crewMember: string, value: string) {
    const key = `${userId}:${crewMember}`;
    // Debounce notes save
    clearTimeout(this.noteTimers[key]);
    this.noteTimers[key] = setTimeout(() => {
      this.relationshipService.setNotes(userId, crewMember, value)
        .then(err => err && this.toast.warn(err));
    }, 800);
  }
}
