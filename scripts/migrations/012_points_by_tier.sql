-- Points-by-tier trainings — players choose how long to train.
--
-- Replaces the prescribed session path (007 / 010) with a flat point goal:
--   * every training needs 12 points per tier: tier 1 = 12, tier 2 = 24,
--     tier 3 = 36 …
--   * players book any training as a Short (1h), Medium (2h) or Long (4h)
--     block; sessions no longer have to be taken in order
--   * the DM calls the roll each hour at the table
--
-- Scoring is otherwise as in 011 — one point per landed roll — except that
-- the "all rolls missed" pity point now needs at least two hours rolled on that
-- training that day (PITY_MIN_HOURS in shared/models), so a lone Short block
-- can't bank a guaranteed point.
--
-- training_sessions and schedule_blocks.session_number are left in place but
-- are no longer read or written by the app.
--
-- Run in the Supabase SQL editor.

update public.trainings
  set threshold_pp = 12 * greatest(tier_required, 1);

-- Keep any existing progress rows in step with their training's new goal.
update public.training_progress p
  set threshold_pp = t.threshold_pp,
      successes_required = t.threshold_pp,
      completed = p.pp_accumulated >= t.threshold_pp
  from public.trainings t
  join public.crew_members c on c.id = t.crew_member_id
  where c.name = p.crew_member
    and t.topic = p.training_topic;
