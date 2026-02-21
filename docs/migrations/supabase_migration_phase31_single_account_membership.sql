-- Phase 31: Invite-claim onboarding + one active account per user
--
-- Goals:
-- - Enforce exactly one ACTIVE account membership per user
-- - Allow account admins to manage members of their own account
-- - Claim pending invitations automatically in handle_new_user()
-- - Provide fallback RPC for existing users to claim invitations

-- Safety check before enforcing one ACTIVE membership per user.
do $$
declare
  v_conflicts integer;
  v_sample text;
begin
  select count(*)
    into v_conflicts
  from (
    select user_id
    from public.account_memberships
    where status = 'ACTIVE'
    group by user_id
    having count(*) > 1
  ) t;

  if v_conflicts > 0 then
    select string_agg(user_id::text, ', ')
      into v_sample
    from (
      select user_id
      from public.account_memberships
      where status = 'ACTIVE'
      group by user_id
      having count(*) > 1
      limit 25
    ) s;

    raise exception
      'Phase31 aborted: % users have more than one ACTIVE membership. Sample user IDs: %',
      v_conflicts,
      coalesce(v_sample, 'n/a');
  end if;
end
$$;

create unique index if not exists uq_account_memberships_one_active_per_user
  on public.account_memberships(user_id)
  where status = 'ACTIVE';

-- Keep account-admin capability explicit and reusable.
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

-- Membership policies: account admins can manage users in their own account.
drop policy if exists "Memberships visible to owner and platform admins" on public.account_memberships;
drop policy if exists "Only platform admins can manage memberships" on public.account_memberships;
drop policy if exists "Memberships visible to account admins and platform admins" on public.account_memberships;
drop policy if exists "Memberships managed by account admins and platform admins" on public.account_memberships;

create policy "Memberships visible to account admins and platform admins"
  on public.account_memberships
  for select
  using (
    user_id = auth.uid()
    or public.can_manage_account(account_id)
    or public.is_platform_admin()
  );

create policy "Memberships managed by account admins and platform admins"
  on public.account_memberships
  for all
  using (public.can_manage_account(account_id))
  with check (public.can_manage_account(account_id));

-- Canonical invite-claim trigger.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invitation record;
  v_existing_active_account uuid;
begin
  -- Invite-only onboarding: user must have a pending invitation.
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

  -- Legacy compatibility table remains, but default role is read-only.
  insert into public.app_permissions (user_id, app_id, role)
  values (new.id, 'busflow', 'VIEWER')
  on conflict (user_id, app_id) do nothing;

  select m.account_id
    into v_existing_active_account
  from public.account_memberships m
  where m.user_id = new.id
    and m.status = 'ACTIVE'
  limit 1;

  if v_existing_active_account is not null and v_existing_active_account <> v_invitation.account_id then
    raise exception 'ACTIVE_MEMBERSHIP_EXISTS' using errcode = '23505';
  end if;

  insert into public.account_memberships (account_id, user_id, role, status)
  values (v_invitation.account_id, new.id, v_invitation.role, 'ACTIVE')
  on conflict (account_id, user_id) do update
  set role = excluded.role,
      status = 'ACTIVE';

  update public.account_invitations
  set status = 'ACCEPTED',
      accepted_at = timezone('utc'::text, now())
  where id = v_invitation.id;

  return new;
end;
$$;

-- Keep trigger binding canonical.
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Fallback claim flow for existing authenticated users.
create or replace function public.claim_my_invitation(p_account_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_email text;
  v_invitation record;
  v_existing_active_account uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    return jsonb_build_object('ok', false, 'code', 'NOT_AUTHENTICATED');
  end if;

  select p.email
    into v_email
  from public.profiles p
  where p.id = v_user_id;

  if v_email is null then
    return jsonb_build_object('ok', false, 'code', 'PROFILE_MISSING');
  end if;

  select i.*
    into v_invitation
  from public.account_invitations i
  where lower(i.email) = lower(v_email)
    and i.status = 'PENDING'
    and i.expires_at > timezone('utc'::text, now())
    and (p_account_id is null or i.account_id = p_account_id)
  order by i.created_at asc
  limit 1
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'NO_PENDING_INVITATION');
  end if;

  select m.account_id
    into v_existing_active_account
  from public.account_memberships m
  where m.user_id = v_user_id
    and m.status = 'ACTIVE'
  limit 1;

  if v_existing_active_account is not null and v_existing_active_account <> v_invitation.account_id then
    return jsonb_build_object('ok', false, 'code', 'ACTIVE_MEMBERSHIP_EXISTS');
  end if;

  insert into public.account_memberships (account_id, user_id, role, status)
  values (v_invitation.account_id, v_user_id, v_invitation.role, 'ACTIVE')
  on conflict (account_id, user_id) do update
  set role = excluded.role,
      status = 'ACTIVE';

  update public.account_invitations
  set status = 'ACCEPTED',
      accepted_at = timezone('utc'::text, now())
  where id = v_invitation.id;

  return jsonb_build_object(
    'ok', true,
    'account_id', v_invitation.account_id,
    'role', v_invitation.role
  );
end;
$$;

revoke all on function public.claim_my_invitation(uuid) from public;
grant execute on function public.claim_my_invitation(uuid) to authenticated;
