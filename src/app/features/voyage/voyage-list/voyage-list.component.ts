import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatSelectModule } from '@angular/material/select';
import { MatChipsModule } from '@angular/material/chips';
import { DatePipe } from '@angular/common';
import { VoyageService } from '../voyage.service';
import { ScheduleService } from '../../schedule/schedule.service';
import { AuthService } from '../../../core/auth/auth.service';
import { Day, MandatoryDuty, ScheduleBlock, SlotWeight, Voyage } from '../../../shared/models';
import { CREW_LIST, CREW_COLORS } from '../../../shared/data/training.data';

@Component({
  selector: 'app-voyage-list',
  standalone: true,
  imports: [
    FormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatDividerModule,
    MatTooltipModule,
    MatExpansionModule,
    MatSelectModule,
    MatChipsModule,
    DatePipe,
  ],
  templateUrl: './voyage-list.component.html',
  styleUrl: './voyage-list.component.scss',
})
export class VoyageListComponent implements OnInit {
  newName = '';
  newDayCount = 7;
  creating = signal(false);
  error = signal<string | null>(null);

  // DM editing state
  editingVoyageId = signal<string | null>(null);
  editName = '';
  expandedVoyageId = signal<string | null>(null);
  voyageDays = signal<Day[]>([]);
  voyageBlocks = signal<ScheduleBlock[]>([]);
  loadingDays = signal(false);

  // Duty editing
  editingDutyDayId = signal<string | null>(null);
  dutyForm = {
    crew_member: '',
    task_description: '',
    slot_weight: 'medium' as SlotWeight,
    consequence_type: 'crew' as 'crew' | 'ship' | 'both',
    consequence_description: '',
  };

  readonly crewList = CREW_LIST;
  readonly crewColors = CREW_COLORS;

  constructor(
    public voyageService: VoyageService,
    public scheduleService: ScheduleService,
    public auth: AuthService,
    private router: Router,
  ) {}

  ngOnInit() {
    this.voyageService.loadVoyages();
    this.scheduleService.loadAllUsers();
  }

  async onCreate() {
    this.creating.set(true);
    this.error.set(null);
    const err = await this.voyageService.createVoyage(this.newName, this.newDayCount);
    this.creating.set(false);
    if (err) {
      this.error.set(err);
    } else {
      this.newName = '';
      this.newDayCount = 7;
    }
  }

  async setActive(voyageId: string) {
    await this.voyageService.setActiveVoyage(voyageId);
  }

  async onDelete(voyageId: string, name: string) {
    if (!confirm(`Delete voyage "${name}"? This will remove all days and training blocks.`)) return;
    const err = await this.voyageService.deleteVoyage(voyageId);
    if (err) this.error.set(err);
    if (this.expandedVoyageId() === voyageId) {
      this.expandedVoyageId.set(null);
    }
  }

  openBoard() {
    this.router.navigate(['/board']);
  }

  // --- Name editing ---

  startEditName(voyage: Voyage) {
    this.editingVoyageId.set(voyage.id);
    this.editName = voyage.name;
  }

  cancelEditName() {
    this.editingVoyageId.set(null);
  }

  async saveName(voyageId: string) {
    if (!this.editName.trim()) return;
    const err = await this.voyageService.updateVoyageName(voyageId, this.editName.trim());
    if (err) this.error.set(err);
    this.editingVoyageId.set(null);
  }

  // --- Day management ---

  async addDay(voyage: Voyage) {
    const err = await this.voyageService.addDays(voyage.id, voyage.day_count, voyage.day_count + 1);
    if (err) this.error.set(err);
    else if (this.expandedVoyageId() === voyage.id) await this.loadVoyageDays(voyage.id);
  }

  async removeLastDay(voyage: Voyage) {
    if (voyage.day_count <= 1) return;
    if (!confirm(`Remove Day ${voyage.day_count}? This will delete any blocks scheduled on that day.`)) return;
    const err = await this.voyageService.removeDays(voyage.id, voyage.day_count - 1);
    if (err) this.error.set(err);
    else if (this.expandedVoyageId() === voyage.id) await this.loadVoyageDays(voyage.id);
  }

