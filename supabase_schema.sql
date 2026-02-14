-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. PROFILES (Platform Core)
-- This table extends the default auth.users table
create table public.profiles (
  id uuid references auth.users on delete cascade not null primary key,
  email text,
  full_name text,
  avatar_url text,
  global_role text default 'USER' check (global_role in ('ADMIN', 'USER')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Turn on Row Level Security
alter table public.profiles enable row level security;

-- Policies for Profiles
create policy "Public profiles are viewable by everyone."
  on profiles for select
  using ( true );

create policy "Users can insert their own profile."
  on profiles for insert
  with check ( auth.uid() = id );

create policy "Users can update own profile."
  on profiles for update
  using ( auth.uid() = id );

-- 2. APP PERMISSIONS (Platform Core)
create table public.app_permissions (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  app_id text not null, -- 'busflow', 'company-gpt'
  role text not null,   -- 'ADMIN', 'DISPATCH', 'VIEWER'
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(user_id, app_id)
);

alter table public.app_permissions enable row level security;

-- Policies for App Permissions
create policy "Admins can view all permissions."
  on app_permissions for select
  using ( 
    exists (
      select 1 from profiles
      where profiles.id = auth.uid() and profiles.global_role = 'ADMIN'
    )
    or user_id = auth.uid() -- Users can see their own permissions
  );

-- 3. BUSFLOW TABLES (App Data)

-- Bus Types
create table public.busflow_bus_types (
    id uuid default uuid_generate_v4() primary key,
    name text not null,
    capacity int default 0,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
alter table public.busflow_bus_types enable row level security;
create policy "Authenticated users can view bus types" on busflow_bus_types for select using (auth.role() = 'authenticated');
create policy "Dispatch+ can manage bus types" on busflow_bus_types for all using (
    exists (select 1 from app_permissions where user_id = auth.uid() and app_id = 'busflow' and role in ('ADMIN', 'DISPATCH'))
);

-- Routes
create table public.busflow_routes (
    id uuid default uuid_generate_v4() primary key,
    name text not null,
    date date default current_date,
    status text default 'Draft' check (status in ('Draft', 'Published')),
    bus_type_id uuid references public.busflow_bus_types(id),
    driver_name text, 
    operational_notes text,
    created_by uuid references public.profiles(id),
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
alter table public.busflow_routes enable row level security;
create policy "Everyone can view published routes" on busflow_routes for select using (status = 'Published');
create policy "Dispatch+ can view all routes" on busflow_routes for select using (
    exists (select 1 from app_permissions where user_id = auth.uid() and app_id = 'busflow' and role in ('ADMIN', 'DISPATCH'))
);
create policy "Dispatch+ can manage routes" on busflow_routes for all using (
    exists (select 1 from app_permissions where user_id = auth.uid() and app_id = 'busflow' and role in ('ADMIN', 'DISPATCH'))
);

-- Stops
create table public.busflow_stops (
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
alter table public.busflow_stops enable row level security;
create policy "Viewable through routes" on busflow_stops for select using (
    exists ( select 1 from busflow_routes where id = busflow_stops.route_id )
);
create policy "Dispatch+ can manage stops" on busflow_stops for all using (
    exists (select 1 from app_permissions where user_id = auth.uid() and app_id = 'busflow' and role in ('ADMIN', 'DISPATCH'))
);

-- TRIGGER to auto-create profile on signup
create or replace function public.handle_new_user() 
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url');
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
