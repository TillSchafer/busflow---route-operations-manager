import { supabase } from './supabase';

export type FunctionAuthErrorCode = 'AUTH_SESSION_MISSING' | 'AUTH_SESSION_INVALID';

const SESSION_INVALID_MESSAGE = 'Sitzung ungültig/abgelaufen. Bitte neu anmelden.';
const FUNCTION_INVOKE_FAILED_MESSAGE = 'Function-Aufruf fehlgeschlagen.';

export class FunctionAuthError extends Error {
  code: FunctionAuthErrorCode;

  constructor(code: FunctionAuthErrorCode, message = SESSION_INVALID_MESSAGE) {
    super(message);
    this.name = 'FunctionAuthError';
    this.code = code;
  }
}

export const isFunctionAuthError = (error: unknown): error is FunctionAuthError =>
  error instanceof FunctionAuthError;

const decodeJwtPayload = (accessToken: string): { iss?: string; exp?: number; aud?: string } => {
  try {
    const payloadPart = accessToken.split('.')[1];
    if (!payloadPart) return {};
    const json = atob(payloadPart.replace(/-/g, '+').replace(/_/g, '/'));
    const payload = JSON.parse(json) as { iss?: string; exp?: number; aud?: string };
    return {
      iss: payload.iss,
      exp: payload.exp,
      aud: payload.aud,
    };
  } catch {
    return {};
  }
};

const getValidAccessTokenOrThrow = async () => {
  const { data, error } = await supabase.auth.getSession();

  if (error) {
    throw new FunctionAuthError('AUTH_SESSION_INVALID');
  }

  const token = data.session?.access_token?.trim();
  if (!token) {
    throw new FunctionAuthError('AUTH_SESSION_MISSING');
  }

  return token;
};

const isInvalidJwtResponse = (status: number, body: unknown, error?: unknown) => {
  if (status !== 401) return false;

  if (body && typeof body === 'object') {
    const payload = body as { code?: unknown; message?: unknown };
    const code = String(payload.code ?? '').toLowerCase();
    const message = String(payload.message ?? '').toLowerCase();
    if (code === '401' || message.includes('invalid jwt')) return true;
  }

  if (typeof body === 'string' && body.toLowerCase().includes('invalid jwt')) {
    return true;
  }

  if (error instanceof Error && error.message.toLowerCase().includes('invalid jwt')) {
    return true;
  }

  return false;
};

const parseResponseBody = async (response?: Response | null) => {
  if (!response) return null;
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
};

const logInvokeFailure = (
  functionName: string,
  status: number,
  body: unknown,
  requestId: string | null,
  tokenMeta: { iss?: string; exp?: number; aud?: string }
) => {
  console.error('[supabase:functions] invoke failed', {
    functionName,
    status,
    requestId,
    tokenMeta,
    body,
  });
};

export async function invokeAuthedFunction<TReq, TRes>(
  functionName: string,
  body: TReq,
  options?: { retryOnJwtError?: boolean }
): Promise<TRes> {
  const retryOnJwtError = options?.retryOnJwtError ?? true;

  const invokeWithToken = async (accessToken: string) => {
    const { data, error, response } = await supabase.functions.invoke(functionName, { body });
    const parsedBody = error ? await parseResponseBody(response?.clone()) : data;
    const requestId = response?.headers.get('sb-request-id') ?? null;
    const tokenMeta = decodeJwtPayload(accessToken);
    const status = response?.status ?? (error ? 500 : 200);

    if (error) {
      logInvokeFailure(functionName, status, parsedBody, requestId, tokenMeta);
    }

    return {
      ok: !error,
      status,
      body: parsedBody,
      requestId,
      tokenMeta,
      error,
    };
  };

  let accessToken = await getValidAccessTokenOrThrow();
  let response = await invokeWithToken(accessToken);

  if (!response.ok && retryOnJwtError && isInvalidJwtResponse(response.status, response.body, response.error)) {
    const { error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError) {
      throw new FunctionAuthError('AUTH_SESSION_INVALID');
    }

    accessToken = await getValidAccessTokenOrThrow();
    response = await invokeWithToken(accessToken);
  }

  if (!response.ok) {
    if (isInvalidJwtResponse(response.status, response.body, response.error)) {
      throw new FunctionAuthError('AUTH_SESSION_INVALID');
    }

    if (response.body && typeof response.body === 'object') {
      const payload = response.body as { message?: unknown; error?: unknown };
      const message = typeof payload.message === 'string'
        ? payload.message
        : typeof payload.error === 'string'
          ? payload.error
          : FUNCTION_INVOKE_FAILED_MESSAGE;
      throw new Error(message);
    }

    if (typeof response.body === 'string' && response.body.trim()) {
      throw new Error(response.body);
    }

    throw new Error(FUNCTION_INVOKE_FAILED_MESSAGE);
  }

  return response.body as TRes;
}
