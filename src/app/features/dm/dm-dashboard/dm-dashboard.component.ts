import { Component } from '@angular/core';
import { MatTabsModule } from '@angular/material/tabs';
import { BlockOutcomesComponent } from '../block-outcomes/block-outcomes.component';
import { RelationshipTrackerComponent } from '../relationship-tracker/relationship-tracker.component';
import { DutyInjectorComponent } from '../duty-injector/duty-injector.component';
import { TrainingEditorComponent } from '../training-editor/training-editor.component';

@Component({
  selector: 'app-dm-dashboard',
  standalone: true,
  imports: [
    MatTabsModule,
    BlockOutcomesComponent,
    RelationshipTrackerComponent,
    DutyInjectorComponent,
    TrainingEditorComponent,
  ],
  templateUrl: './dm-dashboard.component.html',
  styleUrl: './dm-dashboard.component.scss',
})
export class DmDashboardComponent {}
