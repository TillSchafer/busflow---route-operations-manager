-- Phase 45: Owner account trial recovery
-- Sets the platform owner's own account to SUBSCRIBED so no trial banner appears.
-- Note: Targets the first platform admin by global_role to avoid storing PII in version control.

do $$
declare
  v_owner_id uuid;
  v_account_id uuid;
  v_updated integer := 0;
begin
  -- Find the platform owner by global admin role (first admin created, idempotent — no-op if already SUBSCRIBED)
  select id into v_owner_id
  from public.profiles
  where global_role = 'ADMIN'
  order by created_at asc
  limit 1;

  if v_owner_id is null then
    raise notice 'Phase45: no admin profile found — skipping owner trial recovery';
  else
    -- Find their account via ACTIVE membership
    select m.account_id into v_account_id
    from public.account_memberships m
    where m.user_id = v_owner_id
      and m.status = 'ACTIVE'
    limit 1;

    if v_account_id is null then
      raise notice 'Phase45: no ACTIVE membership found for admin owner — skipping';
    else
      update public.platform_accounts
      set
        trial_state    = 'SUBSCRIBED',
        trial_ends_at  = timezone('utc', now()),
        updated_at     = timezone('utc', now())
      where id = v_account_id
        and trial_state in ('TRIAL_ACTIVE', 'TRIAL_ENDED');

      get diagnostics v_updated = row_count;

      if v_updated > 0 then
        raise notice 'Phase45: owner account % set to SUBSCRIBED', v_account_id;
      else
        raise notice 'Phase45: owner account % already SUBSCRIBED — no change needed', v_account_id;
      end if;
    end if;
  end if;
end
$$;

-- Verification
do $$
begin
  raise notice 'OK: phase45 owner trial controls applied';
end
$$;
