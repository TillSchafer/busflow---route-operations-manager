import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { corsHeaders, json, normalizeEmail, isValidEmail } from '../_shared/utils.ts';
import {
  deleteGhostUserIfSafe,
  getInvitationTargetState,
  resolveExistingPendingInvitationForEmail,
} from '../_shared/inviteAuth.ts';

type PublicRegisterTrialRequest = {
  fullName?: string;
  companyName?: string;
  email?: string;
  honeypot?: string;
  website?: string;
  company?: string;
};

type ResultPayload = {
  ok: boolean;
  code: string;
  message?: string;
  accountId?: string;
  accountSlug?: string;
  reusedPending?: boolean;
  existingInvitationId?: string;
};

const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const RATE_LIMIT_PER_IP = 5;
const RATE_LIMIT_PER_EMAIL = 3;
const MAX_NAME_LENGTH = 120;
const MAX_EMAIL_LENGTH = 254;
const MAX_COMPANY_LENGTH = 140;
const TRIAL_DAYS = 14;
const SELF_REGISTER_SOURCE = 'self_register_trial';

const SIGNUP_RESULT_CODES = {
  INVALID_INPUT: 'INVALID_INPUT',
  RATE_LIMITED: 'RATE_LIMITED',
  EMAIL_ALREADY_REGISTERED: 'EMAIL_ALREADY_REGISTERED',
  REGISTRATION_SEEDED: 'REGISTRATION_SEEDED',
  REGISTRATION_REUSED_PENDING: 'REGISTRATION_REUSED_PENDING',
  REGISTRATION_SEED_FAILED: 'REGISTRATION_SEED_FAILED',
  FEATURE_DISABLED: 'FEATURE_DISABLED',
} as const;

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');

const isSelfSignupEnabled = () => {
  const raw = Deno.env.get('SELF_SIGNUP_ENABLED')?.trim().toLowerCase();
  if (!raw) return true;
  return !['false', '0', 'off', 'no'].includes(raw);
};

const getIpAddress = (req: Request) => {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) {
    const first = xff.split(',')[0]?.trim();
    if (first) return first;
  }

  const cfIp = req.headers.get('cf-connecting-ip')?.trim();
  if (cfIp) return cfIp;

  const realIp = req.headers.get('x-real-ip')?.trim();
  if (realIp) return realIp;

  return 'unknown';
};

const toHex = (bytes: Uint8Array) =>
  Array.from(bytes)
    .map((item) => item.toString(16).padStart(2, '0'))
    .join('');

