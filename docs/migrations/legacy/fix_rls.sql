-- DEPRECATED - DO NOT RUN IN PRODUCTION
-- Reason:
-- - This script contains bootstrap statements that can elevate all users to ADMIN.
-- - It predates phased migrations and may conflict with current RLS/role model.
-- Replacement:
-- - Use `supabase_migration_phase7_roles.sql` for role policies/backfill
-- - Use `supabase_migration_phase10_customer_fk.sql` for customer FK routing
-- - Use `supabase_migration_phase12_backend_cleanup.sql` for canonical trigger/RPC cleanup

-- 1. FIX POLICIES: Allow Global Admins to do everything in BusFlow
-- We interpret "Dispatch+" as "Has App Permission OR is Global Admin"

drop policy if exists "Dispatch+ can manage bus types" on busflow_bus_types;
create policy "Dispatch+ can manage bus types" on busflow_bus_types for all using (
    (select global_role from profiles where id = auth.uid()) = 'ADMIN'
    or
    exists (select 1 from app_permissions where user_id = auth.uid() and app_id = 'busflow' and role in ('ADMIN', 'DISPATCH'))
);

drop policy if exists "Dispatch+ can view all routes" on busflow_routes;
create policy "Dispatch+ can view all routes" on busflow_routes for select using (
    (select global_role from profiles where id = auth.uid()) = 'ADMIN'
    or
    exists (select 1 from app_permissions where user_id = auth.uid() and app_id = 'busflow' and role in ('ADMIN', 'DISPATCH'))
);

drop policy if exists "Dispatch+ can manage routes" on busflow_routes;
create policy "Dispatch+ can manage routes" on busflow_routes for all using (
    (select global_role from profiles where id = auth.uid()) = 'ADMIN'
    or
    exists (select 1 from app_permissions where user_id = auth.uid() and app_id = 'busflow' and role in ('ADMIN', 'DISPATCH'))
);

drop policy if exists "Dispatch+ can manage stops" on busflow_stops;
create policy "Dispatch+ can manage stops" on busflow_stops for all using (
    (select global_role from profiles where id = auth.uid()) = 'ADMIN'
    or
    exists (select 1 from app_permissions where user_id = auth.uid() and app_id = 'busflow' and role in ('ADMIN', 'DISPATCH'))
);

-- Fix Workers Policy (if not already correct)
drop policy if exists "Dispatch+ can manage workers" on busflow_workers;
create policy "Dispatch+ can manage workers" on busflow_workers for all using (
    (select global_role from profiles where id = auth.uid()) = 'ADMIN'
    or
    exists (select 1 from app_permissions where user_id = auth.uid() and app_id = 'busflow' and role in ('ADMIN', 'DISPATCH'))
);


-- 2. FIX TRIGGER: Auto-assign 'DISPATCH' permission to new users for BusFlow
-- This ensures new signups can actually use the app immediately.
create or replace function public.handle_new_user() 
returns trigger as $$
begin
  -- Create Profile
  insert into public.profiles (id, email, full_name, avatar_url, global_role)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url', 'USER');
  
  -- Create Default App Permission (BusFlow -> DISPATCH)
  insert into public.app_permissions (user_id, app_id, role)
  values (new.id, 'busflow', 'DISPATCH');
  
  return new;
end;
$$ language plpgsql security definer;


-- 3. BOOTSTRAP: Fix your current user(s)
-- This makes ALL existing users Admins with full permissions (Changes 'USER' to 'ADMIN' and inserts permissions if missing)
update profiles set global_role = 'ADMIN' where global_role = 'USER';

insert into app_permissions (user_id, app_id, role)
select id, 'busflow', 'ADMIN' from profiles
on conflict (user_id, app_id) do update set role = 'ADMIN';
