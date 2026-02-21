-- Phase 13: Global default map view settings for new route editor

create table if not exists public.busflow_app_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.busflow_app_settings enable row level security;

-- Ensure updated_at trigger function exists.
do $$
begin
  if not exists (
    select 1
    from pg_proc
    where proname = 'set_updated_at'
      and pg_function_is_visible(oid)
  ) then
    execute $fn$
      create function public.set_updated_at()
      returns trigger as $inner$
      begin
        new.updated_at = timezone('utc'::text, now());
        return new;
      end;
      $inner$ language plpgsql
    $fn$;
  end if;
end
$$;

-- Reuse shared updated_at trigger function.
drop trigger if exists set_busflow_app_settings_updated_at on public.busflow_app_settings;
create trigger set_busflow_app_settings_updated_at
before update on public.busflow_app_settings
for each row execute function public.set_updated_at();

drop policy if exists "Authenticated users can view app settings" on public.busflow_app_settings;
create policy "Authenticated users can view app settings"
  on public.busflow_app_settings
  for select
  using (auth.role() = 'authenticated');

drop policy if exists "Dispatch+ can manage app settings" on public.busflow_app_settings;
create policy "Dispatch+ can manage app settings"
  on public.busflow_app_settings
  for all
  using (
    (select global_role from public.profiles where id = auth.uid()) = 'ADMIN'
    or exists (
      select 1
      from public.app_permissions
      where user_id = auth.uid()
        and app_id = 'busflow'
        and role in ('ADMIN', 'DISPATCH')
    )
  );

insert into public.busflow_app_settings (key, value)
values (
  'map_default',
  jsonb_build_object('address', 'Deutschland', 'lat', 51.1657, 'lon', 10.4515, 'zoom', 6)
)
on conflict (key) do nothing;
