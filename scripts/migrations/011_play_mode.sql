-- Play mode — the block-by-block montage runner.
--
-- The DM walks the voyage one hour at a time: hour 1 for every player in a
-- fixed turn order, then hour 2, and so on through every day. A training that
-- spans N hours is rolled N times, one roll per hour.
--
-- Scoring (supersedes the PP-by-length rule in 007 and the short-fail mercy
-- rule in 009):
--   * each successful roll is worth 1 point toward the training's threshold_pp
--   * if every roll for a training on a given day fails, that day is still
--     worth 1 point "for trying"
--
-- Progress is always recomputed from block_rolls, which is the single source of
-- truth — that keeps undo and mid-session corrections exact.
--
-- Run this in the Supabase SQL editor.

-- ---- one row per rolled hour ----
create table if not exists public.block_rolls (
  id uuid primary key default gen_random_uuid(),
  block_id uuid not null references public.schedule_blocks(id) on delete cascade,
  -- 0-based offset within the block's span: hour - slot_position
  roll_index integer not null,
  outcome text not null check (outcome in ('success', 'failure')),
  created_at timestamptz not null default now(),
  unique (block_id, roll_index)
);

create index if not exists block_rolls_block_id_idx
  on public.block_rolls (block_id);

-- ---- the shared runner cursor, one row per voyage ----
create table if not exists public.voyage_play_state (
  voyage_id uuid primary key references public.voyages(id) on delete cascade,
  active boolean not null default false,
  -- player ids in the order they take their turn each hour
  turn_order uuid[] not null default '{}',
  -- index into the computed stop queue; equals the queue length when finished
  cursor integer not null default 0,
  updated_at timestamptz not null default now()
);

-- ---- row level security ----
alter table public.block_rolls enable row level security;
alter table public.voyage_play_state enable row level security;

-- Everyone watches the run live; only the DM records outcomes.
drop policy if exists br_read on public.block_rolls;
create policy br_read on public.block_rolls
  for select to authenticated using (true);

drop policy if exists br_write on public.block_rolls;
create policy br_write on public.block_rolls
  for all to authenticated
  using (exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'dm'))
  with check (exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'dm'));

drop policy if exists vps_read on public.voyage_play_state;
create policy vps_read on public.voyage_play_state
  for select to authenticated using (true);

drop policy if exists vps_write on public.voyage_play_state;
create policy vps_write on public.voyage_play_state
  for all to authenticated
  using (exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'dm'))
  with check (exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'dm'));

-- ---- realtime so players' screens follow the DM's cursor ----
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'block_rolls'
  ) then
    alter publication supabase_realtime add table public.block_rolls;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'voyage_play_state'
  ) then
    alter publication supabase_realtime add table public.voyage_play_state;
  end if;
end $$;
