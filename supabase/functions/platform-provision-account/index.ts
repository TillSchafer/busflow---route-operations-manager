import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type ProvisionRequest = {
  accountName?: string;
  accountSlug?: string;
  adminEmail?: string;
};

const json = (status: number, payload: Record<string, unknown>) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });

const normalizeEmail = (value: string) => value.trim().toLowerCase();
const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
const extractBearerToken = (authHeader: string | null) => {
  if (!authHeader) return null;
  const [scheme, token, ...rest] = authHeader.trim().split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token || rest.length > 0) return null;
  const normalized = token.trim();
  return normalized.length > 0 ? normalized : null;
};

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
  const inviteRedirect = Deno.env.get('APP_INVITE_REDIRECT_URL')?.trim();

  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    return json(500, { ok: false, code: 'MISSING_SUPABASE_ENV' });
  }

  if (!inviteRedirect) {
    return json(500, {
      ok: false,
      code: 'MISSING_INVITE_REDIRECT_URL',
      message: 'APP_INVITE_REDIRECT_URL is required and must point to /auth/accept-invite.',
    });
  }

  try {
    const parsed = new URL(inviteRedirect);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return json(500, { ok: false, code: 'INVALID_INVITE_REDIRECT_URL' });
    }
  } catch {
    return json(500, { ok: false, code: 'INVALID_INVITE_REDIRECT_URL' });
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

  const { data: callerProfile, error: callerProfileError } = await adminClient
    .from('profiles')
    .select('global_role')
    .eq('id', caller.id)
    .single();

  if (callerProfileError || callerProfile?.global_role !== 'ADMIN') {
    return json(403, { ok: false, code: 'FORBIDDEN' });
  }

  let body: ProvisionRequest;
  try {
    body = await req.json();
  } catch {
    return json(400, { ok: false, code: 'INVALID_JSON' });
  }

  const accountName = body.accountName?.trim() || '';
  const accountSlug = slugify(body.accountSlug?.trim() || accountName);
  const adminEmail = body.adminEmail ? normalizeEmail(body.adminEmail) : '';

  if (!accountName || !accountSlug || !adminEmail) {
    return json(400, { ok: false, code: 'INVALID_INPUT', message: 'accountName, accountSlug, adminEmail are required.' });
  }
  if (!isValidEmail(adminEmail) || adminEmail.length > 254) {
    return json(400, { ok: false, code: 'INVALID_EMAIL' });
  }

  const { data: account, error: accountError } = await adminClient
    .from('platform_accounts')
    .insert({
      name: accountName,
      slug: accountSlug,
      status: 'ACTIVE',
      created_by: caller.id,
    })
    .select('id, name, slug')
    .single();

  if (accountError || !account) {
    if (accountError?.code === '23505') {
      return json(409, { ok: false, code: 'ACCOUNT_SLUG_EXISTS' });
    }
    return json(500, { ok: false, code: 'ACCOUNT_CREATE_FAILED', message: accountError?.message });
  }

  const { data: pendingInvitation } = await adminClient
    .from('account_invitations')
    .select('id')
    .eq('account_id', account.id)
    .eq('status', 'PENDING')
    .ilike('email', adminEmail)
    .maybeSingle();

  if (pendingInvitation?.id) {
    return json(409, {
      ok: false,
      code: 'INVITE_ALREADY_PENDING',
      accountId: account.id,
      accountName: account.name,
    });
  }

  const { data: invitation, error: invitationError } = await adminClient
    .from('account_invitations')
    .insert({
      account_id: account.id,
      email: adminEmail,
      role: 'ADMIN',
      status: 'PENDING',
      invited_by: caller.id,
      meta: {
        source: 'platform-provision-account',
      },
    })
    .select('id')
    .single();

  if (invitationError || !invitation) {
    return json(500, { ok: false, code: 'INVITE_CREATE_FAILED', message: invitationError?.message });
  }

  const { error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(adminEmail, {
    data: {
      invited_account_id: account.id,
      invited_role: 'ADMIN',
    },
    redirectTo: inviteRedirect,
  });

  await adminClient
    .from('admin_access_audit')
    .insert({
      admin_user_id: caller.id,
      target_account_id: account.id,
      action: 'ACCOUNT_PROVISIONED',
      resource: 'platform_accounts',
      resource_id: account.id,
      meta: {
        account_name: account.name,
        admin_email: adminEmail,
        invitation_id: invitation.id,
        invite_email_error: inviteError?.message || null,
      },
    });

  if (inviteError) {
    return json(202, {
      ok: true,
      code: 'ACCOUNT_CREATED_EMAIL_FAILED',
      message: inviteError.message,
      accountId: account.id,
      accountName: account.name,
      invitationId: invitation.id,
    });
  }

  return json(200, {
    ok: true,
    accountId: account.id,
    accountName: account.name,
    invitationId: invitation.id,
  });
});
