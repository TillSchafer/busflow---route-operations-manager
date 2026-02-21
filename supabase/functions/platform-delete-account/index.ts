import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type DeleteAccountRequest = {
  accountId?: string;
  dryRun?: boolean;
  confirmSlug?: string;
  reason?: string;
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const json = (status: number, payload: Record<string, unknown>) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });

const isUuid = (value?: string | null): value is string => !!value && UUID_REGEX.test(value);
const extractBearerToken = (authHeader: string | null) => {
  if (!authHeader) return null;
  const [scheme, token, ...rest] = authHeader.trim().split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token || rest.length > 0) return null;
  const normalized = token.trim();
  return normalized.length > 0 ? normalized : null;
};

const getTableCount = async (adminClient: ReturnType<typeof createClient>, table: string, accountId: string) => {
  const { count, error } = await adminClient
    .from(table)
    .select('id', { count: 'exact', head: true })
    .eq('account_id', accountId);

  if (error) throw error;
  return count || 0;
};

const cleanupUserReferences = async (adminClient: ReturnType<typeof createClient>, userId: string, userEmail?: string | null) => {
  await adminClient.from('platform_accounts').update({ created_by: null }).eq('created_by', userId);
  await adminClient.from('platform_accounts').update({ archived_by: null }).eq('archived_by', userId);
  await adminClient.from('account_invitations').update({ invited_by: null }).eq('invited_by', userId);

  if (userEmail) {
    await adminClient
      .from('account_invitations')
      .update({ status: 'REVOKED' })
      .eq('status', 'PENDING')
      .ilike('email', userEmail);
  }
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

  const { data: callerProfile, error: callerProfileError } = await adminClient
    .from('profiles')
    .select('global_role')
    .eq('id', caller.id)
    .maybeSingle();

  if (callerProfileError || callerProfile?.global_role !== 'ADMIN') {
    return json(403, { ok: false, code: 'FORBIDDEN' });
  }

  let body: DeleteAccountRequest;
  try {
    body = await req.json();
  } catch {
    return json(400, { ok: false, code: 'INVALID_JSON' });
  }

  const accountId = body.accountId?.trim();
  const confirmSlug = body.confirmSlug?.trim() || '';
  const reason = body.reason?.trim() || null;
  const dryRun = !!body.dryRun;

  if (!isUuid(accountId)) {
    return json(400, { ok: false, code: 'INVALID_INPUT', message: 'Valid accountId is required.' });
  }

  const { data: account, error: accountError } = await adminClient
    .from('platform_accounts')
    .select('id, name, slug')
    .eq('id', accountId)
    .maybeSingle();

  if (accountError || !account) {
    return json(404, { ok: false, code: 'ACCOUNT_NOT_FOUND' });
  }

  try {
    const [
      routesCount,
      stopsCount,
      customersCount,
      contactsCount,
      workersCount,
      busTypesCount,
      appSettingsCount,
      membershipsCount,
      invitationsCount,
      membershipsDataRes,
    ] = await Promise.all([
      getTableCount(adminClient, 'busflow_routes', accountId),
      getTableCount(adminClient, 'busflow_stops', accountId),
      getTableCount(adminClient, 'busflow_customers', accountId),
      getTableCount(adminClient, 'busflow_customer_contacts', accountId),
      getTableCount(adminClient, 'busflow_workers', accountId),
      getTableCount(adminClient, 'busflow_bus_types', accountId),
      getTableCount(adminClient, 'busflow_app_settings', accountId),
      getTableCount(adminClient, 'account_memberships', accountId),
      getTableCount(adminClient, 'account_invitations', accountId),
      adminClient
        .from('account_memberships')
        .select('user_id, role, status')
        .eq('account_id', accountId),
    ]);

    if (membershipsDataRes.error) {
      return json(500, { ok: false, code: 'DELETE_FAILED', message: membershipsDataRes.error.message });
    }

    const affectedUsers = new Set((membershipsDataRes.data || []).map(item => item.user_id));
    const dryRunPayload = {
      routes: routesCount,
      stops: stopsCount,
      customers: customersCount,
      contacts: contactsCount,
      workers: workersCount,
      busTypes: busTypesCount,
      appSettings: appSettingsCount,
      memberships: membershipsCount,
      invitations: invitationsCount,
      users: affectedUsers.size,
    };

    if (dryRun) {
      return json(200, {
        ok: true,
        dryRun: true,
        account: {
          id: account.id,
          name: account.name,
          slug: account.slug,
        },
        counts: dryRunPayload,
      });
    }

    if (!confirmSlug || confirmSlug !== account.slug) {
      return json(409, { ok: false, code: 'CONFIRM_SLUG_MISMATCH' });
    }

    await adminClient.from('busflow_stops').delete().eq('account_id', accountId);
    await adminClient.from('busflow_routes').delete().eq('account_id', accountId);
    await adminClient.from('busflow_customer_contacts').delete().eq('account_id', accountId);
    await adminClient.from('busflow_customers').delete().eq('account_id', accountId);
    await adminClient.from('busflow_workers').delete().eq('account_id', accountId);
    await adminClient.from('busflow_bus_types').delete().eq('account_id', accountId);
    await adminClient.from('busflow_app_settings').delete().eq('account_id', accountId);
    await adminClient.from('account_invitations').delete().eq('account_id', accountId);
    await adminClient.from('account_memberships').delete().eq('account_id', accountId);

    const { error: accountDeleteError } = await adminClient
      .from('platform_accounts')
      .delete()
      .eq('id', accountId);

    if (accountDeleteError) {
      return json(500, { ok: false, code: 'DELETE_FAILED', message: accountDeleteError.message });
    }

    const orphanDeleteErrors: string[] = [];
    let orphanUsersDeleted = 0;

    for (const userId of affectedUsers) {
      const { count: remainingMemberships, error: remainingMembershipsError } = await adminClient
        .from('account_memberships')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId);

      if (remainingMembershipsError) {
        orphanDeleteErrors.push(`${userId}: ${remainingMembershipsError.message}`);
        continue;
      }

      if ((remainingMemberships || 0) > 0) {
        continue;
      }

      const { data: profile } = await adminClient
        .from('profiles')
        .select('id, email, global_role')
        .eq('id', userId)
        .maybeSingle();

      if (!profile) {
        continue;
      }

      if (profile.global_role === 'ADMIN') {
        continue;
      }

      await cleanupUserReferences(adminClient, userId, profile.email || null);
      await adminClient.from('app_permissions').delete().eq('user_id', userId);

      const { error: deleteUserError } = await adminClient.auth.admin.deleteUser(userId);
      if (deleteUserError) {
        orphanDeleteErrors.push(`${userId}: ${deleteUserError.message}`);
        continue;
      }

      orphanUsersDeleted += 1;
    }

    await adminClient
      .from('admin_access_audit')
      .insert({
        admin_user_id: caller.id,
        target_account_id: accountId,
        action: 'ACCOUNT_HARD_DELETED',
        resource: 'platform_accounts',
        resource_id: accountId,
        meta: {
          reason,
          counts: dryRunPayload,
          orphan_users_deleted: orphanUsersDeleted,
          orphan_user_delete_errors: orphanDeleteErrors,
        },
      });

    return json(200, {
      ok: true,
      deletedAccountId: accountId,
      orphanUsersDeleted,
      orphanDeleteErrors,
      counts: dryRunPayload,
    });
  } catch (error) {
    return json(500, {
      ok: false,
      code: 'DELETE_FAILED',
      message: error instanceof Error ? error.message : 'Unexpected delete error.',
    });
  }
});
