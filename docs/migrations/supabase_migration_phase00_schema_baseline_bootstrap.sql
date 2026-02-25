-- Phase 00: Greenfield schema baseline bootstrap
--
-- Purpose:
-- - Make migration chain reproducible on fresh projects.
-- - Create legacy/core base objects expected by early phases (3+).
-- - Non-destructive: only CREATE IF NOT EXISTS.

create extension if not exists "uuid-ossp";

create table if not exists public.profiles (
  id uuid references auth.users on delete cascade not null primary key,
  email text,
  full_name text,
  avatar_url text,
  global_role text default 'USER' check (global_role in ('ADMIN', 'USER')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists public.app_permissions (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  app_id text not null,
  role text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(user_id, app_id)
);

create table if not exists public.busflow_bus_types (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  capacity int default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists public.busflow_workers (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  role text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists public.busflow_routes (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  date date default current_date,
  status text default 'Draft' check (status in ('Draft', 'Published')),
  bus_type_id uuid references public.busflow_bus_types(id),
  driver_name text,
  operational_notes text,
  created_by uuid references public.profiles(id),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists public.busflow_stops (
  id uuid default uuid_generate_v4() primary key,
  route_id uuid references public.busflow_routes(id) on delete cascade not null,
  location text not null,
  arrival_time time,
  departure_time time,
  boarding int default 0,
  leaving int default 0,
  current_total int default 0,
  sequence_order int default 0,
  notes text
);

alter table if exists public.profiles enable row level security;
alter table if exists public.app_permissions enable row level security;
alter table if exists public.busflow_bus_types enable row level security;
alter table if exists public.busflow_workers enable row level security;
alter table if exists public.busflow_routes enable row level security;
alter table if exists public.busflow_stops enable row level security;

do $$
begin
  raise notice 'Phase00 baseline ensured core schema objects for greenfield bootstrap.';
end
$$;
