import { Component, OnInit } from '@angular/core';
import { ScheduleService } from '../../schedule/schedule.service';
import { VoyageService } from '../../voyage/voyage.service';
import { PlayService } from '../../play/play.service';
import { CREW_COLORS } from '../../../shared/data/training.data';
import {
  RollOutcome,
  ScheduleBlock,
  SLOT_WEIGHT_LABEL,
  SLOT_WEIGHT_UNITS,
  SlotWeight,
} from '../../../shared/models';
import { ToastService } from '../../../shared/toast.service';

/**
 * The correction grid: every training block of the voyage with its rolls laid
 * out, for fixing what the runner got wrong. Marking here writes the same
 * `block_rolls` the runner does, so both paths score identically.
 */
@Component({
  selector: 'app-block-outcomes',
  standalone: true,
  imports: [],
  templateUrl: './block-outcomes.component.html',
  styleUrl: './block-outcomes.component.scss',
})
export class BlockOutcomesComponent implements OnInit {
  constructor(
    public voyageService: VoyageService,
    public scheduleService: ScheduleService,
    public play: PlayService,
    private toast: ToastService,
  ) {}

  async ngOnInit() {
    await this.play.bootstrap();
  }

  getBlocksForDayUser(dayId: string, userId: string): ScheduleBlock[] {
    return this.scheduleService.getBlocksForDayUser(dayId, userId)
      .filter(b => !b.is_mandatory && b.crew_member !== 'Independent');
  }

  hasOutcomes(dayId: string): boolean {
    return this.scheduleService.allUsers().some(u => this.getBlocksForDayUser(dayId, u.id).length > 0);
  }

  getCrewColor(name: string): string {
    return CREW_COLORS[name] ?? '#666';
  }

  lengthLabel(weight: SlotWeight): string {
    return `${SLOT_WEIGHT_LABEL[weight]} · ${SLOT_WEIGHT_UNITS[weight]}`;
  }
  lengthClass(weight: SlotWeight): string {
    return `wt-${weight}`;
  }

  /** One entry per hour of the block: its outcome, or null if unrolled. */
  rollHistory(block: ScheduleBlock): (RollOutcome | null)[] {
    return Array.from(
      { length: SLOT_WEIGHT_UNITS[block.slot_weight] },
      (_, i) => this.play.rollFor(block.id, i)?.outcome ?? null,
    );
  }

  /** Flip a single hour without disturbing the rest of the block. */
  async toggleRoll(block: ScheduleBlock, index: number) {
    const current = this.play.rollFor(block.id, index)?.outcome;
    const next: RollOutcome = current === 'success' ? 'failure' : 'success';
    const err = await this.play.recordRoll(block, index, next);
    this.toast.show(err ?? `Hour ${index + 1} — ${next === 'success' ? 'success' : 'failure'} · ${this.play.pointsLabel(block)}`);
  }

  statusClass(block: ScheduleBlock): string {
    if (block.status === 'success') return 'outcome-success';
    if (block.status === 'failure') return 'outcome-failure';
    return 'outcome-pending';
  }
  statusLabel(block: ScheduleBlock): string {
    if (block.status === 'success') return 'Success';
    if (block.status === 'failure') return 'Failed';
    return 'Pending';
  }

  getProgressLabel(block: ScheduleBlock): string {
    return `${this.play.pointsLabel(block)} pts`;
  }

  isMastered(block: ScheduleBlock): boolean {
    return this.play.isMastered(block);
  }

  private async setAll(block: ScheduleBlock, outcome: RollOutcome) {
    const err = await this.play.setAllRolls(block, outcome);
    if (err) {
      this.toast.show(err);
      return;
    }
    this.toast.show(
      this.play.isMastered(block)
        ? `${block.training_topic} · UNLOCKED`
        : `${outcome === 'success' ? 'All hours passed' : 'All hours failed'} — ${block.training_topic} · ${this.play.pointsLabel(block)}`,
    );
  }

  async markSuccess(block: ScheduleBlock) {
    await this.setAll(block, 'success');
  }
  async markFailure(block: ScheduleBlock) {
    await this.setAll(block, 'failure');
  }
  async resetBlock(block: ScheduleBlock) {
    const err = await this.play.clearBlockRolls(block);
    this.toast.show(err ?? `Rolls cleared — ${block.training_topic} · ${this.play.pointsLabel(block)}`);
  }
}
