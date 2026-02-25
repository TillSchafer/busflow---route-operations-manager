-- Owner membership recovery runbook (idempotent)
-- Target: till-schaefer@outlook.com -> pilot-account (ADMIN, ACTIVE)

-- 1) Preflight
select p.id, p.email, p.global_role
from public.profiles p
where lower(p.email) = 'till-schaefer@outlook.com';

select a.id, a.slug, a.name, a.status
from public.platform_accounts a
where a.slug = 'pilot-account';

select m.id, m.account_id, a.slug, m.user_id, m.role, m.status, m.created_at
from public.account_memberships m
join public.platform_accounts a on a.id = m.account_id
join public.profiles p on p.id = m.user_id
where lower(p.email) = 'till-schaefer@outlook.com'
order by m.created_at desc;

-- 2) Recovery: platform admin role + active membership in pilot-account
update public.profiles
set global_role = 'ADMIN'
where lower(email) = 'till-schaefer@outlook.com';

insert into public.account_memberships (account_id, user_id, role, status)
select a.id, p.id, 'ADMIN', 'ACTIVE'
from public.platform_accounts a
join public.profiles p on lower(p.email) = 'till-schaefer@outlook.com'
where a.slug = 'pilot-account'
on conflict (account_id, user_id) do update
set role = 'ADMIN',
    status = 'ACTIVE';

-- 3) Verification
select p.id, p.email, p.global_role
from public.profiles p
where lower(p.email) = 'till-schaefer@outlook.com';

select m.account_id, a.slug, m.role, m.status, m.created_at
from public.account_memberships m
join public.platform_accounts a on a.id = m.account_id
join public.profiles p on p.id = m.user_id
where lower(p.email) = 'till-schaefer@outlook.com'
order by m.created_at desc;

-- 4) Optional audit check
select id, created_at, action, resource, resource_id, meta
from public.admin_access_audit
where action in ('USER_HARD_DELETED', 'ACCOUNT_HARD_DELETED', 'MEMBERSHIP_ROLE_UPDATED')
order by created_at desc
limit 50;
