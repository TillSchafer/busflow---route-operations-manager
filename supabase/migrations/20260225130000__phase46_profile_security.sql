-- Phase 46: Profile security — auth.users → profiles.email sync trigger
-- Ensures that when a user's email is confirmed in auth.users, profiles.email stays in sync.
-- The trigger fires AFTER the email column is updated (i.e., after confirmation is complete).

-- 1. Sync function: propagate confirmed email from auth.users to public.profiles
create or replace function public.sync_profile_email_from_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if NEW.email is distinct from OLD.email and NEW.email is not null then
    update public.profiles
    set email = NEW.email
    where id = NEW.id;

    raise notice 'phase46: synced profiles.email for user % to %', NEW.id, NEW.email;
  end if;

  return NEW;
end;
$$;

-- 2. Trigger on auth.users — fires after email column update
do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'trg_sync_profile_email_on_auth_update'
      and tgrelid = 'auth.users'::regclass
  ) then
    create trigger trg_sync_profile_email_on_auth_update
      after update of email on auth.users
      for each row
      execute function public.sync_profile_email_from_auth_user();

    raise notice 'phase46: created trigger trg_sync_profile_email_on_auth_update on auth.users';
  else
    raise notice 'phase46: trigger trg_sync_profile_email_on_auth_update already exists — skipping';
  end if;
end
$$;

-- 3. Backfill: sync existing profiles.email mismatches from auth.users
do $$
declare
  v_updated integer;
begin
  update public.profiles p
  set email = au.email
  from auth.users au
  where p.id = au.id
    and au.email is not null
    and au.email is distinct from p.email;

  get diagnostics v_updated = row_count;

  if v_updated > 0 then
    raise notice 'phase46: backfilled % profile email(s) from auth.users', v_updated;
  else
    raise notice 'phase46: no email mismatches found — backfill not needed';
  end if;
end
$$;

-- 4. Verification
do $$
begin
  raise notice 'OK: phase46 profile security migration applied';
end
$$;
