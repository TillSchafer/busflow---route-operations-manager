import { describe, expect, it, vi, beforeEach } from 'vitest';

const { getSessionMock } = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
}));

vi.mock('./supabase', () => ({
  supabase: {
    auth: {
      getSession: getSessionMock,
      refreshSession: vi.fn(),
    },
    functions: {
      invoke: vi.fn(),
    },
  },
}));

import { invokeAuthedFunction } from './supabaseFunctions';

describe('invokeAuthedFunction', () => {
  beforeEach(() => {
    getSessionMock.mockReset();
  });

  it('throws AUTH_SESSION_MISSING when there is no access token', async () => {
    getSessionMock.mockResolvedValue({ data: { session: null }, error: null });

    await expect(invokeAuthedFunction('self-profile-security-v1', { action: 'PING' })).rejects.toMatchObject({
      code: 'AUTH_SESSION_MISSING',
    });
  });
});
