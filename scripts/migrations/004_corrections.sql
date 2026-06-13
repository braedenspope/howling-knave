-- Feature #3: Guner's correction detail.
-- The DM locks one player's training for a single day (duties + independent only).

create table if not exists public.corrections (
  id uuid primary key default gen_random_uuid(),
  day_id uuid not null references public.days(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  reason text,
  created_at timestamptz not null default now(),
  unique (day_id, user_id)
);

alter table public.corrections enable row level security;

drop policy if exists corr_read on public.corrections;
create policy corr_read on public.corrections
  for select to authenticated using (true);

drop policy if exists corr_write on public.corrections;
create policy corr_write on public.corrections
  for all to authenticated
  using (exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'dm'))
  with check (exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'dm'));
