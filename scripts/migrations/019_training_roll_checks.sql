-- Roll checks per training.
--
-- The DM sets a check, with an optional DC, for every training point — 12 for
-- a tier 1 training, 24 for tier 2, and so on. Play mode shows the check for
-- the point the player's roll is going for (points banked so far + 1) in place
-- of "Call a roll that fits the hour".
--
-- Stored as a jsonb array indexed by point (0-based):
--   [{ "check": "Athletics", "dc": 12 }, { "check": "Sleight of Hand", "dc": null }, …]
-- An empty check leaves that point to the DM's call at the table.
--
-- Run in the Supabase SQL editor.

alter table public.trainings
  add column if not exists roll_checks jsonb not null default '[]'::jsonb;

alter table public.trainings
  drop constraint if exists trainings_roll_checks_array;
alter table public.trainings
  add constraint trainings_roll_checks_array check (jsonb_typeof(roll_checks) = 'array');
