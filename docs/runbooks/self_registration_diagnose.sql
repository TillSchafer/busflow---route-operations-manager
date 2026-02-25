-- Self-registration 409 diagnosis (read-only)
-- Replace the email literal if needed.

-- 1) Invitations for email
select
  i.id,
  i.account_id,
  a.slug,
  i.email,
  i.role,
  i.status,
  i.expires_at,
  i.created_at,
  coalesce(i.meta->>'source', 'unknown') as source
from public.account_invitations i
left join public.platform_accounts a on a.id = i.account_id
where lower(i.email) = lower('mcmister12@gmail.com')
order by i.created_at desc;

-- 2) Profiles for email
select p.id, p.email, p.global_role, p.created_at
from public.profiles p
where lower(p.email) = lower('mcmister12@gmail.com')
order by p.created_at desc;

-- 3) Memberships for email
select
  m.id,
  m.account_id,
  a.slug,
  m.user_id,
  m.role,
  m.status,
  m.created_at
from public.account_memberships m
join public.platform_accounts a on a.id = m.account_id
join public.profiles p on p.id = m.user_id
where lower(p.email) = lower('mcmister12@gmail.com')
order by m.created_at desc;

-- 4) Auth user state (requires auth schema access in SQL editor)
select u.id, u.email, u.email_confirmed_at, u.created_at, u.last_sign_in_at
from auth.users u
where lower(u.email) = lower('mcmister12@gmail.com')
order by u.created_at desc;

-- 5) Quick classification hints
-- confirmed user:
select exists (
  select 1
  from auth.users u
  where lower(u.email) = lower('mcmister12@gmail.com')
    and u.email_confirmed_at is not null
) as is_confirmed_user;

-- ghost user (auth exists, unconfirmed, no ACTIVE membership):
select exists (
  select 1
  from auth.users u
  where lower(u.email) = lower('mcmister12@gmail.com')
    and u.email_confirmed_at is null
    and not exists (
      select 1
      from public.account_memberships m
      where m.user_id = u.id
        and m.status = 'ACTIVE'
    )
) as is_ghost_user;

-- reusable pending self-registration:
select exists (
  select 1
  from public.account_invitations i
  where lower(i.email) = lower('mcmister12@gmail.com')
    and i.status = 'PENDING'
    and i.expires_at > timezone('utc'::text, now())
    and coalesce(i.meta->>'source', 'unknown') = 'self_register_trial'
) as has_reusable_pending_self_register;

-- conflicting pending invite source:
select exists (
  select 1
  from public.account_invitations i
  where lower(i.email) = lower('mcmister12@gmail.com')
    and i.status = 'PENDING'
    and i.expires_at > timezone('utc'::text, now())
    and coalesce(i.meta->>'source', 'unknown') <> 'self_register_trial'
) as has_conflicting_pending_source;
