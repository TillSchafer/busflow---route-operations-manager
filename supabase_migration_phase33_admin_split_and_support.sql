-- Phase 33: Admin split foundations + support readiness
-- Adds platform account lifecycle fields for soft suspend/archive flows.

alter table public.platform_accounts
  add column if not exists status text;

update public.platform_accounts
set status = 'ACTIVE'
where status is null;

alter table public.platform_accounts
  alter column status set default 'ACTIVE';

alter table public.platform_accounts
  alter column status set not null;

alter table public.platform_accounts
  add column if not exists updated_at timestamp with time zone default timezone('utc'::text, now());

update public.platform_accounts
set updated_at = timezone('utc'::text, now())
where updated_at is null;

alter table public.platform_accounts
  alter column updated_at set default timezone('utc'::text, now());

alter table public.platform_accounts
  alter column updated_at set not null;

alter table public.platform_accounts
  add column if not exists archived_at timestamp with time zone;

alter table public.platform_accounts
  add column if not exists archived_by uuid references public.profiles(id);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'platform_accounts_status_check'
      and conrelid = 'public.platform_accounts'::regclass
  ) then
    alter table public.platform_accounts
      add constraint platform_accounts_status_check
      check (status in ('ACTIVE', 'SUSPENDED', 'ARCHIVED'));
  end if;
end
$$;

create or replace function public.set_platform_accounts_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := timezone('utc'::text, now());
  return new;
end;
$$;

drop trigger if exists set_platform_accounts_updated_at on public.platform_accounts;
create trigger set_platform_accounts_updated_at
before update on public.platform_accounts
for each row execute function public.set_platform_accounts_updated_at();

create index if not exists idx_platform_accounts_status
  on public.platform_accounts(status);

create index if not exists idx_platform_accounts_created_at
  on public.platform_accounts(created_at desc);
