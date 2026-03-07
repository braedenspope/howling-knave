import { Component, input, output } from '@angular/core';
import { UpperCasePipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ScheduleBlock } from '../../../shared/models';
import { CREW_COLORS } from '../../../shared/data/training.data';

@Component({
  selector: 'app-training-block',
  standalone: true,
  imports: [UpperCasePipe, MatIconModule, MatTooltipModule],
  templateUrl: './training-block.component.html',
  styleUrl: './training-block.component.scss',
})
export class TrainingBlockComponent {
  block = input.required<ScheduleBlock>();
  canRemove = input(false);
  remove = output<string>();

  crewColor() {
    return CREW_COLORS[this.block().crew_member] ?? '#666';
  }
}
