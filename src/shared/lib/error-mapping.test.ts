import { describe, expect, it } from 'vitest';
import { FunctionAuthError } from './supabaseFunctions';
import { getActionErrorCode, getErrorCode, toActionErrorMessage } from './error-mapping';

describe('error-mapping', () => {
  it('maps function auth errors to relogin message', () => {
    const message = toActionErrorMessage(new FunctionAuthError('AUTH_SESSION_INVALID'), 'fallback');
    expect(message).toBe('Sitzung ungültig/abgelaufen. Bitte neu anmelden.');
  });

  it('extracts known code values', () => {
    const error = { code: 'FORBIDDEN' };
    expect(getActionErrorCode(error)).toBe('FORBIDDEN');
    expect(getErrorCode(error)).toBe('FORBIDDEN');
  });
});
