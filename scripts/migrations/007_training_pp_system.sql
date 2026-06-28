-- Progress-Point (PP) training system.
--
-- Replaces the flat "successes accumulated vs. required" model with:
--   * a PP threshold per training (3 / 4 / 5),
--   * a prescribed list of sessions per training (length + roll + PP success/fail),
--   * an optional hidden bonus that unlocks for one specific player character,
--   * PP-based progress tracking.
--
-- Run this in the Supabase SQL editor, then run 008_seed_initial_trainings.sql.

-- ---- trainings: PP threshold + DM-facing narrative thread ----
alter table public.trainings
  add column if not exists threshold_pp integer not null default 3;

alter table public.trainings
  add column if not exists narrative_thread text;

-- ---- per-session breakdown (the prescribed path the DM runs) ----
create table if not exists public.training_sessions (
  id uuid primary key default gen_random_uuid(),
  training_id uuid not null references public.trainings(id) on delete cascade,
  session_number integer not null,
  length text not null check (length in ('light', 'medium', 'heavy')),
  roll_type text not null,
  pp_success integer not null default 0,
  pp_fail integer not null default 0,
  unique (training_id, session_number)
);

create index if not exists training_sessions_training_id_idx
  on public.training_sessions (training_id);

-- ---- hidden bonus: unlocks for one named player character ----
create table if not exists public.training_hidden_bonuses (
  id uuid primary key default gen_random_uuid(),
  training_id uuid not null references public.trainings(id) on delete cascade unique,
  character_name text not null,
  body text not null
);

-- ---- training_progress: track Progress Points against the threshold ----
alter table public.training_progress
  add column if not exists pp_accumulated integer not null default 0;

alter table public.training_progress
  add column if not exists threshold_pp integer not null default 3;

-- Legacy columns stay populated for safety; default them so inserts that only
-- write the PP columns never trip a NOT NULL constraint.
alter table public.training_progress
  alter column successes_accumulated set default 0;

alter table public.training_progress
  alter column successes_required set default 0;

-- ---- schedule_blocks: remember which session a block represents ----
alter table public.schedule_blocks
  add column if not exists session_number integer;

-- ---- row level security on the new tables ----
alter table public.training_sessions enable row level security;
alter table public.training_hidden_bonuses enable row level security;

drop policy if exists ts_read on public.training_sessions;
create policy ts_read on public.training_sessions
  for select to authenticated using (true);

drop policy if exists ts_write on public.training_sessions;
create policy ts_write on public.training_sessions
  for all to authenticated
  using (exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'dm'))
  with check (exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'dm'));

drop policy if exists thb_read on public.training_hidden_bonuses;
create policy thb_read on public.training_hidden_bonuses
  for select to authenticated using (true);

drop policy if exists thb_write on public.training_hidden_bonuses;
create policy thb_write on public.training_hidden_bonuses
  for all to authenticated
  using (exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'dm'))
  with check (exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'dm'));
