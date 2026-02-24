-- Phase 42b: Read-only invite consistency checks
-- Purpose: run in SQL editor for production diagnosis without data mutation.

-- 1) Trigger status: auth.users -> on_auth_user_created
select
  t.event_object_schema,
  t.event_object_table,
  t.trigger_name,
  t.action_timing,
  t.event_manipulation
from information_schema.triggers t
where t.event_object_schema = 'auth'
  and t.event_object_table = 'users'
  and t.trigger_name = 'on_auth_user_created';

-- 2) Ensure invitation claim function exists.
select
  n.nspname as schema_name,
  p.proname as function_name,
  p.prosecdef as is_security_definer
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('handle_new_user', 'claim_my_invitation');

-- 3) Ensure pending invitation partial unique index exists.
select
  schemaname,
  tablename,
  indexname,
  indexdef
from pg_indexes
where schemaname = 'public'
  and tablename = 'account_invitations'
  and indexname = 'uq_account_invitations_pending_per_account_email';

-- 4) Inspect a problematic email (replace placeholder).
-- Example: lower(email) = lower('user@example.com')
select id, account_id, email, role, status, expires_at, accepted_at, created_at, meta
from public.account_invitations
where lower(email) = lower('<EMAIL>')
order by created_at desc;

select id, email, full_name, global_role, created_at
from public.profiles
where lower(email) = lower('<EMAIL>');

select m.account_id, a.slug, m.user_id, m.role, m.status, m.created_at
from public.account_memberships m
join public.platform_accounts a on a.id = m.account_id
where m.user_id in (
  select p.id
  from public.profiles p
  where lower(p.email) = lower('<EMAIL>')
)
order by m.created_at desc;

-- 5) Optional: count pending invites per account/email across all accounts.
select account_id, lower(email) as email_norm, count(*) as pending_count
from public.account_invitations
where status = 'PENDING'
group by account_id, lower(email)
having count(*) > 1;
