import { Component, input, computed, signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TrainingBlockComponent } from '../training-block/training-block.component';
import { AddBlockDialogComponent, AddBlockDialogResult } from '../add-block-dialog/add-block-dialog.component';
import { ScheduleService } from '../schedule.service';
import { VoyageService } from '../../voyage/voyage.service';
import { AuthService } from '../../../core/auth/auth.service';
import { Day, ScheduleBlock, DAY_BUDGET, SLOT_WEIGHT_UNITS } from '../../../shared/models';
import { ToastService } from '../../../shared/toast.service';

export interface SlotItem {
  type: 'block' | 'empty';
  block?: ScheduleBlock;
  slotIndex: number;
  span: number;
}

@Component({
  selector: 'app-day-row',
  standalone: true,
  imports: [
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    TrainingBlockComponent,
  ],
  templateUrl: './day-row.component.html',
  styleUrl: './day-row.component.scss',
})
export class DayRowComponent {
  day = input.required<Day>();
  users = input.required<{ id: string; display_name: string; character_name: string }[]>();

  currentUserId = computed(() => this.auth.userId());
  isDm = computed(() => this.auth.isDm());

  // Drag state
  draggingBlock = signal<ScheduleBlock | null>(null);
  dragOverSlot = signal<number | null>(null);

  constructor(
    private scheduleService: ScheduleService,
    private voyageService: VoyageService,
    private auth: AuthService,
    private dialog: MatDialog,
    private toast: ToastService,
  ) {}

  canEdit(userId: string): boolean {
    return userId === this.currentUserId() || this.isDm();
  }

  getPlayerBlocks(userId: string) {
    return this.scheduleService.getBlocksForDayUser(this.day().id, userId);
  }

  private getOccupied(userId: string, excludeBlockId?: string): Set<number> {
    const blocks = this.getPlayerBlocks(userId);
    const occupied = new Set<number>();
    for (const block of blocks) {
      if (block.id === excludeBlockId) continue;
      // When dragging a mandatory block, exclude ALL mandatory blocks on this day
      if (this.draggingBlock()?.is_mandatory && block.is_mandatory) continue;
      const span = SLOT_WEIGHT_UNITS[block.slot_weight];
      for (let s = 0; s < span; s++) {
        occupied.add(block.slot_position + s);
      }
    }
    return occupied;
  }

  getSlotItems(userId: string): SlotItem[] {
    const blocks = this.getPlayerBlocks(userId);
    const items: SlotItem[] = [];

    const dragging = this.draggingBlock();

    let i = 0;
    while (i < DAY_BUDGET) {
      const block = blocks.find(b => b.slot_position === i);
      if (block) {
        const span = SLOT_WEIGHT_UNITS[block.slot_weight];
        // If this block is being dragged, break into individual empty slots as drop targets
        const isDragged = dragging && (
          block.id === dragging.id ||
          (dragging.is_mandatory && block.is_mandatory)
        );
        if (isDragged) {
          for (let s = 0; s < span; s++) {
            items.push({ type: 'empty', slotIndex: i + s, span: 1 });
          }
        } else {
          items.push({ type: 'block', block, slotIndex: i, span });
        }
        i += span;
      } else {
        items.push({ type: 'empty', slotIndex: i, span: 1 });
        i++;
      }
    }

    return items;
  }

  getContiguousEmpty(userId: string, fromSlot: number, excludeBlockId?: string): number {
    const occupied = this.getOccupied(userId, excludeBlockId);
    let count = 0;
    for (let i = fromSlot; i < DAY_BUDGET; i++) {
      if (occupied.has(i)) break;
      count++;
    }
    return count;
  }

  canDropAt(userId: string, slotIndex: number): boolean {
    const block = this.draggingBlock();
    if (!block) return false;
    // Mandatory blocks can drop on any user's row (they sync across all)
    if (!block.is_mandatory && block.user_id !== userId) return false;
    const span = SLOT_WEIGHT_UNITS[block.slot_weight];

    if (block.is_mandatory) {
      // Must fit on ALL players' rows at this position
      return this.users().every(user => {
        const contiguous = this.getContiguousEmpty(user.id, slotIndex, block.id);
        return contiguous >= span;
      });
    }

    const contiguous = this.getContiguousEmpty(userId, slotIndex, block.id);
    return contiguous >= span;
  }

  // --- Drag handlers ---

  onDragStart(event: DragEvent, block: ScheduleBlock) {
    // DM can drag mandatory blocks; regular blocks need canEdit
    if (block.is_mandatory) {
      if (!this.isDm()) {
        event.preventDefault();
        return;
      }
    } else if (!this.canEdit(block.user_id)) {
      event.preventDefault();
      return;
    }
    this.draggingBlock.set(block);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
    }
  }

  onDragEnd() {
    this.draggingBlock.set(null);
    this.dragOverSlot.set(null);
  }

  onDragOver(event: DragEvent, userId: string, slotIndex: number) {
    if (!this.canDropAt(userId, slotIndex)) return;
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
    this.dragOverSlot.set(slotIndex);
  }

  onDragLeave(slotIndex: number) {
    if (this.dragOverSlot() === slotIndex) {
      this.dragOverSlot.set(null);
    }
  }

  async onDrop(event: DragEvent, userId: string, slotIndex: number) {
    event.preventDefault();
    const block = this.draggingBlock();
    if (!block || !this.canDropAt(userId, slotIndex)) return;

    this.draggingBlock.set(null);
    this.dragOverSlot.set(null);

    if (block.is_mandatory) {
      // Move ALL mandatory blocks on this day to the new position
      await this.scheduleService.moveMandatoryBlocks(this.day().id, slotIndex);
    } else {
      // Optimistic update for single block
      this.scheduleService.blocks.update(blocks =>
        blocks.map(b => b.id === block.id ? { ...b, slot_position: slotIndex } : b)
      );
      await this.scheduleService.updateBlockPosition(block.id, slotIndex);
    }
  }

  // --- Remove / Add ---

  async onRemoveBlock(blockId: string) {
    this.scheduleService.blocks.update(blocks => blocks.filter(b => b.id !== blockId));
    await this.scheduleService.removeBlock(blockId);
  }

  async onRemoveDuty() {
    const dayId = this.day().id;
    await this.scheduleService.removeMandatoryBlocks(dayId);
    await this.voyageService.updateDayDuty(dayId, null);
  }

  openAddDialog(userId: string, atSlot: number) {
    const contiguous = this.getContiguousEmpty(userId, atSlot);
    if (contiguous <= 0) return;

    const dialogRef = this.dialog.open(AddBlockDialogComponent, {
      width: '500px',
      maxWidth: '95vw',
      data: { dayId: this.day().id, remainingBudget: contiguous, forUserId: userId },
    });

    dialogRef.afterClosed().subscribe(async (result: AddBlockDialogResult | undefined) => {
      if (result) {
        const err = await this.scheduleService.addBlock(
          this.day().id,
          result.crewMember,
          result.trainingTopic,
          result.slotWeight,
          userId,
          atSlot,
        );
        if (!err) {
          this.toast.show(`Scheduled — ${result.trainingTopic} with ${result.crewMember}`);
        }
      }
    });
  }
}
