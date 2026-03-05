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
  slot_weight: SlotWeight;
  slot_position: number;
  status: BlockStatus;
  is_mandatory: boolean;
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
  successes_accumulated: number;
  successes_required: number;
  last_trained_at: string | null;
  completed: boolean;
}

export interface Training {
  id: string;
  crew_member_id: number;
  topic: string;
  description: string;
  reward: string;
  slot_weight: SlotWeight;
  sessions_required: number;
  tier_required: number;
  created_at: string;
  updated_at: string;
}

export interface TrainingWithCrew extends Training {
  crew_member_name: string;
  crew_member_role: string;
}

export const SLOT_WEIGHT_UNITS: Record<SlotWeight, number> = {
  heavy: 4,
  medium: 2,
  light: 1,
};

export const DAY_BUDGET = 8;
