import { Component, OnInit, signal } from '@angular/core';
import { UpperCasePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { VoyageService } from '../../voyage/voyage.service';
import { ScheduleService } from '../../schedule/schedule.service';
import { CREW_LIST, DEFAULT_DUTY_HOURS } from '../../../shared/data/training.data';
import { MandatoryDuty, SlotWeight } from '../../../shared/models';
import { ToastService } from '../../../shared/toast.service';

@Component({
  selector: 'app-duty-injector',
  standalone: true,
  imports: [
    UpperCasePipe,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
  ],
  templateUrl: './duty-injector.component.html',
  styleUrl: './duty-injector.component.scss',
})
export class DutyInjectorComponent implements OnInit {
  crewList = CREW_LIST;
  editingDay = signal<string | null>(null);
  dutyHours = signal(DEFAULT_DUTY_HOURS);
  rolling = signal(false);

  dutyCrew = '';
  dutyDescription = '';
  dutyWeight: SlotWeight = 'medium';
  dutyConsequenceType: 'crew' | 'ship' | 'both' = 'crew';
  dutyConsequenceDesc = '';
  dutySlotPosition = 0;

  constructor(
    public voyageService: VoyageService,
    private scheduleService: ScheduleService,
    private toast: ToastService,
  ) {}

  async ngOnInit() {
    await Promise.all([
      this.voyageService.loadVoyages(),
      this.scheduleService.loadAllUsers(),
    ]);
    const voyage = this.voyageService.activeVoyage();
    if (voyage) {
      await this.voyageService.loadDays(voyage.id);
      await this.scheduleService.loadBlocks(this.voyageService.days().map(d => d.id));
    }
  }

  setHours(n: number) {
    this.dutyHours.set(Math.max(1, Math.min(3, n)));
  }

  async rollDay(dayId: string) {
    this.rolling.set(true);
    await this.scheduleService.placeRandomDuties(dayId, this.dutyHours());
    const day = this.voyageService.days().find(d => d.id === dayId);
    this.rolling.set(false);
    this.toast.show(`Watch rolled — Day ${day?.day_number}, ${this.dutyHours()} duties each`);
  }

  async rollAll() {
    const days = this.voyageService.days();
    if (days.length === 0) return;
    this.rolling.set(true);
    await this.scheduleService.placeRandomDutiesForDays(days.map(d => d.id), this.dutyHours());
    this.rolling.set(false);
    this.toast.show(`Watch rolled for all ${days.length} days — ${this.dutyHours()} duties per player`);
  }

  startEdit(dayId: string) {
    this.editingDay.set(dayId);
    this.dutyCrew = '';
    this.dutyDescription = '';
    this.dutyWeight = 'medium';
    this.dutyConsequenceType = 'crew';
    this.dutyConsequenceDesc = '';
    this.dutySlotPosition = 0;
  }

  private buildDuty(): MandatoryDuty {
    return {
      crew_member: this.dutyCrew,
      task_description: this.dutyDescription,
      slot_weight: this.dutyWeight,
      consequence_type: this.dutyConsequenceType,
      consequence_description: this.dutyConsequenceDesc,
    };
  }

  async setDuty(dayId: string) {
    const duty = this.buildDuty();

    // Remove existing mandatory blocks first
    await this.scheduleService.removeMandatoryBlocks(dayId);

    await this.voyageService.updateDayDuty(dayId, duty);

    // Auto-push locked mandatory block to every player's row
    const allUsers = this.scheduleService.allUsers();
    for (const user of allUsers) {
      await this.scheduleService.insertMandatoryBlock(
        dayId,
        user.id,
        duty.crew_member,
        duty.task_description,
        duty.slot_weight,
        this.dutySlotPosition,
      );
    }

    this.editingDay.set(null);
  }

  async clearDuty(dayId: string) {
    await this.scheduleService.removeMandatoryBlocks(dayId);
    await this.voyageService.updateDayDuty(dayId, null);
  }
}
