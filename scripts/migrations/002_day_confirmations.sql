-- Feature #1: wax-seal confirmations / schedule lock.
-- Each player "seals" a day; when every player has sealed, the day locks.

create table if not exists public.day_confirmations (
  id uuid primary key default gen_random_uuid(),
  day_id uuid not null references public.days(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  sealed_at timestamptz not null default now(),
  unique (day_id, user_id)
);

alter table public.days add column if not exists locked boolean not null default false;

alter table public.day_confirmations enable row level security;

-- anyone authenticated may read confirmations
drop policy if exists dc_read on public.day_confirmations;
create policy dc_read on public.day_confirmations
  for select to authenticated using (true);

-- a player may seal / withdraw only their own confirmation
drop policy if exists dc_write on public.day_confirmations;
create policy dc_write on public.day_confirmations
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- recompute a day's lock from confirmation count vs player count
create or replace function public.recompute_day_lock(p_day uuid)
returns void language sql security definer as $$
  update public.days d
     set locked = (
       (select count(*) from public.day_confirmations c where c.day_id = p_day)
       >= (select count(*) from public.users where role = 'player')
     )
   where d.id = p_day;
$$;

create or replace function public.tg_recompute_day_lock()
returns trigger language plpgsql security definer as $$
begin
  perform public.recompute_day_lock(coalesce(new.day_id, old.day_id));
  return null;
end;
$$;

drop trigger if exists trg_day_lock on public.day_confirmations;
create trigger trg_day_lock
  after insert or delete on public.day_confirmations
  for each row execute function public.tg_recompute_day_lock();
