import { describe, expect, it, beforeEach } from 'vitest';
import { clearAuthParamsFromUrl, getUrlAuthErrorMessage, readAuthUrlPayload } from './auth-callback';

describe('auth-callback utils', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/auth/account-security');
  });

  it('reads payload from query and hash parameters', () => {
    window.history.replaceState(
      {},
      '',
      '/auth/account-security?type=recovery&code=abc123#error=access_denied&error_code=403'
    );

    const payload = readAuthUrlPayload();

    expect(payload.type).toBe('recovery');
    expect(payload.code).toBe('abc123');
    expect(payload.urlError).toBe('access_denied');
    expect(payload.urlErrorCode).toBe('403');
  });

  it('clears callback params from URL', () => {
    window.history.replaceState({}, '', '/auth/account-security?code=abc#type=recovery');

    clearAuthParamsFromUrl();

    expect(window.location.pathname).toBe('/auth/account-security');
    expect(window.location.search).toBe('');
    expect(window.location.hash).toBe('');
  });

  it('joins url errors into one message', () => {
    const message = getUrlAuthErrorMessage({
      type: null,
      code: null,
      tokenHash: null,
      token: null,
      accessToken: null,
      refreshToken: null,
      urlError: 'access_denied',
      urlErrorCode: '403',
      urlErrorDescription: 'Link abgelaufen',
    });

    expect(message).toBe('Link abgelaufen | access_denied | 403');
  });
});
