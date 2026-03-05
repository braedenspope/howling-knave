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
  template: `
    <div class="dm-container">
      <h1 class="gold-text dm-title">DM Dashboard</h1>
      <mat-tab-group>
        <mat-tab label="Block Outcomes">
          <div class="tab-content">
            <app-block-outcomes />
          </div>
        </mat-tab>
        <mat-tab label="Relationships">
          <div class="tab-content">
            <app-relationship-tracker />
          </div>
        </mat-tab>
        <mat-tab label="Ship Duties">
          <div class="tab-content">
            <app-duty-injector />
          </div>
        </mat-tab>
        <mat-tab label="Trainings">
          <div class="tab-content">
            <app-training-editor />
          </div>
        </mat-tab>
      </mat-tab-group>
    </div>
  `,
  styles: [`
    .dm-container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 16px;
    }

    .dm-title {
      margin: 0 0 16px;
      font-family: var(--font-heading);
      font-size: 24px;
      letter-spacing: 1.5px;
      text-shadow: 0 1px 3px rgba(0,0,0,0.4);
    }

    .tab-content {
      padding: 16px 0;
    }
  `],
})
export class DmDashboardComponent {}
