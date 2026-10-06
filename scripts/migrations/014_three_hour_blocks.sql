-- Three-hour blocks.
--
-- Players can now book a training (or independent activity) for 1, 2, 3 or 4
-- hours: Short / Medium / Extended / Long. The new 3-hour length is stored as
-- slot_weight = 'extended'.
--
-- The original schedule_blocks schema isn't in these migrations, so this
-- handles either way slot_weight might be constrained: a Postgres enum type
-- gets the new value added; a CHECK constraint is dropped and recreated to
-- allow it.
--
-- Run in the Supabase SQL editor.

do $$
declare
  col_type text;
  enum_name text;
  con record;
begin
  select c.data_type, c.udt_name into col_type, enum_name
  from information_schema.columns c
  where c.table_schema = 'public' and c.table_name = 'schedule_blocks' and c.column_name = 'slot_weight';

  if col_type = 'USER-DEFINED' then
    execute format('alter type public.%I add value if not exists %L', enum_name, 'extended');
  else
    for con in
      select conname
      from pg_constraint
      where conrelid = 'public.schedule_blocks'::regclass
        and contype = 'c'
        and pg_get_constraintdef(oid) ilike '%slot_weight%'
    loop
      execute format('alter table public.schedule_blocks drop constraint %I', con.conname);
    end loop;

    alter table public.schedule_blocks
      add constraint schedule_blocks_slot_weight_check
      check (slot_weight in ('light', 'medium', 'extended', 'heavy'));
  end if;
end $$;
