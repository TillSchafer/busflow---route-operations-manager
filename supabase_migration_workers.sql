-- Create Workers/Drivers table
create table public.busflow_workers (
    id uuid default uuid_generate_v4() primary key,
    name text not null,
    role text, -- 'Driver', 'Mechanic', etc.
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS
alter table public.busflow_workers enable row level security;

create policy "Authenticated users can view workers" 
  on busflow_workers for select 
  using (auth.role() = 'authenticated');

create policy "Dispatch+ can manage workers" 
  on busflow_workers for all 
  using (
    exists (
      select 1 from app_permissions 
      where user_id = auth.uid() 
      and app_id = 'busflow' 
      and role in ('ADMIN', 'DISPATCH')
    )
  );
