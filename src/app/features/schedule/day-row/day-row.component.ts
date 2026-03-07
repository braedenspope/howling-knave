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
  templateUrl: './day-row.component.html',
  styleUrl: './day-row.component.scss',
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
