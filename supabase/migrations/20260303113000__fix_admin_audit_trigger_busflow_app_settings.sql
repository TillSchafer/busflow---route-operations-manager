-- Fix admin audit trigger for tables without `id` column (e.g. busflow_app_settings).
-- Previous implementation accessed NEW.id/OLD.id directly, which raises 42703.

create or replace function public.audit_platform_admin_mutations()
returns trigger
language plpgsql
as $$
declare
  v_account_id uuid;
  v_resource_id uuid;
begin
  if not public.is_platform_admin() then
    return coalesce(new, old);
  end if;

  -- Use jsonb projection to avoid record-field access errors on tables
  -- that do not expose all columns (such as missing `id`).
  if tg_op = 'INSERT' then
    v_account_id := (to_jsonb(new)->>'account_id')::uuid;
    v_resource_id := (to_jsonb(new)->>'id')::uuid;
  elsif tg_op = 'DELETE' then
    v_account_id := (to_jsonb(old)->>'account_id')::uuid;
    v_resource_id := (to_jsonb(old)->>'id')::uuid;
  else
    v_account_id := coalesce(
      (to_jsonb(new)->>'account_id')::uuid,
      (to_jsonb(old)->>'account_id')::uuid
    );
    v_resource_id := coalesce(
      (to_jsonb(new)->>'id')::uuid,
      (to_jsonb(old)->>'id')::uuid
    );
  end if;

  insert into public.admin_access_audit(admin_user_id, target_account_id, action, resource, resource_id, meta)
  values (
    auth.uid(),
    v_account_id,
    tg_op,
    tg_table_name,
    v_resource_id,
    jsonb_build_object('source', 'db_trigger')
  );

  return coalesce(new, old);
end;
$$;
