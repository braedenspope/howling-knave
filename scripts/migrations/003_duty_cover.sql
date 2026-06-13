-- Feature #2: duty covering.
-- A player may take responsibility for another player's ship-duty slot.

alter table public.schedule_blocks
  add column if not exists covered_by uuid references public.users(id);

-- Allow a player to set covered_by = themselves on any mandatory block,
-- or clear it when they are the current coverer.
-- (Assumes the existing schedule_blocks update policy already lets owners
--  edit their own rows; this adds the cover path for mandatory blocks.)
drop policy if exists sb_cover on public.schedule_blocks;
create policy sb_cover on public.schedule_blocks
  for update to authenticated
  using (is_mandatory)
  with check (covered_by is null or covered_by = auth.uid());