  // --- Expand voyage details ---

  async toggleExpand(voyage: Voyage) {
    if (this.expandedVoyageId() === voyage.id) {
      this.expandedVoyageId.set(null);
      return;
    }
    this.expandedVoyageId.set(voyage.id);
    await this.loadVoyageDays(voyage.id);
  }

  async loadVoyageDays(voyageId: string) {
    this.loadingDays.set(true);
    const days = await this.voyageService.loadDaysForVoyage(voyageId);
    this.voyageDays.set(days);

    if (days.length > 0) {
      const dayIds = days.map(d => d.id);
      const blocks = await this.scheduleService.loadBlocksByDayIds(dayIds);
      this.voyageBlocks.set(blocks);
    } else {
      this.voyageBlocks.set([]);
    }
    this.loadingDays.set(false);
  }

  getBlocksForDay(dayId: string): ScheduleBlock[] {
    return this.voyageBlocks().filter(b => b.day_id === dayId);
  }

  getUserName(userId: string): string {
    const user = this.scheduleService.allUsers().find(u => u.id === userId);
    return user?.character_name ?? 'Unknown';
  }

  async deleteBlock(block: ScheduleBlock) {
    if (!confirm(`Delete ${block.crew_member} — ${block.training_topic} block?`)) return;
    const err = await this.scheduleService.removeBlock(block.id);
    if (err) this.error.set(err);
    else {
      this.voyageBlocks.update(blocks => blocks.filter(b => b.id !== block.id));
      // Also update the shared blocks signal so DM dashboard stays in sync
      this.scheduleService.blocks.update(blocks => blocks.filter(b => b.id !== block.id));
    }
  }

  // --- Duty editing ---

  startEditDuty(day: Day) {
    this.editingDutyDayId.set(day.id);
    if (day.mandatory_duty) {
      this.dutyForm = { ...day.mandatory_duty };
    } else {
      this.dutyForm = {
        crew_member: '',
        task_description: '',
        slot_weight: 'medium',
        consequence_type: 'crew',
        consequence_description: '',
      };
    }
  }

  cancelEditDuty() {
    this.editingDutyDayId.set(null);
  }

  async saveDuty(dayId: string) {
    const duty: MandatoryDuty = { ...this.dutyForm };

    // Remove existing mandatory blocks first
    await this.scheduleService.removeMandatoryBlocks(dayId);

    const err = await this.voyageService.updateDayDuty(dayId, duty);
    if (err) {
      this.error.set(err);
    } else {
      this.voyageDays.update(days =>
        days.map(d => d.id === dayId ? { ...d, mandatory_duty: duty } : d)
      );

      // Auto-push mandatory blocks to all players at slot 0
      const allUsers = this.scheduleService.allUsers();
      for (const user of allUsers) {
        await this.scheduleService.insertMandatoryBlock(
          dayId, user.id, duty.crew_member, duty.task_description, duty.slot_weight, 0,
        );
      }
    }
    this.editingDutyDayId.set(null);
    // Reload blocks for the expanded voyage
    if (this.expandedVoyageId()) await this.loadVoyageDays(this.expandedVoyageId()!);
  }

  async clearDuty(dayId: string) {
    await this.scheduleService.removeMandatoryBlocks(dayId);
    const err = await this.voyageService.updateDayDuty(dayId, null);
    if (err) this.error.set(err);
    else {
      this.voyageDays.update(days =>
        days.map(d => d.id === dayId ? { ...d, mandatory_duty: null } : d)
      );
    }
    if (this.expandedVoyageId()) await this.loadVoyageDays(this.expandedVoyageId()!);
  }

  getCrewColor(name: string): string {
    return this.crewColors[name] ?? '#888';
  }
}
