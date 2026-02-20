-- Phase 34: Support audit helpers and action normalization
-- Adds a reusable, audited helper for platform-admin support actions.

create or replace function public.log_platform_admin_support_action(
  p_target_account_id uuid,
  p_action text,
  p_resource text,
  p_resource_id uuid default null,
  p_meta jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '42501';
  end if;

  if not public.is_platform_admin() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  insert into public.admin_access_audit (
    admin_user_id,
    target_account_id,
    action,
    resource,
    resource_id,
    meta
  )
  values (
    auth.uid(),
    p_target_account_id,
    upper(coalesce(nullif(trim(p_action), ''), 'SUPPORT_ACTION')),
    coalesce(nullif(trim(p_resource), ''), 'unknown'),
    p_resource_id,
    coalesce(p_meta, '{}'::jsonb)
  );
end;
$$;

revoke all on function public.log_platform_admin_support_action(uuid, text, text, uuid, jsonb) from public;
grant execute on function public.log_platform_admin_support_action(uuid, text, text, uuid, jsonb) to authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'admin_access_audit_action_format_check'
      and conrelid = 'public.admin_access_audit'::regclass
  ) then
    alter table public.admin_access_audit
      add constraint admin_access_audit_action_format_check
      check (action ~ '^[A-Z_]+$');
  end if;
end
$$;

create index if not exists idx_admin_access_audit_action_created
  on public.admin_access_audit(action, created_at desc);
