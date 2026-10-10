-- Let the DM set crew standing.
--
-- The original relationship_tiers schema isn't in these migrations, so this
-- makes sure, whatever it was, that:
--   * tier accepts 0 (Wary — refuses to train) through 5 (Bound),
--   * every signed-in player can read standings (the Crew page and training
--     picker gate on them), and
--   * the DM can insert and update any player's row — the board's ledger and
--     the DM dashboard's tracker both write here.
--
-- Run in the Supabase SQL editor.

-- ---- tier range: replace any CHECK on tier with 0..5 ----
do $$
declare
  con record;
begin
  for con in
    select c.conname
    from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
    where c.conrelid = 'public.relationship_tiers'::regclass
      and c.contype = 'c'
      and a.attname = 'tier'
  loop
    execute format('alter table public.relationship_tiers drop constraint %I', con.conname);
  end loop;
end $$;

alter table public.relationship_tiers
  add constraint relationship_tiers_tier_range check (tier between 0 and 5);

-- ---- row level security ----
alter table public.relationship_tiers enable row level security;

drop policy if exists rt_read on public.relationship_tiers;
create policy rt_read on public.relationship_tiers
  for select to authenticated using (true);

drop policy if exists rt_dm_write on public.relationship_tiers;
create policy rt_dm_write on public.relationship_tiers
  for all to authenticated
  using (exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'dm'))
  with check (exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'dm'));
