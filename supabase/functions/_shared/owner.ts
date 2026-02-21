import { json, normalizeEmail } from './utils.ts';

type ProfileRow = {
  global_role?: string | null;
  email?: string | null;
};

const getOwnerEmail = (): string | null => {
  const raw = Deno.env.get('PLATFORM_OWNER_EMAIL')?.trim();
  if (!raw) return null;
  return normalizeEmail(raw);
};

export const requirePlatformOwner = async (
  adminClient: { from: (table: string) => any },
  callerId: string
): Promise<Response | null> => {
  const ownerEmail = getOwnerEmail();
  if (!ownerEmail) {
    return json(500, { ok: false, code: 'MISSING_PLATFORM_OWNER_EMAIL' });
  }

  const { data: profile, error } = await adminClient
    .from('profiles')
    .select('global_role, email')
    .eq('id', callerId)
    .maybeSingle();

  if (error || !profile) {
    return json(403, { ok: false, code: 'FORBIDDEN' });
  }

  const callerProfile = profile as ProfileRow;
  const callerEmail = callerProfile.email ? normalizeEmail(callerProfile.email) : '';
  if (callerProfile.global_role !== 'ADMIN' || callerEmail !== ownerEmail) {
    return json(403, { ok: false, code: 'FORBIDDEN' });
  }

  return null;
};
