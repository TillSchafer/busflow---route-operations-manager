-- Phase 22: Tenant foundation (accounts, memberships, admin audit)

create table if not exists public.platform_accounts (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  slug text not null unique,
  created_by uuid references public.profiles(id),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists public.account_memberships (
  id uuid default uuid_generate_v4() primary key,
  account_id uuid not null references public.platform_accounts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('ADMIN','DISPATCH','VIEWER')),
  status text not null default 'ACTIVE' check (status in ('ACTIVE','INVITED','SUSPENDED')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(account_id, user_id)
);

create table if not exists public.admin_access_audit (
  id uuid default uuid_generate_v4() primary key,
  admin_user_id uuid not null references public.profiles(id),
  target_account_id uuid references public.platform_accounts(id),
  action text not null,
  resource text not null,
  resource_id uuid,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists idx_account_memberships_user on public.account_memberships(user_id);
create index if not exists idx_account_memberships_account on public.account_memberships(account_id);
create index if not exists idx_admin_access_audit_admin on public.admin_access_audit(admin_user_id, created_at desc);
create index if not exists idx_admin_access_audit_account on public.admin_access_audit(target_account_id, created_at desc);

alter table public.platform_accounts enable row level security;
alter table public.account_memberships enable row level security;
alter table public.admin_access_audit enable row level security;

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.global_role = 'ADMIN'
  );
$$;

create or replace function public.has_account_access(p_account_id uuid)
returns boolean
language sql
stable
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

create or replace function public.account_role(p_account_id uuid)
returns text
language sql
stable
as $$
  select coalesce(
    (
      select m.role
      from public.account_memberships m
      where m.account_id = p_account_id
        and m.user_id = auth.uid()
        and m.status = 'ACTIVE'
      limit 1
    ),
    case when public.is_platform_admin() then 'ADMIN' else null end
  );
$$;

drop policy if exists "Accounts visible to members and platform admins" on public.platform_accounts;
create policy "Accounts visible to members and platform admins"
  on public.platform_accounts
  for select
  using (public.has_account_access(id));

drop policy if exists "Only platform admins can create accounts" on public.platform_accounts;
create policy "Only platform admins can create accounts"
  on public.platform_accounts
  for insert
  with check (public.is_platform_admin());

drop policy if exists "Only platform admins can update accounts" on public.platform_accounts;
create policy "Only platform admins can update accounts"
  on public.platform_accounts
  for update
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

drop policy if exists "Only platform admins can delete accounts" on public.platform_accounts;
create policy "Only platform admins can delete accounts"
  on public.platform_accounts
  for delete
  using (public.is_platform_admin());

drop policy if exists "Memberships visible to owner and platform admins" on public.account_memberships;
create policy "Memberships visible to owner and platform admins"
  on public.account_memberships
  for select
  using (user_id = auth.uid() or public.is_platform_admin());

drop policy if exists "Only platform admins can manage memberships" on public.account_memberships;
create policy "Only platform admins can manage memberships"
  on public.account_memberships
  for all
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

drop policy if exists "Only platform admins can read admin audit" on public.admin_access_audit;
create policy "Only platform admins can read admin audit"
  on public.admin_access_audit
  for select
  using (public.is_platform_admin());

drop policy if exists "System can write admin audit" on public.admin_access_audit;
create policy "System can write admin audit"
  on public.admin_access_audit
  for insert
  with check (public.is_platform_admin());

insert into public.platform_accounts (name, slug, created_by)
values ('Pilot Account', 'pilot-account', auth.uid())
on conflict (slug) do nothing;

with pilot as (
  select id
  from public.platform_accounts
  where slug = 'pilot-account'
  limit 1
)
insert into public.account_memberships (account_id, user_id, role, status)
select
  pilot.id,
  p.id,
  case when p.global_role = 'ADMIN' then 'ADMIN' else 'DISPATCH' end,
  'ACTIVE'
from public.profiles p
cross join pilot
on conflict (account_id, user_id) do update
set role = excluded.role,
    status = 'ACTIVE';
