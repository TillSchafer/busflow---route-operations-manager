import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { corsHeaders, json, extractBearerToken, isUuid } from '../_shared/utils.ts';
import { requirePlatformOwner } from '../_shared/owner.ts';

type PlatformAccountStatus = 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED';

type UpdateAccountRequest = {
  accountId?: string;
  name?: string;
  slug?: string;
  status?: PlatformAccountStatus;
  reason?: string;
};

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');

const getString = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return json(405, { ok: false, code: 'METHOD_NOT_ALLOWED' });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');

  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    return json(500, { ok: false, code: 'MISSING_SUPABASE_ENV' });
  }

  const accessToken = extractBearerToken(req.headers.get('Authorization'));
  if (!accessToken) {
    return json(401, { ok: false, code: 'UNAUTHORIZED' });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  const callerClient = createClient(supabaseUrl, anonKey);

  const {
    data: { user: caller },
    error: callerError,
  } = await callerClient.auth.getUser(accessToken);

  if (callerError || !caller) {
    return json(401, { ok: false, code: 'UNAUTHORIZED' });
  }

  const ownerGuardResponse = await requirePlatformOwner(adminClient, caller.id);
  if (ownerGuardResponse) {
    return ownerGuardResponse;
  }

  let body: UpdateAccountRequest;
  try {
    body = await req.json();
  } catch {
    return json(400, { ok: false, code: 'INVALID_JSON' });
  }

  const accountId = getString(body.accountId);
  const rawName = getString(body.name);
  const rawSlug = getString(body.slug);
  const reason = getString(body.reason) || null;
  const status = body.status;

  if (!isUuid(accountId)) {
    return json(400, { ok: false, code: 'INVALID_ACCOUNT_ID' });
  }

  if (!rawName && !rawSlug && !status) {
    return json(400, { ok: false, code: 'NOTHING_TO_UPDATE' });
  }

  if (status && !['ACTIVE', 'SUSPENDED', 'ARCHIVED'].includes(status)) {
    return json(400, { ok: false, code: 'INVALID_STATUS' });
  }

  const { data: existingAccount, error: existingAccountError } = await adminClient
    .from('platform_accounts')
    .select('id, name, slug, status, created_at, updated_at, archived_at, archived_by')
    .eq('id', accountId)
    .maybeSingle();

  if (existingAccountError) {
    return json(500, { ok: false, code: 'ACCOUNT_LOOKUP_FAILED', message: existingAccountError.message });
  }
  if (!existingAccount) {
    return json(404, { ok: false, code: 'ACCOUNT_NOT_FOUND' });
  }

  const payload: Record<string, unknown> = {};

  if (rawName) {
    payload.name = rawName;
  }
  if (rawSlug) {
    const normalizedSlug = slugify(rawSlug);
    if (!normalizedSlug) {
      return json(400, { ok: false, code: 'INVALID_SLUG' });
    }
    payload.slug = normalizedSlug;
  }
  if (status) {
    payload.status = status;
    if (status === 'ARCHIVED') {
      payload.archived_at = new Date().toISOString();
      payload.archived_by = caller.id;
    } else {
      payload.archived_at = null;
      payload.archived_by = null;
    }
  }

  if (Object.keys(payload).length === 0) {
    return json(400, { ok: false, code: 'NOTHING_TO_UPDATE' });
  }

  const { data: updatedAccount, error: updateError } = await adminClient
    .from('platform_accounts')
    .update(payload)
    .eq('id', accountId)
    .select('id, name, slug, status, created_at, updated_at, archived_at, archived_by')
    .single();

  if (updateError) {
    if (updateError.code === '23505') {
      return json(409, { ok: false, code: 'ACCOUNT_SLUG_EXISTS' });
    }
    return json(500, { ok: false, code: 'ACCOUNT_UPDATE_FAILED', message: updateError.message });
  }

  const { error: auditInsertError } = await adminClient
    .from('admin_access_audit')
    .insert({
      admin_user_id: caller.id,
      target_account_id: accountId,
      action: 'ACCOUNT_UPDATED',
      resource: 'platform_accounts',
      resource_id: accountId,
      meta: {
        reason,
        changed_name: Object.prototype.hasOwnProperty.call(payload, 'name'),
        changed_slug: Object.prototype.hasOwnProperty.call(payload, 'slug'),
        changed_status: Object.prototype.hasOwnProperty.call(payload, 'status'),
        status: status || null,
      },
    });

  return json(200, {
    ok: true,
    account: updatedAccount,
    auditError: auditInsertError?.message || null,
  });
});
