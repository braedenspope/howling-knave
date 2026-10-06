export type UserRole = 'player' | 'dm';
export type SlotWeight = 'heavy' | 'medium' | 'light';
export type BlockStatus = 'pending' | 'success' | 'failure' | 'locked';

export interface AppUser {
  id: string;
  display_name: string;
  character_name: string;
  role: UserRole;
  created_at: string;
}

export interface Voyage {
  id: string;
  name: string;
  day_count: number;
  is_active: boolean;
  created_by: string;
  created_at: string;
}

export interface MandatoryDuty {
  crew_member: string;
  task_description: string;
  slot_weight: SlotWeight;
  consequence_type: 'crew' | 'ship' | 'both';
  consequence_description: string;
}

export interface Day {
  id: string;
  voyage_id: string;
  day_number: number;
  mandatory_duty: MandatoryDuty | null;
  /** True once every player has sealed this day (feature #1). */
  locked?: boolean;
}

export interface DayConfirmation {
  id: string;
  day_id: string;
  user_id: string;
  sealed_at: string;
}

export interface Correction {
  id: string;
  day_id: string;
  user_id: string;
  reason: string | null;
  created_at: string;
}

export type DutyRequestStatus = 'pending' | 'accepted' | 'denied' | 'cancelled';

export interface DutyRequest {
  id: string;
  block_id: string;
  day_id: string;
  from_user: string;
  to_user: string;
  status: DutyRequestStatus;
  created_at: string;
  resolved_at: string | null;
}

export interface SpotlightLogEntry {
  id: string;
  user_id: string;
  voyage_id: string;
  block_id: string | null;
  created_at: string;
}

export interface CrewMember {
  id: number;
  name: string;
  role: string;
}

export interface ScheduleBlock {
  id: string;
  day_id: string;
  user_id: string;
  crew_member: string;
  training_topic: string;
  /** Legacy: which prescribed session this block was (pre-012). No longer written. */
  session_number?: number | null;
  slot_weight: SlotWeight;
  slot_position: number;
  status: BlockStatus;
  is_mandatory: boolean;
  /** Coverer for a ship duty (feature #2). */
  covered_by?: string | null;
  /** Player flagged this training for the table (feature #4). */
  spotlight?: boolean;
  created_at: string;
  updated_at: string;
}

export type RollOutcome = 'success' | 'failure';

/** One rolled hour inside a schedule block (play mode). */
export interface BlockRoll {
  id: string;
  block_id: string;
  /** 0-based offset within the block's span: `hour - slot_position`. */
  roll_index: number;
  outcome: RollOutcome;
  created_at: string;
}

/** The shared play-mode cursor for a voyage — one row, watched by every client. */
export interface PlayState {
  voyage_id: string;
  active: boolean;
  /** Player ids in the order they take their turn each hour. */
  turn_order: string[];
  /** Index into the computed stop queue; equals its length when finished. */
  cursor: number;
  updated_at: string;
}

export interface RelationshipTier {
  id: string;
  user_id: string;
  crew_member: string;
  tier: number;
  notes: string | null;
  updated_at: string;
}

export interface TrainingProgress {
  id: string;
  user_id: string;
  crew_member: string;
  training_topic: string;
  /**
   * Progress Points earned toward this training's threshold — one per landed
   * roll, plus one for any day whose rolls all missed. Always recomputed from
   * `block_rolls`, never incremented.
   */
  pp_accumulated: number;
  /** Points required to unlock the benefit — 12 per tier (see `thresholdForTier`). */
  threshold_pp: number;
  /** Legacy: failed Short sessions under the pre-011 mercy rule. No longer read. */
  short_fails: number;
  /** Legacy success-count columns, kept populated for back-compat. */
  successes_accumulated: number;
  successes_required: number;
  last_trained_at: string | null;
  completed: boolean;
}

/** A bonus that unlocks only for one specific player character. */
export interface TrainingHiddenBonus {
  id: string;
  training_id: string;
  character_name: string;
  body: string;
}

export interface Training {
  id: string;
  crew_member_id: number;
  topic: string;
  description: string;
  reward: string;
  /** DM-facing scene prompt read at the table during the montage. */
  scene_seed: string | null;
  /** DM-facing narrative arc that plays out as the player trains. */
  narrative_thread: string | null;
  /** Legacy (pre-012): players now choose the length of every block. */
  slot_weight: SlotWeight;
  /** Legacy (pre-012): the old prescribed session count. */
  sessions_required: number;
  tier_required: number;
  /** Points needed to unlock the benefit — always `thresholdForTier(tier_required)`. */
  threshold_pp: number;
  created_at: string;
  updated_at: string;
}

export interface TrainingWithCrew extends Training {
  crew_member_name: string;
  crew_member_role: string;
  hidden_bonus: TrainingHiddenBonus | null;
}

export const SLOT_WEIGHT_UNITS: Record<SlotWeight, number> = {
  heavy: 4,
  medium: 2,
  light: 1,
};

/** Display label for a session length (matches the design's Short / Medium / Long). */
export const SLOT_WEIGHT_LABEL: Record<SlotWeight, string> = {
  light: 'Short',
  medium: 'Medium',
  heavy: 'Long',
};

export const DAY_BUDGET = 8;

/**
 * Play mode scoring (migrations 011 + 012): one roll per hour, each success
 * worth one point toward `threshold_pp`. A training whose every roll on a given
 * day fails still earns `PITY_POINT` for the attempt — but only once at least
 * `PITY_MIN_HOURS` were rolled that day, so a lone Short block can't bank a
 * guaranteed point.
 */
export const POINT_PER_SUCCESS = 1;
export const PITY_POINT = 1;
export const PITY_MIN_HOURS = 2;

/** Points each tier of training asks for: tier 1 = 12, tier 2 = 24, tier 3 = 36… */
export const POINTS_PER_TIER = 12;

export function thresholdForTier(tier: number): number {
  return POINTS_PER_TIER * Math.max(1, tier);
}

/** The block lengths a player can choose for any training or activity. */
export const SLOT_WEIGHTS: SlotWeight[] = ['light', 'medium', 'heavy'];
