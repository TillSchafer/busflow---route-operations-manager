-- Phase 32: Defer invitation acceptance until explicit claim/login
--
-- Problem:
-- - inviteUserByEmail may create auth.users rows immediately.
-- - Previous handle_new_user() consumed invitation right away, marking it ACCEPTED.
--
-- Target:
-- - Invitation remains PENDING after admin sends invite.
-- - Membership is created as INVITED.
-- - Invitation is marked ACCEPTED only by claim_my_invitation().

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invitation record;
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

  -- Do not activate membership yet. It becomes ACTIVE only after explicit claim.
  insert into public.account_memberships (account_id, user_id, role, status)
  values (v_invitation.account_id, new.id, v_invitation.role, 'INVITED')
  on conflict (account_id, user_id) do update
  set role = excluded.role,
      status = case
        when public.account_memberships.status = 'ACTIVE' then 'ACTIVE'
        else 'INVITED'
      end;

  -- Intentionally keep invitation as PENDING here.
  return new;
end;
$$;

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
    -- Idempotent behavior if user is already active.
    select m.account_id
      into v_existing_active_account
    from public.account_memberships m
    where m.user_id = v_user_id
      and m.status = 'ACTIVE'
    limit 1;

    if v_existing_active_account is not null then
      return jsonb_build_object('ok', true, 'code', 'ALREADY_ACTIVE', 'account_id', v_existing_active_account);
    end if;

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
