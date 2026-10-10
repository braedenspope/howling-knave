-- The Chronometer — the campaign's in-game date on the Calendar of Argous.
--
-- Storage is in whole days only, as `abs_day`: 0 is 1 Primis, Year 0 A.S. The
-- calendar's structure (months, weekdays, festivals) is canon and lives in the
-- app's pure engine (src/app/features/chronometer/engine) — never in here.
--
-- This app runs one campaign and keeps the DM/player split on users.role, so
-- the clock is a single row and nothing carries a campaign_id.
--
--   * campaign_clock      — the current day. Everyone reads; only the DM writes.
--   * calendar_events     — dated events, DM-only or player-visible. Players
--                           can read only visibility = 'player', enforced here.
--   * calendar_day_notes  — the DM's private per-day notes. DM only, both ways.
--
-- Run in the Supabase SQL editor.

-- ---- the clock: exactly one row ----
create table if not exists public.campaign_clock (
  id boolean primary key default true check (id),
  current_abs_day integer not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  abs_day integer not null,
  title text not null,
  body text,
  visibility text not null check (visibility in ('dm', 'player')),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists calendar_events_abs_day_idx
  on public.calendar_events (abs_day);

create table if not exists public.calendar_day_notes (
  abs_day integer primary key,
  body text not null,
  updated_at timestamptz not null default now()
);

-- ---- row level security ----
alter table public.campaign_clock enable row level security;
alter table public.calendar_events enable row level security;
alter table public.calendar_day_notes enable row level security;

drop policy if exists clock_read on public.campaign_clock;
create policy clock_read on public.campaign_clock
  for select to authenticated using (true);

drop policy if exists clock_write on public.campaign_clock;
create policy clock_write on public.campaign_clock
  for all to authenticated
  using (exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'dm'))
  with check (exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'dm'));

-- DM sees every event; everyone else sees only the player-visible ones.
drop policy if exists events_read_dm on public.calendar_events;
create policy events_read_dm on public.calendar_events
  for select to authenticated
  using (exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'dm'));

drop policy if exists events_read_player on public.calendar_events;
create policy events_read_player on public.calendar_events
  for select to authenticated using (visibility = 'player');

drop policy if exists events_write on public.calendar_events;
create policy events_write on public.calendar_events
  for all to authenticated
  using (exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'dm'))
  with check (exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'dm'));

drop policy if exists notes_all on public.calendar_day_notes;
create policy notes_all on public.calendar_day_notes
  for all to authenticated
  using (exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'dm'))
  with check (exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'dm'));

-- ---- realtime so every screen follows the DM's clock ----
-- Realtime applies the select policies above, so players are never sent a
-- DM-only event. Day notes are deliberately left out of the publication.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'campaign_clock'
  ) then
    alter publication supabase_realtime add table public.campaign_clock;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'calendar_events'
  ) then
    alter publication supabase_realtime add table public.calendar_events;
  end if;
end $$;

-- ---- seed: campaign start ----
-- 455550 = Seaday, 12 Tersel, 1,247 A.S. (the engine's spec pins these values).
insert into public.campaign_clock (id, current_abs_day)
values (true, 455550)
on conflict (id) do nothing;

-- The DM may delete these; the guard keeps a re-run from duplicating them.
insert into public.calendar_events (abs_day, title, visibility)
select v.abs_day, v.title, 'dm'
from (values
  (455552, 'The Keeper charters the Howling Knave — evening.'),  -- 14 Tersel 1,247
  (455553, 'Basin Commission sits — Charter Day.')                -- 15 Tersel 1,247
) as v (abs_day, title)
where not exists (select 1 from public.calendar_events e where e.title = v.title);
