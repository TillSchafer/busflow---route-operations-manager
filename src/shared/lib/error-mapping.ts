import { isFunctionAuthError } from './supabaseFunctions';

export const toActionErrorMessage = (error: unknown, fallback: string): string => {
  if (isFunctionAuthError(error)) return 'Sitzung ungültig/abgelaufen. Bitte neu anmelden.';
  return error instanceof Error ? error.message : fallback;
};

export const getActionErrorCode = (error: unknown): string | null => {
  if (!error || typeof error !== 'object') return null;
  if (!('code' in error)) return null;
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' && code ? code : null;
};

export const getErrorCode = (error: unknown): string | undefined =>
  error && typeof error === 'object' && 'code' in error
    ? String((error as { code?: unknown }).code ?? '')
    : undefined;

export const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : '';
