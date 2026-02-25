export interface PublicRegisterTrialRequest {
  fullName: string;
  companyName: string;
  email: string;
  honeypot?: string;
}

export interface PublicRegisterTrialResult {
  ok: boolean;
  code?: string;
  message?: string;
  accountId?: string;
  accountSlug?: string;
  reusedPending?: boolean;
  existingInvitationId?: string;
}

export class PublicRegisterError extends Error {
  code?: string;
  status?: number;

  constructor(message: string, code?: string, status?: number) {
    super(message);
    this.name = 'PublicRegisterError';
    this.code = code;
    this.status = status;
  }
}

const FALLBACK_MESSAGE = 'Registrierung konnte nicht gestartet werden.';

const getSupabaseFunctionUrl = (functionName: string) => {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  if (!supabaseUrl) {
    throw new PublicRegisterError('VITE_SUPABASE_URL ist nicht gesetzt.');
  }

  return `${supabaseUrl.replace(/\/$/, '')}/functions/v1/${functionName}`;
};

export const PublicRegisterApi = {
  async seedTrialRegistration(payload: PublicRegisterTrialRequest): Promise<PublicRegisterTrialResult> {
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
    if (!anonKey) {
      throw new PublicRegisterError('VITE_SUPABASE_ANON_KEY ist nicht gesetzt.');
    }

    const response = await fetch(getSupabaseFunctionUrl('public-register-trial-v1'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
      },
      body: JSON.stringify(payload),
    });

    let body: PublicRegisterTrialResult | null = null;
    try {
      body = (await response.json()) as PublicRegisterTrialResult;
    } catch {
      body = null;
    }

    if (!response.ok) {
      throw new PublicRegisterError(
        body?.message || body?.code || FALLBACK_MESSAGE,
        body?.code,
        response.status,
      );
    }

    if (!body?.ok) {
      throw new PublicRegisterError(body?.message || body?.code || FALLBACK_MESSAGE, body?.code, response.status);
    }

    return body;
  },
};
