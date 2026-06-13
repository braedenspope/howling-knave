-- Feature #4: spotlight flag + DM rotation ledger.
-- Players flag a training session for the table; history powers a fairness rotation.

alter table public.schedule_blocks
  add column if not exists spotlight boolean not null default false;

create table if not exists public.spotlight_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  voyage_id uuid not null references public.voyages(id) on delete cascade,
  block_id uuid references public.schedule_blocks(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.spotlight_log enable row level security;

drop policy if exists sl_read on public.spotlight_log;
create policy sl_read on public.spotlight_log
  for select to authenticated using (true);

drop policy if exists sl_write on public.spotlight_log;
create policy sl_write on public.spotlight_log
  for all to authenticated
  using (exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'dm'))
  with check (exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'dm'));

-- Allow the owner to toggle the spotlight flag on their own non-mandatory block.
-- Adjust to compose with your existing schedule_blocks update policy as needed.
drop policy if exists sb_spotlight on public.schedule_blocks;
create policy sb_spotlight on public.schedule_blocks
  for update to authenticated
  using (user_id = auth.uid() and not is_mandatory)
  with check (user_id = auth.uid() and not is_mandatory);
