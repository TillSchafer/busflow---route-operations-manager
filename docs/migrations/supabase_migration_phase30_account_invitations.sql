-- Phase 30: Invitation foundation for tenant onboarding (invite-only)

create table if not exists public.account_invitations (
  id uuid default uuid_generate_v4() primary key,
  account_id uuid not null references public.platform_accounts(id) on delete cascade,
  email text not null,
  role text not null default 'VIEWER' check (role in ('ADMIN','DISPATCH','VIEWER')),
  status text not null default 'PENDING' check (status in ('PENDING','ACCEPTED','REVOKED','EXPIRED')),
  token uuid not null default uuid_generate_v4(),
  invited_by uuid references public.profiles(id),
  expires_at timestamp with time zone not null default timezone('utc'::text, now()) + interval '7 days',
  accepted_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  meta jsonb not null default '{}'::jsonb
);

create index if not exists idx_account_invitations_account_id
  on public.account_invitations(account_id, created_at desc);

create index if not exists idx_account_invitations_email
  on public.account_invitations(lower(email));

create unique index if not exists uq_account_invitations_pending_per_account_email
  on public.account_invitations(account_id, lower(email))
  where status = 'PENDING';

alter table public.account_invitations enable row level security;
alter table public.account_invitations force row level security;

create or replace function public.can_manage_account(p_account_id uuid)
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
        and m.role = 'ADMIN'
    );
$$;

drop policy if exists "Invitations visible to account admins and platform admins" on public.account_invitations;
create policy "Invitations visible to account admins and platform admins"
  on public.account_invitations
  for select
  using (public.can_manage_account(account_id));

drop policy if exists "Invitations managed by account admins and platform admins" on public.account_invitations;
create policy "Invitations managed by account admins and platform admins"
  on public.account_invitations
  for all
  using (public.can_manage_account(account_id))
  with check (public.can_manage_account(account_id));
