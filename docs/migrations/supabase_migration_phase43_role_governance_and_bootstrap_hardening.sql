-- Phase 43: Role governance hardening + lifecycle consistency + bootstrap preflight
--
-- Goals:
-- 1) Keep role semantics explicit and documented.
-- 2) Deprecate app_permissions as an authority source (legacy read-only).
-- 3) Keep invite lifecycle clean with EXPIRED status maintenance.
-- 4) Keep migration chain strict with preflight assertions for critical objects.

-- A) Role semantics comments (documentation in schema).
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'global_role'
  ) then
    execute format(
      'comment on column public.profiles.global_role is %L',
      'Platform-level role. ADMIN grants cross-tenant platform privileges; USER is default.'
    );
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'account_memberships' and column_name = 'role'
  ) then
    execute format(
      'comment on column public.account_memberships.role is %L',
      'Tenant-level role (source of truth for app permissions inside one account): ADMIN|DISPATCH|VIEWER.'
    );
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'account_invitations' and column_name = 'role'
  ) then
    execute format(
      'comment on column public.account_invitations.role is %L',
      'Pending tenant role applied to account_memberships on invitation claim.'
    );
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'busflow_workers' and column_name = 'role'
  ) then
    execute format(
      'comment on column public.busflow_workers.role is %L',
      'Operational worker job role (domain data, not auth role), e.g. Driver/Mechanic.'
    );
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'app_permissions' and column_name = 'role'
  ) then
    execute format(
      'comment on column public.app_permissions.role is %L',
      'Legacy app-level role (deprecated). Runtime authorization must use account_memberships + profiles.global_role.'
    );
  end if;
end
$$;

-- B) Canonical invite onboarding trigger: no new writes to app_permissions.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invitation record;
begin
  select i.*
    into v_invitation
  from public.account_invitations i
  where lower(i.email) = lower(new.email)
    and i.status = 'PENDING'
    and i.expires_at > timezone('utc'::text, now())
  order by i.created_at asc
  limit 1
  for update;

  if not found then
    raise exception 'INVITE_REQUIRED' using errcode = '42501';
  end if;

  insert into public.profiles (id, email, full_name, avatar_url, global_role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url',
    'USER'
  )
  on conflict (id) do update
  set email = excluded.email;

  -- Membership remains INVITED until explicit claim_my_invitation().
  insert into public.account_memberships (account_id, user_id, role, status)
  values (v_invitation.account_id, new.id, v_invitation.role, 'INVITED')
  on conflict (account_id, user_id) do update
  set role = excluded.role,
      status = case
        when public.account_memberships.status = 'ACTIVE' then 'ACTIVE'
        else 'INVITED'
      end;

  return new;
end;
$$;

-- C) app_permissions legacy mode: keep readable, block client writes.
-- Drop all write policies deterministically.
do $$
declare
  v_policy text;
begin
  for v_policy in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'app_permissions'
      and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
  loop
    execute format('drop policy if exists %I on public.app_permissions', v_policy);
  end loop;
end
$$;

-- Keep/normalize read policy only.
drop policy if exists "App permissions: self or platform admin read" on public.app_permissions;
create policy "App permissions: self or platform admin read"
  on public.app_permissions
  for select
  using (user_id = auth.uid() or public.is_platform_admin());

-- D) Invite lifecycle maintenance helper.
create or replace function public.mark_expired_invitations(p_account_id uuid default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '42501';
  end if;

  if p_account_id is null then
    if not public.is_platform_admin() then
      raise exception 'FORBIDDEN' using errcode = '42501';
    end if;
  else
    if not (public.is_platform_admin() or public.can_manage_account(p_account_id)) then
      raise exception 'FORBIDDEN' using errcode = '42501';
    end if;
  end if;

  update public.account_invitations i
  set status = 'EXPIRED'
  where i.status = 'PENDING'
    and i.expires_at <= timezone('utc'::text, now())
    and (p_account_id is null or i.account_id = p_account_id);

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.mark_expired_invitations(uuid) from public;
grant execute on function public.mark_expired_invitations(uuid) to authenticated;

-- E) Strict preflight assertions for critical architecture objects.
do $$
declare
  v_table text;
  v_missing text[] := '{}';
  v_func text;
  v_func_missing text[] := '{}';
begin
  foreach v_table in array array[
    'profiles',
    'app_permissions',
    'platform_accounts',
    'account_memberships',
    'account_invitations',
    'admin_access_audit',
    'busflow_routes',
    'busflow_stops',
    'busflow_customers',
    'busflow_customer_contacts',
    'busflow_workers',
    'busflow_bus_types',
    'busflow_app_settings'
  ] loop
    if to_regclass(format('public.%I', v_table)) is null then
      v_missing := array_append(v_missing, v_table);
    end if;
  end loop;

  foreach v_func in array array[
    'is_platform_admin',
    'has_account_access',
    'account_role',
    'can_manage_account',
    'claim_my_invitation',
    'handle_new_user'
  ] loop
    if not exists (
      select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname = v_func
    ) then
      v_func_missing := array_append(v_func_missing, v_func);
    end if;
  end loop;

  if coalesce(array_length(v_missing, 1), 0) > 0 then
    raise exception 'Phase43 failed: missing critical tables: %', array_to_string(v_missing, ', ');
  end if;

  if coalesce(array_length(v_func_missing, 1), 0) > 0 then
    raise exception 'Phase43 failed: missing critical functions: %', array_to_string(v_func_missing, ', ');
  end if;

  raise notice 'OK: phase43 role governance/lifecycle/preflight checks passed';
end
$$;
