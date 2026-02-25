-- Phase 44: Public self-registration foundation (14-day trial + signup attempt logging)

-- 1) Add trial lifecycle fields to platform_accounts.
alter table public.platform_accounts
  add column if not exists trial_started_at timestamp with time zone;

alter table public.platform_accounts
  add column if not exists trial_ends_at timestamp with time zone;

alter table public.platform_accounts
  add column if not exists trial_state text;

update public.platform_accounts
set trial_started_at = coalesce(trial_started_at, created_at, timezone('utc'::text, now()));

update public.platform_accounts
set trial_ends_at = coalesce(trial_ends_at, trial_started_at + interval '14 days');

update public.platform_accounts
set trial_state = coalesce(
  trial_state,
  case
    when status = 'ACTIVE' and trial_ends_at > timezone('utc'::text, now()) then 'TRIAL_ACTIVE'
    else 'SUBSCRIBED'
  end
);

alter table public.platform_accounts
  alter column trial_started_at set default timezone('utc'::text, now());

alter table public.platform_accounts
  alter column trial_ends_at set default timezone('utc'::text, now()) + interval '14 days';

alter table public.platform_accounts
  alter column trial_state set default 'TRIAL_ACTIVE';

alter table public.platform_accounts
  alter column trial_started_at set not null;

alter table public.platform_accounts
  alter column trial_ends_at set not null;

alter table public.platform_accounts
  alter column trial_state set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'platform_accounts_trial_state_check'
      and conrelid = 'public.platform_accounts'::regclass
  ) then
    alter table public.platform_accounts
      add constraint platform_accounts_trial_state_check
      check (trial_state in ('TRIAL_ACTIVE', 'TRIAL_ENDED', 'SUBSCRIBED'));
  end if;
end
$$;

create index if not exists idx_platform_accounts_trial_ends_at
  on public.platform_accounts(trial_ends_at);

create index if not exists idx_platform_accounts_trial_state
  on public.platform_accounts(trial_state);

-- 2) Store signup attempts for rate limiting / abuse diagnostics.
create table if not exists public.self_signup_attempts (
  id uuid default uuid_generate_v4() primary key,
  email_norm text,
  ip_hash text not null,
  user_agent text,
  result_code text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists idx_self_signup_attempts_created_at
  on public.self_signup_attempts(created_at desc);

create index if not exists idx_self_signup_attempts_ip_created
  on public.self_signup_attempts(ip_hash, created_at desc);

create index if not exists idx_self_signup_attempts_email_created
  on public.self_signup_attempts(email_norm, created_at desc);

alter table public.self_signup_attempts enable row level security;

-- 3) Optional lifecycle helper: mark expired trials without blocking account usage.
create or replace function public.mark_expired_trials(p_account_id uuid default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '42501';
  end if;

  if p_account_id is null then
    if not public.is_platform_admin() then
      raise exception 'FORBIDDEN' using errcode = '42501';
    end if;
  else
    if not (public.is_platform_admin() or public.can_manage_account(p_account_id)) then
      raise exception 'FORBIDDEN' using errcode = '42501';
    end if;
  end if;

  update public.platform_accounts a
  set trial_state = 'TRIAL_ENDED'
  where a.trial_state = 'TRIAL_ACTIVE'
    and a.trial_ends_at <= timezone('utc'::text, now())
    and (p_account_id is null or a.id = p_account_id);

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.mark_expired_trials(uuid) from public;
grant execute on function public.mark_expired_trials(uuid) to authenticated;

-- Verification notices.
do $$
declare
  v_trials_columns_ok boolean;
  v_signup_table_ok boolean;
begin
  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'platform_accounts'
      and column_name in ('trial_started_at', 'trial_ends_at', 'trial_state')
    group by table_name
    having count(*) = 3
  ) into v_trials_columns_ok;

  select to_regclass('public.self_signup_attempts') is not null into v_signup_table_ok;

  if not coalesce(v_trials_columns_ok, false) then
    raise exception 'Phase44 failed: missing trial columns on platform_accounts';
  end if;

  if not coalesce(v_signup_table_ok, false) then
    raise exception 'Phase44 failed: missing self_signup_attempts table';
  end if;

  raise notice 'OK: phase44 self-registration trial schema applied';
end
$$;
