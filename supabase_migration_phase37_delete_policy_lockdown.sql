-- Phase 37: Delete-policy lockdown for profiles/platform_accounts
--
-- Goal:
-- - Block direct client-side hard deletes on sensitive admin tables
-- - Force deletes through audited edge functions

-- Drop canonical and legacy DELETE policies (if present).
drop policy if exists "Profiles: platform admin delete" on public.profiles;
drop policy if exists "Admins can delete profiles." on public.profiles;
drop policy if exists "Only platform admins can delete accounts" on public.platform_accounts;

-- Safety audit: warn if any DELETE policies still exist on these tables.
do $$
declare
  v_count integer;
begin
  select count(*)
    into v_count
  from pg_policies p
  where p.schemaname = 'public'
    and p.tablename in ('profiles', 'platform_accounts')
    and p.cmd = 'DELETE';

  if v_count > 0 then
    raise warning 'DELETE policies still exist on profiles/platform_accounts: %', v_count;
  end if;
end
$$;
