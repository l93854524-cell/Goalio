create table public.goalio_states (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state_version integer not null check (state_version > 0),
  state jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.goalio_states enable row level security;
revoke all on table public.goalio_states from anon, authenticated;
grant select, insert, update on table public.goalio_states to authenticated;

create policy "users_select_own_goalio_state"
on public.goalio_states for select to authenticated
using ((select auth.uid()) = user_id);

create policy "users_insert_own_goalio_state"
on public.goalio_states for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy "users_update_own_goalio_state"
on public.goalio_states for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create function public.set_goalio_state_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = pg_catalog.now();
  return new;
end;
$$;

create trigger set_goalio_state_updated_at
before update on public.goalio_states
for each row execute function public.set_goalio_state_updated_at();
