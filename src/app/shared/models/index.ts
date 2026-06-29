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
  /** Which session of the training path this block represents (1-based). */
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
  /** Progress Points earned toward this training's threshold. */
  pp_accumulated: number;
  /** PP threshold required to unlock the benefit (3 / 4 / 5). */
  threshold_pp: number;
  /** Failed Short sessions logged; the third short session auto-completes the training. */
  short_fails: number;
  /** Legacy success-count columns, kept populated for back-compat. */
  successes_accumulated: number;
  successes_required: number;
  last_trained_at: string | null;
  completed: boolean;
}

/**
 * One prescribed session within a training path: a length (which sets the
 * block cost), the roll the DM calls for, and the Progress Points it grants
 * on success vs. failure.
 */
export interface TrainingSession {
  id: string;
  training_id: string;
  session_number: number;
  /** Stored as a slot weight; renders as Short / Medium / Long. */
  length: SlotWeight;
  roll_type: string;
  pp_success: number;
  pp_fail: number;
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
  /** DM-facing narrative arc that plays out across the sessions. */
  narrative_thread: string | null;
  /** Representative length (first session); per-session lengths live on `sessions`. */
  slot_weight: SlotWeight;
  sessions_required: number;
  tier_required: number;
  /** Progress Points needed to unlock the benefit. */
  threshold_pp: number;
  created_at: string;
  updated_at: string;
}

export interface TrainingWithCrew extends Training {
  crew_member_name: string;
  crew_member_role: string;
  sessions: TrainingSession[];
  hidden_bonus: TrainingHiddenBonus | null;
}

/**
 * Progress Points awarded by session length, per the campaign rules:
 * Short +1/+0, Medium +2/+1, Long +3/+1. Used as a fallback when a block has
 * no specific session attached.
 */
export const SESSION_PP: Record<SlotWeight, { success: number; fail: number }> = {
  light: { success: 1, fail: 0 },
  medium: { success: 2, fail: 1 },
  heavy: { success: 3, fail: 1 },
};

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
