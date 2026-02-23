-- Phase 38: Security hardening — fix recursive RLS, composite index, FK cascades
--
-- Critical fix: is_platform_admin(), can_manage_account(), has_account_access() are
-- plain SQL functions that query public.profiles. Phase 27 added RLS policies on
-- profiles that call is_platform_admin(), creating infinite recursion:
--
--   SELECT from profiles (user JWT)
--     → RLS calls is_platform_admin()
--       → is_platform_admin() SELECTs from profiles
--         → RLS calls is_platform_admin() again → ∞ → "stack depth limit exceeded"
--
-- Fix: SECURITY DEFINER + SET search_path = public. The function then runs as the
-- table owner (postgres) which has BYPASSRLS, breaking the recursion at its root.

-- A1. Fix is_platform_admin() — root cause of the recursive RLS chain.
create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.global_role = 'ADMIN'
  );
$$;

-- A2. Harden can_manage_account() — also queries account_memberships from within
-- RLS policies on account_invitations; SECURITY DEFINER prevents secondary recursion.
create or replace function public.can_manage_account(p_account_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_platform_admin()
    or exists (
      select 1
      from public.account_memberships m
      where m.account_id = p_account_id
        and m.user_id = auth.uid()
        and m.status = 'ACTIVE'
        and m.role = 'ADMIN'
    );
$$;

-- A3. Harden has_account_access() — used in RLS policies on all busflow_* tables.
create or replace function public.has_account_access(p_account_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_platform_admin()
    or exists (
      select 1
      from public.account_memberships m
      where m.account_id = p_account_id
        and m.user_id = auth.uid()
        and m.status = 'ACTIVE'
    );
$$;

-- A4. Add missing composite index for RLS lookup hot-path.
-- Every RLS policy check hits (account_id, user_id, status) — without this index
-- each policy evaluation is a sequential scan on account_memberships.
create index if not exists idx_account_memberships_account_user_status
  on public.account_memberships(account_id, user_id, status);

-- A5a. Fix platform_accounts.created_by FK — allow user deletion without blocking.
-- Previously: CASCADE / no action (blocks deleting a user who created an account).
-- Now: SET NULL (account still exists, just loses the created_by reference).
do $$
declare
  v_constraint text;
begin
  for v_constraint in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace n on n.oid = rel.relnamespace
    join pg_attribute att on att.attrelid = rel.oid and att.attnum = any(con.conkey)
    where n.nspname = 'public'
      and rel.relname = 'platform_accounts'
      and con.contype = 'f'
      and att.attname = 'created_by'
  loop
    execute format('alter table public.platform_accounts drop constraint if exists %I', v_constraint);
  end loop;
end
$$;

alter table public.platform_accounts
  add constraint platform_accounts_created_by_fkey
  foreign key (created_by) references public.profiles(id) on delete set null;

-- A5b. Fix account_invitations.invited_by FK — same issue.
do $$
declare
  v_constraint text;
begin
  for v_constraint in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace n on n.oid = rel.relnamespace
    join pg_attribute att on att.attrelid = rel.oid and att.attnum = any(con.conkey)
    where n.nspname = 'public'
      and rel.relname = 'account_invitations'
      and con.contype = 'f'
      and att.attname = 'invited_by'
  loop
    execute format('alter table public.account_invitations drop constraint if exists %I', v_constraint);
  end loop;
end
$$;

alter table public.account_invitations
  add constraint account_invitations_invited_by_fkey
  foreign key (invited_by) references public.profiles(id) on delete set null;

-- Verification: confirm is_platform_admin is now SECURITY DEFINER.
do $$
declare
  v_sec text;
begin
  select case when prosecdef then 'SECURITY DEFINER' else 'NOT SECURITY DEFINER' end
    into v_sec
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'is_platform_admin';

  if v_sec <> 'SECURITY DEFINER' then
    raise exception 'Migration failed: is_platform_admin is not SECURITY DEFINER';
  else
    raise notice 'OK: is_platform_admin is SECURITY DEFINER';
  end if;
end
$$;
