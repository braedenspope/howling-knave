import { Component, input, computed } from '@angular/core';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { MatDialog } from '@angular/material/dialog';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';
import { TrainingBlockComponent } from '../training-block/training-block.component';
import { AddBlockDialogComponent, AddBlockDialogResult } from '../add-block-dialog/add-block-dialog.component';
import { ScheduleService } from '../schedule.service';
import { AuthService } from '../../../core/auth/auth.service';
import { Day, DAY_BUDGET, SLOT_WEIGHT_UNITS } from '../../../shared/models';

@Component({
  selector: 'app-day-row',
  standalone: true,
  imports: [
    DragDropModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatChipsModule,
    TrainingBlockComponent,
  ],
  template: `
    <mat-card class="day-card">
      <div class="day-header">
        <h3 class="day-title gold-text">Day {{ day().day_number }}</h3>
        @if (day().mandatory_duty) {
          <span class="duty-badge" [matTooltip]="day().mandatory_duty?.consequence_description ?? ''">
            <mat-icon>warning</mat-icon>
            {{ day().mandatory_duty?.task_description }}
          </span>
        }
      </div>

      @for (user of users(); track user.id) {
        <div class="player-row">
          <div class="player-info">
            <span class="character-name">{{ user.character_name }}</span>
            <span class="display-name">{{ user.display_name }}</span>
            <div class="budget-pips">
              @for (pip of getBudgetPips(user.id); track $index) {
                <div
                  class="pip"
                  [class.pip-used]="pip.used"
                  [class]="'pip-' + pip.weight"
                ></div>
              }
            </div>
          </div>
          <div
            class="blocks-container"
            cdkDropList
            [cdkDropListData]="getPlayerBlocks(user.id)"
            [cdkDropListDisabled]="user.id !== currentUserId()"
            (cdkDropListDropped)="onDrop($event, user.id)"
          >
            @for (block of getPlayerBlocks(user.id); track block.id) {
              <div cdkDrag [cdkDragDisabled]="block.is_mandatory || user.id !== currentUserId()">
                <app-training-block
                  [block]="block"
                  [canRemove]="user.id === currentUserId() && !block.is_mandatory"
                  (remove)="onRemoveBlock($event)"
                />
                <div class="drag-placeholder" *cdkDragPlaceholder></div>
              </div>
            }
            @if (user.id === currentUserId() && getRemainingBudget(user.id) > 0) {
              <button
                mat-icon-button
                class="add-btn"
                (click)="openAddDialog(user.id)"
                matTooltip="Add training block"
              >
                <mat-icon>add</mat-icon>
              </button>
            }
          </div>
        </div>
      }
    </mat-card>
  `,
  styles: [`
    .day-card {
      margin-bottom: 0;
      border-radius: 2px !important;
      padding: 28px 32px;
    }

    .day-header {
      display: flex;
      align-items: center;
      gap: 20px;
      margin-bottom: 20px;
      padding-bottom: 14px;
      border-bottom: 1px solid rgba(61,46,31,0.5);
    }

    .day-title {
      margin: 0;
      font-family: var(--font-heading);
      font-size: 26px;
      letter-spacing: 1.5px;
    }

    .duty-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      font-family: var(--font-data);
      font-size: 15px;
      padding: 6px 16px;
      border-radius: 2px;
      background: rgba(184,115,51,0.15);
      color: var(--accent-copper);
      cursor: help;

      mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
      }
    }

    .player-row {
      display: flex;
      gap: 28px;
      padding: 18px 0;
      border-top: 1px solid rgba(61,46,31,0.3);
      align-items: flex-start;

      &:first-of-type {
        border-top: none;
      }
    }

    .player-info {
      min-width: 220px;
      max-width: 220px;
      flex-shrink: 0;
    }

    .character-name {
      display: block;
      font-family: var(--font-heading);
      font-size: 20px;
      font-weight: 600;
      letter-spacing: 0.5px;
    }

    .display-name {
      display: block;
      font-family: var(--font-body);
      font-size: 16px;
      color: var(--text-secondary);
      font-style: italic;
      margin-top: 4px;
    }

    .budget-pips {
      display: flex;
      gap: 4px;
      margin-top: 10px;
    }

    .pip {
      height: 10px;
      border-radius: 2px;
      background: var(--accent-brass);
      transition: background 0.2s;

      &.pip-heavy { width: 24px; }
      &.pip-medium { width: 16px; }
      &.pip-light { width: 10px; }
      &.pip-unit { width: 10px; }
      &.pip-used { background: #2a1f14; }
    }

    .blocks-container {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
      flex: 1;
      min-height: 60px;
      align-items: flex-start;
    }

    .drag-placeholder {
      background: rgba(196,154,60,0.08);
      border: 1px dashed var(--accent-brass);
      border-radius: 2px;
      min-width: 200px;
      height: 80px;
    }

    .cdk-drag-preview {
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5);
    }

    .cdk-drag-animating {
      transition: transform 250ms ease;
    }

    .add-btn {
      color: var(--text-secondary);
      border: 1px dashed var(--bg-card-border);
      border-radius: 2px;
      width: 52px;
      height: 52px;

      mat-icon {
        font-size: 28px;
        width: 28px;
        height: 28px;
      }

      &:hover {
        color: var(--accent-gold);
        border-color: var(--accent-gold);
      }
    }

    @media (max-width: 600px) {
      .player-row {
        flex-direction: column;
      }

      .player-info {
        max-width: 100%;
      }
    }
  `],
})
export class DayRowComponent {
  day = input.required<Day>();
  users = input.required<{ id: string; display_name: string; character_name: string }[]>();

