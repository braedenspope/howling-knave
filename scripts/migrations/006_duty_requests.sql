-- Feature #2b: duty hand-off requests (request → accept/deny handshake).
-- A player asks a crewmate to take a ship duty; the target accepts or denies.

create table if not exists public.duty_requests (
  id uuid primary key default gen_random_uuid(),
  block_id uuid not null references public.schedule_blocks(id) on delete cascade,
  day_id uuid not null references public.days(id) on delete cascade,
  from_user uuid not null references public.users(id) on delete cascade,
  to_user uuid not null references public.users(id) on delete cascade,
  status text not null default 'pending', -- pending | accepted | denied | cancelled
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

alter table public.duty_requests enable row level security;

-- both parties can see the request
drop policy if exists dr_read on public.duty_requests;
create policy dr_read on public.duty_requests
  for select to authenticated
  using (from_user = auth.uid() or to_user = auth.uid());

-- the requester creates it
drop policy if exists dr_insert on public.duty_requests;
create policy dr_insert on public.duty_requests
  for insert to authenticated
  with check (from_user = auth.uid());

-- either party may update it (target accepts/denies, requester cancels)
drop policy if exists dr_update on public.duty_requests;
create policy dr_update on public.duty_requests
  for update to authenticated
  using (from_user = auth.uid() or to_user = auth.uid())
  with check (from_user = auth.uid() or to_user = auth.uid());

-- either party may clear a resolved request
drop policy if exists dr_delete on public.duty_requests;
create policy dr_delete on public.duty_requests
  for delete to authenticated
  using (from_user = auth.uid() or to_user = auth.uid());

-- make sure realtime broadcasts changes on this table
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'duty_requests'
  ) then
    alter publication supabase_realtime add table public.duty_requests;
  end if;
end $$;
