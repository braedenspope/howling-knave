-- Crew management — the DM adds, edits and removes crew in the app.
--
-- Until now the roster's colors, one-line reads and order lived in the app's
-- static data. This moves them onto crew_members so the database is the one
-- source of truth, and adds:
--
--   * color / line / sort_order on crew_members (seeded from the old roster),
--   * a rename cascade — schedule_blocks, relationship_tiers, training_progress
--     and days.mandatory_duty all store the crewmate's *name*, so renaming one
--     rewrites those rows in the same transaction,
--   * remove_crew_member(id) — the DM-only removal that also clears the
--     crewmate's trainings, standings, progress and unrolled blocks,
--   * crew_unavailability — the DM blocks a crewmate from teaching on a given
--     voyage day. It never touches relationship_tiers; it only refuses new
--     training blocks with that crewmate on that day.
--
-- Run in the Supabase SQL editor.

-- ---- crew_members: the fields the static roster used to carry ----
alter table public.crew_members
  add column if not exists color text not null default '#6a6a5a',
  add column if not exists line text not null default '',
  add column if not exists sort_order integer not null default 0;

alter table public.crew_members
  drop constraint if exists crew_members_color_hex;
alter table public.crew_members
  add constraint crew_members_color_hex check (color ~ '^#[0-9a-fA-F]{6}$');

create unique index if not exists crew_members_name_key on public.crew_members (name);

update public.crew_members c
set color = v.color, line = v.line, sort_order = v.sort_order
from (values
  ($hk$Anna Rose$hk$,      '#a63d2f', 1,  $hk$Runs the ship like a held breath — nothing happens she hasn't already noticed.$hk$),
  ($hk$Guner Aldric$hk$,   '#2a4a6b', 2,  $hk$There is a procedure. Then there's Anna. Two years in, he's stopped being sure which one he trusts.$hk$),
  ($hk$Rachel Rose$hk$,    '#5a8a4a', 3,  $hk$Stops the bleeding first. Everything else is conversation.$hk$),
  ($hk$Lehiri Stars$hk$,   '#6b3a8b', 4,  $hk$Plots the safest course and the fastest one. Never says which she's giving you.$hk$),
  ($hk$Toji Brassboot$hk$, '#b87333', 5,  $hk$Argues with the engine. Usually wins.$hk$),
  ($hk$Porter Tomas$hk$,   '#6a6a5a', 6,  $hk$Knows what everything weighs and what it’s worth in three ports.$hk$),
  ($hk$Shanoa Buckler$hk$, '#3a7a6a', 7,  $hk$New aboard, sharp on the glass. Watches the Empire's flag like it might still recognize her.$hk$),
  ($hk$Ardor$hk$,          '#2a6a5a', 8,  $hk$Charming, useful, paid in full — and nobody's quite sure why he's still aboard.$hk$),
  ($hk$Bryce Morrison$hk$, '#c49a3c', 9,  $hk$Means well. Arrives late. Stays anyway.$hk$),
  ($hk$Elro Boldfall$hk$,  '#7a4a2a', 10, $hk$Feeds the wound before it's named. Forgets to feed himself.$hk$),
  ($hk$Delvin Moss$hk$,    '#8a6a3a', 11, $hk$Always has what the ship needs. Always pours one more than he should.$hk$)
) as v(name, color, sort_order, line)
where c.name = v.name
  and c.line = '';  -- only the first run; never overwrite the DM's edits

-- ---- row level security: everyone reads, the DM writes ----
alter table public.crew_members enable row level security;

drop policy if exists crew_read on public.crew_members;
create policy crew_read on public.crew_members
  for select to authenticated using (true);

drop policy if exists crew_dm_write on public.crew_members;
create policy crew_dm_write on public.crew_members
  for all to authenticated
  using (exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'dm'))
  with check (exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'dm'));

-- ---- rename cascade ----
-- Security definer so the rewrite reaches every player's rows regardless of
-- the policies on those tables; only the DM can update crew_members anyway.
create or replace function public.crew_member_renamed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.name is distinct from old.name then
    update public.schedule_blocks set crew_member = new.name where crew_member = old.name;
    update public.relationship_tiers set crew_member = new.name where crew_member = old.name;
    update public.training_progress set crew_member = new.name where crew_member = old.name;
    update public.days
      set mandatory_duty = jsonb_set(mandatory_duty::jsonb, '{crew_member}', to_jsonb(new.name))
      where mandatory_duty is not null and mandatory_duty::jsonb ->> 'crew_member' = old.name;
  end if;
  return new;
end $$;

drop trigger if exists crew_member_renamed on public.crew_members;
create trigger crew_member_renamed
  after update of name on public.crew_members
  for each row execute function public.crew_member_renamed();

-- ---- day blocks: a crewmate who won't teach on a given voyage day ----
create table if not exists public.crew_unavailability (
  crew_member_id integer not null references public.crew_members(id) on delete cascade,
  day_id uuid not null references public.days(id) on delete cascade,
  reason text,
  created_at timestamptz not null default now(),
  primary key (crew_member_id, day_id)
);

create index if not exists crew_unavailability_day_idx
  on public.crew_unavailability (day_id);

alter table public.crew_unavailability enable row level security;

drop policy if exists cu_read on public.crew_unavailability;
create policy cu_read on public.crew_unavailability
  for select to authenticated using (true);

drop policy if exists cu_dm_write on public.crew_unavailability;
create policy cu_dm_write on public.crew_unavailability
  for all to authenticated
  using (exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'dm'))
  with check (exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'dm'));

