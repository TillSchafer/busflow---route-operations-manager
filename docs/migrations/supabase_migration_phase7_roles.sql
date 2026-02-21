-- Phase 7: Role management alignment for Admin + BusFlow permissions

-- 1) Allow global admins to update profiles (besides self-update policy)
drop policy if exists "Admins can update profiles." on public.profiles;
create policy "Admins can update profiles."
  on public.profiles
  for update
  using ((select global_role from public.profiles where id = auth.uid()) = 'ADMIN')
  with check ((select global_role from public.profiles where id = auth.uid()) = 'ADMIN');

-- 2) Allow global admins to manage app permissions
drop policy if exists "Admins can insert permissions." on public.app_permissions;
create policy "Admins can insert permissions."
  on public.app_permissions
  for insert
  with check ((select global_role from public.profiles where id = auth.uid()) = 'ADMIN');

drop policy if exists "Admins can update permissions." on public.app_permissions;
create policy "Admins can update permissions."
  on public.app_permissions
  for update
  using ((select global_role from public.profiles where id = auth.uid()) = 'ADMIN')
  with check ((select global_role from public.profiles where id = auth.uid()) = 'ADMIN');

drop policy if exists "Admins can delete permissions." on public.app_permissions;
create policy "Admins can delete permissions."
  on public.app_permissions
  for delete
  using ((select global_role from public.profiles where id = auth.uid()) = 'ADMIN');

-- 3) Backfill BusFlow permissions for existing users
insert into public.app_permissions (user_id, app_id, role)
select p.id, 'busflow', 'DISPATCH'
from public.profiles p
where not exists (
  select 1
  from public.app_permissions ap
  where ap.user_id = p.id
    and ap.app_id = 'busflow'
);

-- 4) Ensure signup trigger always creates a default BusFlow permission
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url, global_role)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url',
    'USER'
  );

  insert into public.app_permissions (user_id, app_id, role)
  values (new.id, 'busflow', 'DISPATCH')
  on conflict (user_id, app_id) do nothing;

  return new;
end;
$$ language plpgsql security definer;
