-- Roll checks per training.
--
-- The DM sets which check each hour of a block calls for — Roll 1, Roll 2 …
-- up to the four hours of a Long block — with an optional DC. Play mode shows
-- the check for the roll it is sitting on in place of "Call a roll that fits
-- the hour".
--
-- Stored as a jsonb array indexed by roll (0-based, matching
-- block_rolls.roll_index):
--   [{ "check": "Athletics", "dc": 12 }, { "check": "Sleight of Hand", "dc": null }, …]
-- An empty check leaves that hour to the DM's call at the table.
--
-- Run in the Supabase SQL editor.

alter table public.trainings
  add column if not exists roll_checks jsonb not null default '[]'::jsonb;

alter table public.trainings
  drop constraint if exists trainings_roll_checks_array;
alter table public.trainings
  add constraint trainings_roll_checks_array check (jsonb_typeof(roll_checks) = 'array');