-- Refuse a new training with a blocked crewmate. Only a block that is being
-- created, or moved onto that crewmate/day, is checked — blocks already on the
-- board when the DM blocked the day can still be re-sized, rolled or removed.
create or replace function public.schedule_block_crew_available()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.is_mandatory then
    return new;
  end if;
  if tg_op = 'UPDATE'
     and new.crew_member is not distinct from old.crew_member
     and new.day_id is not distinct from old.day_id then
    return new;
  end if;
  if exists (
    select 1
    from public.crew_unavailability u
    join public.crew_members c on c.id = u.crew_member_id
    where u.day_id = new.day_id and c.name = new.crew_member
  ) then
    raise exception '% isn''t available to train on this day', new.crew_member;
  end if;
  return new;
end $$;

drop trigger if exists schedule_block_crew_available on public.schedule_blocks;
create trigger schedule_block_crew_available
  before insert or update of crew_member, day_id on public.schedule_blocks
  for each row execute function public.schedule_block_crew_available();

-- ---- removal ----
-- Rolled blocks stay on the board as history (they draw in a neutral color);
-- unrolled ones are dropped so play mode never reaches a training that's gone.
create or replace function public.remove_crew_member(p_id integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
begin
  if not exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'dm') then
    raise exception 'Only the DM can remove crew';
  end if;

  select name into v_name from public.crew_members where id = p_id;
  if v_name is null then
    return;
  end if;

  delete from public.schedule_blocks b
    where b.crew_member = v_name
      and not b.is_mandatory
      and b.status = 'pending'
      and not exists (select 1 from public.block_rolls r where r.block_id = b.id);
  delete from public.training_progress where crew_member = v_name;
  delete from public.relationship_tiers where crew_member = v_name;
  delete from public.trainings where crew_member_id = p_id;  -- hidden bonuses cascade
  delete from public.crew_members where id = p_id;            -- day blocks cascade
end $$;

revoke all on function public.remove_crew_member(integer) from public;
grant execute on function public.remove_crew_member(integer) to authenticated;

-- ---- realtime so roster edits and day blocks land on every screen ----
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'crew_members'
  ) then
    alter publication supabase_realtime add table public.crew_members;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'crew_unavailability'
  ) then
    alter publication supabase_realtime add table public.crew_unavailability;
  end if;
end $$;
