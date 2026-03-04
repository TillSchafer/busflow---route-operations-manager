-- Invite onboarding hardening:
-- - Introduce 6-digit invite code verification state for pending invitations.
-- - Guard invitation claim until invite code has been verified (when configured).

create extension if not exists pgcrypto with schema extensions;

create or replace function public.get_my_invitation_code_state(p_account_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user_id uuid;
  v_email text;
  v_invitation record;
  v_expected_hash text;
  v_verified_at text;
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

  select i.id, i.meta
    into v_invitation
  from public.account_invitations i
  where lower(i.email) = lower(v_email)
    and i.status = 'PENDING'
    and i.expires_at > timezone('utc'::text, now())
    and (p_account_id is null or i.account_id = p_account_id)
  order by i.created_at asc
  limit 1;

  if not found then
    return jsonb_build_object(
      'ok', true,
      'code', 'NO_PENDING_INVITATION',
      'code_required', false,
      'code_verified', false
    );
  end if;

  v_expected_hash := nullif(btrim(coalesce(v_invitation.meta->>'invite_code_hash', '')), '');
  v_verified_at := nullif(btrim(coalesce(v_invitation.meta->>'invite_code_verified_at', '')), '');

  return jsonb_build_object(
    'ok', true,
    'code', 'INVITATION_CODE_STATE',
    'code_required', v_expected_hash is not null,
    'code_verified', v_verified_at is not null
  );
end;
$$;

revoke all on function public.get_my_invitation_code_state(uuid) from public;
grant execute on function public.get_my_invitation_code_state(uuid) to authenticated;

create or replace function public.verify_my_invitation_code(p_code text, p_account_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user_id uuid;
  v_email text;
  v_invitation record;
  v_expected_hash text;
  v_verified_at text;
  v_normalized_code text;
  v_received_hash text;
  v_attempts int;
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

  select i.id, i.meta
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

  v_expected_hash := nullif(btrim(coalesce(v_invitation.meta->>'invite_code_hash', '')), '');
  if v_expected_hash is null then
    return jsonb_build_object('ok', true, 'code', 'NO_CODE_REQUIRED');
  end if;

  v_verified_at := nullif(btrim(coalesce(v_invitation.meta->>'invite_code_verified_at', '')), '');
  if v_verified_at is not null then
    return jsonb_build_object('ok', true, 'code', 'CODE_ALREADY_VERIFIED');
  end if;

  v_normalized_code := regexp_replace(coalesce(p_code, ''), '\D', '', 'g');
  if length(v_normalized_code) <> 6 then
    return jsonb_build_object('ok', false, 'code', 'INVALID_CODE_FORMAT');
  end if;

  v_attempts := case
    when coalesce(v_invitation.meta->>'invite_code_attempts', '') ~ '^\d+$' then (v_invitation.meta->>'invite_code_attempts')::int
    else 0
  end;

  v_received_hash := encode(extensions.digest(v_normalized_code, 'sha256'), 'hex');
  if v_received_hash <> v_expected_hash then
    update public.account_invitations i
    set meta = coalesce(i.meta, '{}'::jsonb) || jsonb_build_object(
      'invite_code_attempts', v_attempts + 1,
      'invite_code_last_failed_at', timezone('utc'::text, now())
    )
    where i.id = v_invitation.id;

    return jsonb_build_object('ok', false, 'code', 'INVITE_CODE_INVALID');
  end if;

  update public.account_invitations i
  set meta = coalesce(i.meta, '{}'::jsonb) || jsonb_build_object(
    'invite_code_attempts', v_attempts + 1,
    'invite_code_verified_at', timezone('utc'::text, now()),
    'invite_code_verified_by', v_user_id
  )
  where i.id = v_invitation.id;

  return jsonb_build_object('ok', true, 'code', 'CODE_VERIFIED');
end;
$$;

revoke all on function public.verify_my_invitation_code(text, uuid) from public;
grant execute on function public.verify_my_invitation_code(text, uuid) to authenticated;

create or replace function public.claim_my_invitation_secure(p_account_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user_id uuid;
  v_email text;
  v_invitation record;
  v_expected_hash text;
  v_verified_at text;
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

  select i.id, i.meta
    into v_invitation
  from public.account_invitations i
  where lower(i.email) = lower(v_email)
    and i.status = 'PENDING'
    and i.expires_at > timezone('utc'::text, now())
    and (p_account_id is null or i.account_id = p_account_id)
  order by i.created_at asc
  limit 1;

  if found then
    v_expected_hash := nullif(btrim(coalesce(v_invitation.meta->>'invite_code_hash', '')), '');
    v_verified_at := nullif(btrim(coalesce(v_invitation.meta->>'invite_code_verified_at', '')), '');

    if v_expected_hash is not null and v_verified_at is null then
      return jsonb_build_object('ok', false, 'code', 'INVITE_CODE_REQUIRED');
    end if;
  end if;

  return public.claim_my_invitation(p_account_id);
end;
$$;

revoke all on function public.claim_my_invitation_secure(uuid) from public;
grant execute on function public.claim_my_invitation_secure(uuid) to authenticated;

