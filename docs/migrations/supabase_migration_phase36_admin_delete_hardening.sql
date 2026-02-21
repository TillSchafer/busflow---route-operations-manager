-- Phase 36: Admin hard-delete hardening for audit retention
--
-- Goal:
-- - Keep admin_access_audit rows even when users/accounts are hard-deleted
-- - Prevent FK violations on delete by switching to ON DELETE SET NULL

-- admin_user_id must be nullable for ON DELETE SET NULL.
alter table public.admin_access_audit
  alter column admin_user_id drop not null;

-- Drop existing FK constraints on admin_user_id / target_account_id deterministically.
do $$
declare
  v_constraint text;
begin
  for v_constraint in
    select distinct con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace n on n.oid = rel.relnamespace
    join unnest(con.conkey) as ck(attnum) on true
    join pg_attribute att
      on att.attrelid = rel.oid
     and att.attnum = ck.attnum
    where n.nspname = 'public'
      and rel.relname = 'admin_access_audit'
      and con.contype = 'f'
      and att.attname in ('admin_user_id', 'target_account_id')
  loop
    execute format('alter table public.admin_access_audit drop constraint if exists %I', v_constraint);
  end loop;
end
$$;

-- Recreate canonical FK constraints with SET NULL behavior.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'admin_access_audit_admin_user_id_fkey'
      and conrelid = 'public.admin_access_audit'::regclass
  ) then
    alter table public.admin_access_audit
      add constraint admin_access_audit_admin_user_id_fkey
      foreign key (admin_user_id)
      references public.profiles(id)
      on delete set null;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'admin_access_audit_target_account_id_fkey'
      and conrelid = 'public.admin_access_audit'::regclass
  ) then
    alter table public.admin_access_audit
      add constraint admin_access_audit_target_account_id_fkey
      foreign key (target_account_id)
      references public.platform_accounts(id)
      on delete set null;
  end if;
end
$$;
