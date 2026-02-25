-- Create Workers/Drivers table
create table if not exists public.busflow_workers (
    id uuid default uuid_generate_v4() primary key,
    name text not null,
    role text, -- 'Driver', 'Mechanic', etc.
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS
alter table public.busflow_workers enable row level security;

drop policy if exists "Authenticated users can view workers" on busflow_workers;
drop policy if exists "Workers read by account access" on busflow_workers;
drop policy if exists "Workers insert by account manager" on busflow_workers;
drop policy if exists "Workers update by account manager" on busflow_workers;
drop policy if exists "Workers delete by account manager" on busflow_workers;
drop policy if exists "Dispatch+ can manage workers" on busflow_workers;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'busflow_workers'
      and column_name = 'account_id'
  ) and exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'has_account_access'
  ) and exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'can_manage_account'
  ) then
    create policy "Workers read by account access"
      on public.busflow_workers
      for select
      using (public.has_account_access(account_id));

    create policy "Workers insert by account manager"
      on public.busflow_workers
      for insert
      with check (public.can_manage_account(account_id));

    create policy "Workers update by account manager"
      on public.busflow_workers
      for update
      using (public.can_manage_account(account_id))
      with check (public.can_manage_account(account_id));

    create policy "Workers delete by account manager"
      on public.busflow_workers
      for delete
      using (public.can_manage_account(account_id));
  else
    create policy "Authenticated users can view workers"
      on public.busflow_workers
      for select
      using (auth.role() = 'authenticated');
  end if;
end
$$;