  currentUserId = computed(() => this.auth.userId());

  constructor(
    private scheduleService: ScheduleService,
    private auth: AuthService,
    private dialog: MatDialog,
  ) {}

  getPlayerBlocks(userId: string) {
    return this.scheduleService.getBlocksForDayUser(this.day().id, userId);
  }

  getRemainingBudget(userId: string): number {
    return this.scheduleService.getRemainingBudget(this.day().id, userId);
  }

  getBudgetPips(userId: string) {
    const blocks = this.getPlayerBlocks(userId);
    const pips: { weight: string; used: boolean }[] = [];

    // Create pips for used blocks
    for (const block of blocks) {
      const units = SLOT_WEIGHT_UNITS[block.slot_weight];
      for (let i = 0; i < units; i++) {
        pips.push({ weight: 'unit', used: true });
      }
    }

    // Fill remaining with empty pips
    const remaining = DAY_BUDGET - pips.length;
    for (let i = 0; i < remaining; i++) {
      pips.push({ weight: 'unit', used: false });
    }

    return pips;
  }

  async onDrop(event: CdkDragDrop<any>, userId: string) {
    if (event.previousIndex === event.currentIndex) return;
    if (userId !== this.auth.userId()) return;

    const blocks = [...this.getPlayerBlocks(userId)];
    moveItemInArray(blocks, event.previousIndex, event.currentIndex);

    // Optimistic update
    for (let i = 0; i < blocks.length; i++) {
      blocks[i] = { ...blocks[i], slot_position: i };
    }
    this.scheduleService.blocks.update(allBlocks => {
      const otherBlocks = allBlocks.filter(
        b => !(b.day_id === this.day().id && b.user_id === userId)
      );
      return [...otherBlocks, ...blocks];
    });

    // Persist each position update
    for (let i = 0; i < blocks.length; i++) {
      await this.scheduleService.updateBlockPosition(blocks[i].id, i);
    }
  }

  async onRemoveBlock(blockId: string) {
    // Optimistic removal
    this.scheduleService.blocks.update(blocks => blocks.filter(b => b.id !== blockId));
    await this.scheduleService.removeBlock(blockId);
  }

  openAddDialog(userId: string) {
    const remaining = this.getRemainingBudget(userId);
    const dialogRef = this.dialog.open(AddBlockDialogComponent, {
      width: '500px',
      data: { dayId: this.day().id, remainingBudget: remaining },
    });

    dialogRef.afterClosed().subscribe(async (result: AddBlockDialogResult | undefined) => {
      if (result) {
        await this.scheduleService.addBlock(
          this.day().id,
          result.crewMember,
          result.trainingTopic,
          result.slotWeight,
        );
      }
    });
  }
}
