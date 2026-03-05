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
  template: `
    <mat-tab-group (selectedIndexChange)="onPlayerTabChange($event)">
      @for (user of scheduleService.allUsers(); track user.id) {
        <mat-tab [label]="user.character_name">
          <div class="crew-grid">
            @for (crew of crewList; track crew) {
              <div class="crew-card">
                <div class="crew-header">
                  <span class="crew-dot" [style.background]="getCrewColor(crew)"></span>
                  <span class="crew-name">{{ crew }}</span>
                  <span class="tier-name">{{ getTierName(user.id, crew) }}</span>
                  <button
                    mat-icon-button
                    class="notes-toggle"
                    (click)="toggleNotes(user.id, crew)"
                    [matTooltip]="'DM Notes'"
                  >
                    <mat-icon>{{ hasNotes(user.id, crew) ? 'note' : 'note_add' }}</mat-icon>
                  </button>
                </div>
                <div class="tier-pips">
                  @for (pip of [1, 2, 3, 4, 5]; track pip) {
                    <button
                      class="tier-pip"
                      [class.active]="pip <= getTier(user.id, crew)"
                      [style.background]="pip <= getTier(user.id, crew) ? getTierColor(pip) : '#333'"
                      (click)="setTier(user.id, crew, pip)"
                      [matTooltip]="getTierNameByNum(pip)"
                    ></button>
                  }
                </div>
                @if (isNotesOpen(user.id, crew)) {
                  <mat-form-field appearance="outline" class="notes-field">
                    <mat-label>Notes</mat-label>
                    <textarea
                      matInput
                      rows="2"
                      [ngModel]="getNotesValue(user.id, crew)"
                      (ngModelChange)="updateNotes(user.id, crew, $event)"
                    ></textarea>
                  </mat-form-field>
                }
              </div>
            }
          </div>
        </mat-tab>
      }
    </mat-tab-group>
  `,
  styles: [`
    .crew-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 12px;
      padding: 16px 0;
    }

    .crew-card {
      background: rgba(36,28,20,0.4);
      border: 1px solid var(--bg-card-border);
      border-radius: 2px;
      padding: 12px;
      box-shadow: inset 0 0 15px rgba(0,0,0,0.15);
    }

    .crew-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
    }

    .crew-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    .crew-name {
      font-family: var(--font-heading);
      font-size: 13px;
      font-weight: 600;
      flex: 1;
      letter-spacing: 0.5px;
    }

    .tier-name {
      font-family: var(--font-body);
      font-size: 11px;
      color: var(--text-secondary);
      font-style: italic;
    }

    .notes-toggle {
      width: 28px;
      height: 28px;

      mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
      }
    }

    .tier-pips {
      display: flex;
      gap: 6px;
    }

    // Porthole-style pips (circles with progressive sizing)
    .tier-pip {
      width: 16px;
      height: 16px;
      border-radius: 50%;
      border: 2px solid rgba(255, 255, 255, 0.1);
      cursor: pointer;
      transition: transform 0.15s, box-shadow 0.15s;
      padding: 0;

      &:nth-child(2) { width: 18px; height: 18px; }
      &:nth-child(3) { width: 20px; height: 20px; }
      &:nth-child(4) { width: 22px; height: 22px; }
      &:nth-child(5) { width: 24px; height: 24px; }

      &.active {
        border-color: rgba(255, 255, 255, 0.25);
        box-shadow: inset 0 1px 3px rgba(0,0,0,0.3), 0 0 4px rgba(196,154,60,0.2);
      }

      &:hover {
        transform: scale(1.2);
        box-shadow: 0 0 8px rgba(196,154,60,0.3);
      }
    }

    .notes-field {
      width: 100%;
      margin-top: 8px;
    }
  `],
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
