import { Component } from '@angular/core';
import { SlotWeight, SESSION_PP, SLOT_WEIGHT_LABEL, SLOT_WEIGHT_UNITS } from '../../shared/models';
import { TIER_NAMES, TIER_COLORS } from '../../shared/data/training.data';

interface LengthCard {
  key: SlotWeight;
  label: string;
  hours: number;
  cost: number;
  success: number;
  fail: number;
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

  readonly lengths: LengthCard[] = (['light', 'medium', 'heavy'] as SlotWeight[]).map(key => ({
    key,
    label: SLOT_WEIGHT_LABEL[key],
    hours: SLOT_WEIGHT_UNITS[key],
    cost: SLOT_WEIGHT_UNITS[key],
    success: SESSION_PP[key].success,
    fail: SESSION_PP[key].fail,
    blurb: BLURBS[key],
  }));

  readonly thresholds: ThresholdCard[] = [
    { pp: 3, label: 'Straightforward', blurb: 'A clean skill or technique. A few good sessions and it is yours.' },
    { pp: 4, label: 'Demanding', blurb: 'More complex, or carrying some weight. It asks for real commitment.' },
    { pp: 5, label: 'Profound', blurb: 'A hard-won skill — or one that asks something personal of you both.' },
  ];

  readonly tiers = [1, 2, 3, 4, 5].map(n => ({
    n,
    name: TIER_NAMES[n],
    color: TIER_COLORS[n],
  }));

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
  heavy: 'A full commitment: sustained, demanding work.',
};
