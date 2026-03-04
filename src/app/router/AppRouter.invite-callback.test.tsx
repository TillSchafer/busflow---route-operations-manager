import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import AppRouter from './AppRouter';
import { LoadingProvider } from '../../shared/loading';

const mockUseAuth = vi.fn();
const mockPushToast = vi.fn();

vi.mock('../../shared/auth/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock('../../shared/components/ToastProvider', () => ({
  useToast: () => ({ pushToast: mockPushToast }),
}));

vi.mock('../../shared/lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: vi.fn(),
      resetPasswordForEmail: vi.fn(),
    },
    from: vi.fn(),
  },
}));

vi.mock('../../shared/components/auth/AuthShaderBackground', () => ({
  default: () => null,
}));

vi.mock('./AuthCallbackNormalizer', () => ({
  default: () => <div data-testid="auth-callback-normalizer" />,
}));

vi.mock('../../features/home/pages/HomePage', () => ({
  default: () => <div data-testid="home-page">HOME</div>,
}));

vi.mock('../../features/auth/pages/AcceptInvitePage', () => ({
  default: () => <div data-testid="accept-invite-page">ACCEPT_INVITE</div>,
}));

const authenticatedPendingState = {
  user: {
    id: 'user-1',
    email: 'pending@example.com',
    role: 'VIEWER',
    isPlatformAdmin: false,
    isPlatformOwner: false,
  },
  activeAccountId: null,
  activeAccount: null,
  canManageTenantUsers: false,
  loading: false,
  logout: vi.fn(),
};

const renderRouter = (initialPath = '/') =>
  render(
    <LoadingProvider>
      <MemoryRouter initialEntries={[initialPath]}>
        <AppRouter />
      </MemoryRouter>
    </LoadingProvider>,
  );

describe('AppRouter invite callback handling for pending users', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue(authenticatedPendingState);
  });

  it('redirects pending users directly to /auth/accept-invite', async () => {
    renderRouter('/');

    expect(await screen.findByTestId('accept-invite-page')).toBeInTheDocument();
    expect(screen.queryByText('Konto-Zugang ausstehend')).not.toBeInTheDocument();
    expect(screen.getByTestId('auth-callback-normalizer')).toBeInTheDocument();
  });

  it('does not render pending-access blocker when callback params are present', async () => {
    renderRouter('/?type=signup&token_hash=abc123');

    expect(screen.queryByText('Konto-Zugang ausstehend')).not.toBeInTheDocument();
    expect(await screen.findByTestId('home-page')).toBeInTheDocument();
    expect(screen.getByTestId('auth-callback-normalizer')).toBeInTheDocument();
  });
});
