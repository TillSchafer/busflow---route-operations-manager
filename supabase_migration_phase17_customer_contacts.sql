-- Phase 17: Company + Contact model for BusFlow customers

create table if not exists public.busflow_customer_contacts (
  id uuid default uuid_generate_v4() primary key,
  customer_id uuid not null references public.busflow_customers(id) on delete cascade,
  first_name text,
  last_name text,
  full_name text,
  email text,
  phone text,
  street text,
  postal_code text,
  city text,
  country text,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.busflow_customer_contacts enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_proc
    where proname = 'set_updated_at'
      and pg_function_is_visible(oid)
  ) then
    execute $fn$
      create function public.set_updated_at()
      returns trigger as $inner$
      begin
        new.updated_at = timezone('utc'::text, now());
        return new;
      end;
      $inner$ language plpgsql
    $fn$;
  end if;
end
$$;

drop trigger if exists set_busflow_customer_contacts_updated_at on public.busflow_customer_contacts;
create trigger set_busflow_customer_contacts_updated_at
before update on public.busflow_customer_contacts
for each row execute function public.set_updated_at();

create unique index if not exists idx_busflow_customer_contacts_customer_email_unique
on public.busflow_customer_contacts (customer_id, lower(email))
where email is not null and btrim(email) <> '';

create index if not exists idx_busflow_customer_contacts_customer_name_phone
on public.busflow_customer_contacts (customer_id, lower(coalesce(full_name, '')), lower(coalesce(phone, '')));

drop policy if exists "Authenticated users can view customer contacts" on public.busflow_customer_contacts;
create policy "Authenticated users can view customer contacts"
  on public.busflow_customer_contacts
  for select
  using (auth.role() = 'authenticated');

drop policy if exists "Dispatch+ can manage customer contacts" on public.busflow_customer_contacts;
create policy "Dispatch+ can manage customer contacts"
  on public.busflow_customer_contacts
  for all
  using (
    (select global_role from public.profiles where id = auth.uid()) = 'ADMIN'
    or exists (
      select 1
      from public.app_permissions
      where user_id = auth.uid()
        and app_id = 'busflow'
        and role in ('ADMIN', 'DISPATCH')
    )
  );

alter table public.busflow_routes
add column if not exists customer_contact_id uuid references public.busflow_customer_contacts(id);

create index if not exists idx_busflow_routes_customer_contact_id
  on public.busflow_routes(customer_contact_id);

