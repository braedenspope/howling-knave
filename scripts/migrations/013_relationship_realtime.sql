-- Live relationship tiers.
--
-- The DM adjusts each player's standing with the crew from Guner's Ledger on
-- the board; adding relationship_tiers to the realtime publication lets every
-- player's Crew page and training picker unlock (or lock) trainings the moment
-- the DM changes a tier.
--
-- Run in the Supabase SQL editor.

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'relationship_tiers'
  ) then
    alter publication supabase_realtime add table public.relationship_tiers;
  end if;
end $$;
