-- Adds the DM-facing "scene seed" prompt to trainings.
-- The app degrades gracefully without this column (scene seeds simply
-- won't persist), but run this in the Supabase SQL editor to enable them.

alter table public.trainings
  add column if not exists scene_seed text;
