import { Component } from '@angular/core';
import { SlotWeight, SLOT_WEIGHTS, SLOT_WEIGHT_LABEL, SLOT_WEIGHT_UNITS, thresholdForTier } from '../../shared/models';
import { TIER_NAMES, TIER_COLORS } from '../../shared/data/training.data';

interface LengthCard {
  key: SlotWeight;
  label: string;
  hours: number;
  cost: number;
  blurb: string;
}

interface ThresholdCard {
  pp: number;
  label: string;
  blurb: string;
}

@Component({
  selector: 'app-guide',
  standalone: true,
  imports: [],
  templateUrl: './guide.component.html',
  styleUrl: './guide.component.scss',
})
export class GuideComponent {
  readonly dayBlocks = Array.from({ length: 8 }, (_, i) => i);
  /** An example roll of the watch — two duties, landed at random. */
  private readonly exampleDuties = new Set([2, 5]);

  readonly lengths: LengthCard[] = SLOT_WEIGHTS.map(key => ({
    key,
    label: SLOT_WEIGHT_LABEL[key],
    hours: SLOT_WEIGHT_UNITS[key],
    cost: SLOT_WEIGHT_UNITS[key],
    blurb: BLURBS[key],
  }));

  readonly thresholds: ThresholdCard[] = [
    { pp: thresholdForTier(1), label: 'First trainings', blurb: 'What a crewmate will teach a near-stranger.' },
    { pp: thresholdForTier(2), label: 'Deeper work', blurb: 'Opens once they know you — harder skills, more at stake.' },
    { pp: thresholdForTier(3), label: 'Hard-won', blurb: 'Taught only to someone they trust.' },
  ];

  readonly tiers = [1, 2, 3, 4, 5].map(n => ({
    n,
    name: TIER_NAMES[n],
    color: TIER_COLORS[n],
  }));

  isDutyHour(b: number): boolean {
    return this.exampleDuties.has(b);
  }
  lengthClass(key: SlotWeight): string {
    return `wt-${key}`;
  }
  range(n: number): number[] {
    return Array.from({ length: n }, (_, i) => i);
  }
}

const BLURBS: Record<SlotWeight, string> = {
  light: 'A focused drill, a quick lesson, a single technique.',
  medium: 'A proper training block — it asks for real engagement.',
  extended: 'Most of a watch — time to settle into the work.',
  heavy: 'A full commitment: sustained, demanding work.',
};
