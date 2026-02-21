-- Phase 20: Strict relational customer enforcement for routes
--
-- Launch target:
-- - busflow_routes.customer_id is mandatory
-- - customer_contact_id remains optional
-- - customer_contact_id (if present) must belong to customer_id

create index if not exists idx_busflow_routes_customer_id
  on public.busflow_routes(customer_id);

create index if not exists idx_busflow_routes_customer_contact_id
  on public.busflow_routes(customer_contact_id);

-- Backfill customer_id from linked contact first (strongest relational source).
update public.busflow_routes r
set customer_id = c.customer_id
from public.busflow_customer_contacts c
where r.customer_contact_id = c.id
  and (r.customer_id is null or r.customer_id <> c.customer_id);

-- Deterministic backfill from legacy customer_name where still missing.
-- Guarded: this column may already be dropped in environments that ran phase21.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'busflow_routes'
      and column_name = 'customer_name'
  ) then
    execute $sql$
      with customer_name_lut as (
        select distinct on (lower(btrim(name)))
          id,
          lower(btrim(name)) as lname
        from public.busflow_customers
        where btrim(name) <> ''
        order by lower(btrim(name)), created_at asc, id asc
      )
      update public.busflow_routes r
      set customer_id = lut.id
      from customer_name_lut lut
      where r.customer_id is null
        and nullif(btrim(r.customer_name), '') is not null
        and lower(btrim(r.customer_name)) = lut.lname
    $sql$;
  end if;
end
$$;

-- Abort with actionable warning if unresolved records remain.
do $$
declare
  v_unresolved integer;
  v_sample text;
begin
  select count(*) into v_unresolved
  from public.busflow_routes
  where customer_id is null;

  if v_unresolved > 0 then
    select string_agg(id::text, ', ')
      into v_sample
    from (
      select id
      from public.busflow_routes
      where customer_id is null
      order by created_at desc
      limit 25
    ) s;

    raise warning 'Cannot enforce NOT NULL customer_id. unresolved route count: %, sample IDs: %', v_unresolved, coalesce(v_sample, 'n/a');
    raise exception 'Phase20 aborted: unresolved routes without customer_id. Backfill customer/company data first.';
  end if;
end
$$;

-- Enforce mandatory company relationship for all future routes.
alter table public.busflow_routes
  alter column customer_id set not null;

-- Trigger-based integrity check for optional contact linkage.
create or replace function public.enforce_busflow_route_customer_contact_match()
returns trigger
language plpgsql
as $$
declare
  v_contact_customer_id uuid;
begin
  if new.customer_contact_id is null then
    return new;
  end if;

  select customer_id
    into v_contact_customer_id
  from public.busflow_customer_contacts
  where id = new.customer_contact_id;

  if v_contact_customer_id is null then
    raise exception 'Selected customer contact does not exist.' using errcode = '23503';
  end if;

  if new.customer_id <> v_contact_customer_id then
    raise exception 'Selected customer contact does not belong to selected customer.' using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_busflow_route_customer_contact_match on public.busflow_routes;
create trigger enforce_busflow_route_customer_contact_match
before insert or update on public.busflow_routes
for each row execute function public.enforce_busflow_route_customer_contact_match();
