-- Mercy rule for short trainings.
--
-- A failed Short session grants 0 PP, so a run of bad luck could otherwise
-- leave a player grinding forever. We count failed short sessions per training;
-- once a player has failed two, the third short session completes the training
-- automatically (see TrainingTrackerService.markSession).
--
-- Run in the Supabase SQL editor.

alter table public.training_progress
  add column if not exists short_fails integer not null default 0;
