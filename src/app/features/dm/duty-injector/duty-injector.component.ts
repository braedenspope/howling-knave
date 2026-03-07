import { Component, signal } from '@angular/core';
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
import { CREW_LIST, CREW_COLORS } from '../../../shared/data/training.data';
import { MandatoryDuty, SlotWeight } from '../../../shared/models';

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
export class DutyInjectorComponent {
  crewList = CREW_LIST;
  editingDay = signal<string | null>(null);

  dutyCrew = '';
  dutyDescription = '';
  dutyWeight: SlotWeight = 'medium';
  dutyConsequenceType: 'crew' | 'ship' | 'both' = 'crew';
  dutyConsequenceDesc = '';

  constructor(
    public voyageService: VoyageService,
    private scheduleService: ScheduleService,
  ) {}

  startEdit(dayId: string) {
    this.editingDay.set(dayId);
    this.dutyCrew = '';
    this.dutyDescription = '';
    this.dutyWeight = 'medium';
    this.dutyConsequenceType = 'crew';
    this.dutyConsequenceDesc = '';
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
    await this.voyageService.updateDayDuty(dayId, duty);
    this.editingDay.set(null);
  }

  async setDutyAndPush(dayId: string) {
    const duty = this.buildDuty();
    await this.voyageService.updateDayDuty(dayId, duty);

    // Push locked mandatory block to every player's row
    const allUsers = this.scheduleService.allUsers();
    for (const user of allUsers) {
      await this.scheduleService.insertMandatoryBlock(
        dayId,
        user.id,
        duty.crew_member,
        duty.task_description,
        duty.slot_weight,
      );
    }

    this.editingDay.set(null);
  }

  async clearDuty(dayId: string) {
    await this.voyageService.updateDayDuty(dayId, null);
  }
}
