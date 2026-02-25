-- Phase 44b: advisory lock helper for public self-registration

create or replace function public.acquire_self_signup_lock(p_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform pg_advisory_xact_lock(hashtext(lower(coalesce(trim(p_email), ''))));
end;
$$;

revoke all on function public.acquire_self_signup_lock(text) from public;
grant execute on function public.acquire_self_signup_lock(text) to service_role;

-- Verification notice.
do $$
declare
  v_exists boolean;
begin
  select exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'acquire_self_signup_lock'
  ) into v_exists;

  if not coalesce(v_exists, false) then
    raise exception 'Phase44b failed: missing function public.acquire_self_signup_lock(text)';
  end if;

  raise notice 'OK: phase44b self-signup advisory lock helper created';
end
$$;
