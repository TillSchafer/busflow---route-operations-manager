-- Phase 40: Delete workflow hardening (atomic account delete + FK consistency)
--
-- Goals:
-- 1) Make account hard-delete DB-atomic via ON DELETE CASCADE on all account-scoped tables.
-- 2) Prevent user-delete FK blockers by using ON DELETE SET NULL where references are optional.
-- 3) Re-assert audit FK retention semantics (ON DELETE SET NULL).

-- A) Canonical account_id foreign keys -> ON DELETE CASCADE.
do $$
declare
  v_table text;
  v_constraint text;
  v_constraint_name text;
  v_tables text[] := array[
    'busflow_routes',
    'busflow_stops',
    'busflow_customers',
    'busflow_customer_contacts',
    'busflow_workers',
    'busflow_bus_types',
    'busflow_app_settings'
  ];
begin
  foreach v_table in array v_tables loop
    if not exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = v_table
        and column_name = 'account_id'
    ) then
      raise warning 'Phase40: skipped %.account_id FK migration (column missing)', v_table;
      continue;
    end if;

    for v_constraint in
      select distinct con.conname
      from pg_constraint con
      join pg_class rel on rel.oid = con.conrelid
      join pg_namespace n on n.oid = rel.relnamespace
      join unnest(con.conkey) as ck(attnum) on true
      join pg_attribute att
        on att.attrelid = rel.oid
       and att.attnum = ck.attnum
      where n.nspname = 'public'
        and rel.relname = v_table
        and con.contype = 'f'
        and att.attname = 'account_id'
    loop
      execute format('alter table public.%I drop constraint if exists %I', v_table, v_constraint);
    end loop;

    v_constraint_name := format('%s_account_id_fkey', v_table);

    execute format(
      'alter table public.%I add constraint %I foreign key (account_id) references public.platform_accounts(id) on delete cascade',
      v_table,
      v_constraint_name
    );
  end loop;
end
$$;

-- B) platform_accounts.archived_by must not block profile deletion.
do $$
declare
  v_constraint text;
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'platform_accounts'
      and column_name = 'archived_by'
  ) then
    for v_constraint in
      select distinct con.conname
      from pg_constraint con
      join pg_class rel on rel.oid = con.conrelid
      join pg_namespace n on n.oid = rel.relnamespace
      join unnest(con.conkey) as ck(attnum) on true
      join pg_attribute att
        on att.attrelid = rel.oid
       and att.attnum = ck.attnum
      where n.nspname = 'public'
        and rel.relname = 'platform_accounts'
        and con.contype = 'f'
        and att.attname = 'archived_by'
    loop
      execute format('alter table public.platform_accounts drop constraint if exists %I', v_constraint);
    end loop;

    alter table public.platform_accounts
      add constraint platform_accounts_archived_by_fkey
      foreign key (archived_by)
      references public.profiles(id)
      on delete set null;
  else
    raise warning 'Phase40: platform_accounts.archived_by column missing';
  end if;
end
$$;

-- C) Re-assert audit FK retention semantics.
-- Keep audit rows when profile/account is deleted.
do $$
declare
  v_constraint text;
begin
  for v_constraint in
    select distinct con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace n on n.oid = rel.relnamespace
    join unnest(con.conkey) as ck(attnum) on true
    join pg_attribute att
      on att.attrelid = rel.oid
     and att.attnum = ck.attnum
    where n.nspname = 'public'
      and rel.relname = 'admin_access_audit'
      and con.contype = 'f'
      and att.attname in ('admin_user_id', 'target_account_id')
  loop
    execute format('alter table public.admin_access_audit drop constraint if exists %I', v_constraint);
  end loop;

  alter table public.admin_access_audit
    add constraint admin_access_audit_admin_user_id_fkey
    foreign key (admin_user_id)
    references public.profiles(id)
    on delete set null;

  alter table public.admin_access_audit
    add constraint admin_access_audit_target_account_id_fkey
    foreign key (target_account_id)
    references public.platform_accounts(id)
    on delete set null;
end
$$;

-- D) Verification notices / assertions.
do $$
declare
  v_table text;
  v_confdeltype "char";
  v_tables text[] := array[
    'busflow_routes',
    'busflow_stops',
    'busflow_customers',
    'busflow_customer_contacts',
    'busflow_workers',
    'busflow_bus_types',
    'busflow_app_settings'
  ];
begin
  foreach v_table in array v_tables loop
    select con.confdeltype
      into v_confdeltype
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace n on n.oid = rel.relnamespace
    join unnest(con.conkey) as ck(attnum) on true
    join pg_attribute att
      on att.attrelid = rel.oid
     and att.attnum = ck.attnum
    join pg_class rel_ref on rel_ref.oid = con.confrelid
    join pg_namespace n_ref on n_ref.oid = rel_ref.relnamespace
    where n.nspname = 'public'
      and rel.relname = v_table
      and con.contype = 'f'
      and att.attname = 'account_id'
      and n_ref.nspname = 'public'
      and rel_ref.relname = 'platform_accounts'
    limit 1;

    if v_confdeltype is null then
      raise exception 'Phase40 failed: missing %.account_id FK -> platform_accounts', v_table;
    end if;

    if v_confdeltype <> 'c' then
      raise exception 'Phase40 failed: %.account_id FK must be ON DELETE CASCADE', v_table;
    end if;

    raise notice 'OK: %.account_id FK uses ON DELETE CASCADE', v_table;
  end loop;

  select con.confdeltype
    into v_confdeltype
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace n on n.oid = rel.relnamespace
  join unnest(con.conkey) as ck(attnum) on true
  join pg_attribute att
    on att.attrelid = rel.oid
   and att.attnum = ck.attnum
  where n.nspname = 'public'
    and rel.relname = 'platform_accounts'
    and con.contype = 'f'
    and att.attname = 'archived_by'
  limit 1;

  if v_confdeltype <> 'n' then
    raise exception 'Phase40 failed: platform_accounts.archived_by FK must be ON DELETE SET NULL';
  end if;
  raise notice 'OK: platform_accounts.archived_by FK uses ON DELETE SET NULL';

  select con.confdeltype
    into v_confdeltype
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace n on n.oid = rel.relnamespace
  join unnest(con.conkey) as ck(attnum) on true
  join pg_attribute att
    on att.attrelid = rel.oid
   and att.attnum = ck.attnum
  where n.nspname = 'public'
    and rel.relname = 'admin_access_audit'
    and con.contype = 'f'
    and att.attname = 'admin_user_id'
  limit 1;

  if v_confdeltype <> 'n' then
    raise exception 'Phase40 failed: admin_access_audit.admin_user_id FK must be ON DELETE SET NULL';
  end if;

  select con.confdeltype
    into v_confdeltype
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace n on n.oid = rel.relnamespace
  join unnest(con.conkey) as ck(attnum) on true
  join pg_attribute att
    on att.attrelid = rel.oid
   and att.attnum = ck.attnum
  where n.nspname = 'public'
    and rel.relname = 'admin_access_audit'
    and con.contype = 'f'
    and att.attname = 'target_account_id'
  limit 1;

  if v_confdeltype <> 'n' then
    raise exception 'Phase40 failed: admin_access_audit.target_account_id FK must be ON DELETE SET NULL';
  end if;

  raise notice 'OK: admin_access_audit FK retention semantics verified';
  raise notice 'OK: Phase40 delete workflow hardening applied';
end
$$;
