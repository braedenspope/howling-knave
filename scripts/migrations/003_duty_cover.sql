-- Feature #2: duty hand-off / take-on.
-- A duty can move to another player's row; covered_by remembers the original owner.

alter table public.schedule_blocks
  add column if not exists covered_by uuid references public.users(id);

-- Any authenticated crew member may reassign a SHIP DUTY (mandatory block) to a
-- different player's row — hand it off, take it on, or (DM) reposition it.
-- Scoped to mandatory blocks only, so this never touches training blocks.
drop policy if exists sb_cover on public.schedule_blocks;
create policy sb_cover on public.schedule_blocks
  for update to authenticated
  using (is_mandatory)
  with check (is_mandatory);
