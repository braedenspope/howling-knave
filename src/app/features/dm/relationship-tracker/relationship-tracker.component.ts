import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatTabsModule } from '@angular/material/tabs';
import { RelationshipService } from '../relationship.service';
import { ScheduleService } from '../../schedule/schedule.service';
import { CREW_LIST, CREW_COLORS, TIER_NAMES, TIER_COLORS } from '../../../shared/data/training.data';
import { RelationshipTier } from '../../../shared/models';

@Component({
  selector: 'app-relationship-tracker',
  standalone: true,
  imports: [
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatFormFieldModule,
    MatInputModule,
    MatTabsModule,
  ],
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
  ) {}

  async ngOnInit() {
    await this.relationshipService.loadAllTiers();
  }

  onPlayerTabChange(_index: number) {
    // Tiers already loaded for all users
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
    await this.relationshipService.setTier(userId, crewMember, tier);
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
      this.relationshipService.setNotes(userId, crewMember, value);
    }, 800);
  }
}