const hashWithSalt = async (value: string, salt: string) => {
  const data = new TextEncoder().encode(`${salt}:${value}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return toHex(new Uint8Array(digest));
};

const trimTo = (value: string | undefined, maxLength: number) => (value || '').trim().slice(0, maxLength);

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const createUniqueAccount = async (
  adminClient: ReturnType<typeof createClient>,
  name: string,
  trialStartedAt: string,
  trialEndsAt: string,
) => {
  const base = slugify(name);
  if (!base) {
    throw new Error('VALIDATION_SLUG_EMPTY');
  }

  const maxAttempts = 25;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const slug = attempt === 0 ? base : `${base}-${attempt + 1}`;

    const { data, error } = await adminClient
      .from('platform_accounts')
      .insert({
        name,
        slug,
        status: 'ACTIVE',
        created_by: null,
        trial_started_at: trialStartedAt,
        trial_ends_at: trialEndsAt,
        trial_state: 'TRIAL_ACTIVE',
      })
      .select('id, slug')
      .single();

    if (!error && data) {
      return data;
    }

    if (error?.code === '23505') {
      continue;
    }

    throw new Error(error?.message || 'ACCOUNT_CREATE_FAILED');
  }

  throw new Error('ACCOUNT_SLUG_COLLISION');
};

const acquireSignupLock = async (adminClient: ReturnType<typeof createClient>, email: string) => {
  const { error } = await adminClient.rpc('acquire_self_signup_lock', { p_email: email });
  if (!error) return;

  const msg = (error.message || '').toLowerCase();
  const missingFn = msg.includes('acquire_self_signup_lock') && (msg.includes('not found') || msg.includes('does not exist'));
  if (missingFn) {
    console.warn('acquire_self_signup_lock missing; continuing without advisory lock');
    return;
  }

  throw new Error(`signup lock failed: ${error.message}`);
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
  const ipHashSalt = Deno.env.get('SELF_SIGNUP_IP_HASH_SALT')?.trim();

  if (!supabaseUrl || !serviceRoleKey) {
    return json(500, { ok: false, code: 'MISSING_SUPABASE_ENV' });
  }

  if (!isSelfSignupEnabled()) {
    return json(403, {
      ok: false,
      code: SIGNUP_RESULT_CODES.FEATURE_DISABLED,
      message: 'Selbstregistrierung ist derzeit deaktiviert.',
    });
  }

  if (!ipHashSalt) {
    return json(500, { ok: false, code: 'MISSING_SELF_SIGNUP_IP_HASH_SALT' });
  }

  let body: PublicRegisterTrialRequest;
  try {
    body = await req.json();
  } catch {
    return json(400, { ok: false, code: SIGNUP_RESULT_CODES.INVALID_INPUT, message: 'Ungültiges JSON.' });
  }

  const fullName = trimTo(body.fullName, MAX_NAME_LENGTH);
  const companyName = trimTo(body.companyName, MAX_COMPANY_LENGTH);
  const rawEmail = trimTo(body.email, MAX_EMAIL_LENGTH);
  const email = rawEmail ? normalizeEmail(rawEmail) : '';
  const honeypot = trimTo(body.honeypot || body.website || body.company, 200);
  const userAgent = trimTo(req.headers.get('user-agent') || '', 400);

  const ipAddress = getIpAddress(req);
  const ipHash = await hashWithSalt(ipAddress, ipHashSalt);

  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  const logAttempt = async (resultCode: string, emailNorm?: string | null) => {
    const { error } = await adminClient
      .from('self_signup_attempts')
      .insert({
        email_norm: emailNorm || null,
        ip_hash: ipHash,
        user_agent: userAgent || null,
        result_code: resultCode,
      });

    if (error) {
      console.error('self_signup_attempts insert failed', { resultCode, message: error.message });
    }
  };

  const respond = async (status: number, payload: ResultPayload, emailNorm?: string | null) => {
    await logAttempt(payload.code, emailNorm ?? null);
    return json(status, payload as Record<string, unknown>);
  };

  if (honeypot.length > 0) {
    return respond(200, {
      ok: true,
      code: SIGNUP_RESULT_CODES.REGISTRATION_SEEDED,
      message: 'Bitte E-Mail bestätigen, um die Registrierung abzuschließen.',
    }, email || null);
  }

  if (!fullName || fullName.length < 2 || !companyName || companyName.length < 2 || !email || !isValidEmail(email)) {
    return respond(400, {
      ok: false,
      code: SIGNUP_RESULT_CODES.INVALID_INPUT,
      message: 'Name, Firmenname und eine gültige E-Mail sind erforderlich.',
    }, email || null);
  }

  const windowStartIso = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();
  const [ipRateRes, emailRateRes] = await Promise.all([
    adminClient
      .from('self_signup_attempts')
      .select('id', { head: true, count: 'exact' })
      .eq('ip_hash', ipHash)
      .gte('created_at', windowStartIso),
    adminClient
      .from('self_signup_attempts')
      .select('id', { head: true, count: 'exact' })
      .eq('email_norm', email)
      .gte('created_at', windowStartIso),
  ]);

  if (ipRateRes.error || emailRateRes.error) {
    return respond(500, {
      ok: false,
      code: SIGNUP_RESULT_CODES.REGISTRATION_SEED_FAILED,
      message: ipRateRes.error?.message || emailRateRes.error?.message || 'Rate limit check failed.',
    }, email);
  }

  const ipAttempts = ipRateRes.count || 0;
  const emailAttempts = emailRateRes.count || 0;
  if (ipAttempts >= RATE_LIMIT_PER_IP || emailAttempts >= RATE_LIMIT_PER_EMAIL) {
    return respond(429, {
      ok: false,
      code: SIGNUP_RESULT_CODES.RATE_LIMITED,
      message: 'Zu viele Registrierungsversuche. Bitte später erneut versuchen.',
    }, email);
  }

  try {
    await acquireSignupLock(adminClient, email);
  } catch (error) {
    return respond(500, {
      ok: false,
      code: SIGNUP_RESULT_CODES.REGISTRATION_SEED_FAILED,
      message: error instanceof Error ? error.message : 'Signup lock failed.',
    }, email);
  }

  let targetState;
  try {
    targetState = await getInvitationTargetState(adminClient, email);
  } catch (error) {
    return respond(500, {
      ok: false,
      code: SIGNUP_RESULT_CODES.REGISTRATION_SEED_FAILED,
      message: error instanceof Error ? error.message : 'Failed to resolve account state.',
    }, email);
  }

  if (targetState.activeMembershipCount > 0) {
    return respond(409, {
      ok: false,
      code: SIGNUP_RESULT_CODES.EMAIL_ALREADY_REGISTERED,
      message: 'Diese E-Mail hat bereits einen aktiven Zugang. Bitte anmelden oder Passwort zurücksetzen.',
    }, email);
  }

  if (targetState.isEmailConfirmed) {
    return respond(409, {
      ok: false,
      code: SIGNUP_RESULT_CODES.EMAIL_ALREADY_REGISTERED,
      message: 'Diese E-Mail ist bereits registriert. Bitte anmelden oder Passwort zurücksetzen.',
    }, email);
  }

  let deletedGhostUser = false;
  if (targetState.canDeleteGhostUser) {
    try {
      deletedGhostUser = await deleteGhostUserIfSafe(adminClient, targetState);
    } catch (error) {
      return respond(500, {
        ok: false,
        code: SIGNUP_RESULT_CODES.REGISTRATION_SEED_FAILED,
        message: error instanceof Error ? error.message : 'Ghost user cleanup failed.',
      }, email);
    }

    if (deletedGhostUser) {
      await sleep(200);
      targetState = await getInvitationTargetState(adminClient, email);
    }
  }

  if (targetState.authUserId || targetState.profileId) {
    return respond(409, {
      ok: false,
      code: SIGNUP_RESULT_CODES.EMAIL_ALREADY_REGISTERED,
      message: 'Diese E-Mail ist bereits registriert. Bitte anmelden oder Passwort zurücksetzen.',
    }, email);
  }

  let pendingInvitations;
  try {
    pendingInvitations = await resolveExistingPendingInvitationForEmail(adminClient, email);
  } catch (error) {
    return respond(500, {
      ok: false,
      code: SIGNUP_RESULT_CODES.REGISTRATION_SEED_FAILED,
      message: error instanceof Error ? error.message : 'Pending invitation lookup failed.',
    }, email);
  }

  const expiredPendingIds = pendingInvitations.filter((item) => item.isExpired).map((item) => item.id);
  if (expiredPendingIds.length > 0) {
    const { error } = await adminClient
      .from('account_invitations')
      .update({ status: 'EXPIRED' })
      .in('id', expiredPendingIds)
      .eq('status', 'PENDING');

    if (error) {
      return respond(500, {
        ok: false,
        code: SIGNUP_RESULT_CODES.REGISTRATION_SEED_FAILED,
        message: `Expired invitation cleanup failed: ${error.message}`,
      }, email);
    }
  }

  const freshPending = pendingInvitations.filter((item) => !item.isExpired);
  const conflictingPending = freshPending.find((item) => item.source !== SELF_REGISTER_SOURCE);
  if (conflictingPending) {
    return respond(409, {
      ok: false,
      code: SIGNUP_RESULT_CODES.EMAIL_ALREADY_REGISTERED,
      message: 'Für diese E-Mail existiert bereits eine offene Einladung. Bitte zuerst diese Einladung nutzen.',
      existingInvitationId: conflictingPending.id,
    }, email);
  }

  const reusablePending = freshPending.find((item) => item.source === SELF_REGISTER_SOURCE);
  if (reusablePending) {
    const { data: existingAccount, error } = await adminClient
      .from('platform_accounts')
      .select('id, slug')
      .eq('id', reusablePending.account_id)
      .maybeSingle();

    if (error || !existingAccount) {
      return respond(500, {
        ok: false,
        code: SIGNUP_RESULT_CODES.REGISTRATION_SEED_FAILED,
        message: error?.message || 'Existing account for pending registration not found.',
      }, email);
    }

    return respond(200, {
      ok: true,
      code: SIGNUP_RESULT_CODES.REGISTRATION_REUSED_PENDING,
      message: 'Es besteht bereits eine offene Registrierung. Ein neuer Bestätigungslink kann jetzt versendet werden.',
      accountId: existingAccount.id,
      accountSlug: existingAccount.slug,
      reusedPending: true,
      existingInvitationId: reusablePending.id,
    }, email);
  }

  const trialStartedAt = new Date().toISOString();
  const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString();

  let account: { id: string; slug: string };
  try {
    account = await createUniqueAccount(adminClient, companyName, trialStartedAt, trialEndsAt);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Account create failed.';
    const mappedMessage = message === 'VALIDATION_SLUG_EMPTY'
      ? 'Aus dem Firmennamen konnte kein gültiger Slug erzeugt werden.'
      : message;

    return respond(500, {
      ok: false,
      code: SIGNUP_RESULT_CODES.REGISTRATION_SEED_FAILED,
      message: mappedMessage,
    }, email);
  }

  const { data: invitation, error: invitationError } = await adminClient
    .from('account_invitations')
    .insert({
      account_id: account.id,
      email,
      role: 'ADMIN',
      status: 'PENDING',
      invited_by: null,
      meta: {
        source: SELF_REGISTER_SOURCE,
        requested_full_name: fullName,
        trial_started_at: trialStartedAt,
        trial_ends_at: trialEndsAt,
      },
    })
    .select('id')
    .single();

  if (invitationError || !invitation) {
    await adminClient.from('platform_accounts').delete().eq('id', account.id);

    return respond(500, {
      ok: false,
      code: SIGNUP_RESULT_CODES.REGISTRATION_SEED_FAILED,
      message: invitationError?.message || 'Invitation create failed.',
    }, email);
  }

  return respond(200, {
    ok: true,
    code: SIGNUP_RESULT_CODES.REGISTRATION_SEEDED,
    message: 'Registrierung vorbereitet. Bitte E-Mail bestätigen, um fortzufahren.',
    accountId: account.id,
    accountSlug: account.slug,
    reusedPending: false,
    existingInvitationId: invitation.id,
  }, email);
});
