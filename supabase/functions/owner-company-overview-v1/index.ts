import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { corsHeaders, json, extractBearerToken } from '../_shared/utils.ts';
import { requirePlatformOwner } from '../_shared/owner.ts';

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

  const { data: accounts, error: accountsError } = await adminClient
    .from('platform_accounts')
    .select('id, name, slug, status, trial_started_at, trial_ends_at, trial_state, created_at, updated_at, archived_at, archived_by')
    .order('created_at', { ascending: false });

  if (accountsError) {
    return json(500, { ok: false, code: 'ACCOUNTS_LOOKUP_FAILED', message: accountsError.message });
  }

  let companies: Array<Record<string, unknown>> = [];
  try {
    companies = await Promise.all(
      (accounts || []).map(async (account) => {
        const { data: members, error: membersError } = await adminClient
          .from('account_memberships')
          .select(`
            id,
            account_id,
            user_id,
            role,
            status,
            created_at,
            profiles(id, email, full_name)
          `)
          .eq('account_id', account.id)
          .order('created_at', { ascending: false });

        if (membersError) {
          throw new Error(`Member lookup failed for ${account.id}: ${membersError.message}`);
        }

        return {
          ...account,
          members: members || [],
        };
      })
    );
  } catch (error) {
    return json(500, {
      ok: false,
      code: 'MEMBERS_LOOKUP_FAILED',
      message: error instanceof Error ? error.message : 'Unexpected owner overview error.',
    });
  }

  return json(200, {
    ok: true,
    companies,
  });
});
