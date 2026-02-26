import React from 'react';
import { act, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AppRouter from './AppRouter';
import { FullPageLoadingScreen, LoadingProvider, useLoading } from '../../shared/loading';

const mockUseAuth = vi.fn();
const mockPushToast = vi.fn();

vi.mock('../../shared/auth/AuthContext', () => ({
  useAuth: () => mockUseAuth()
}));

vi.mock('../../shared/components/ToastProvider', () => ({
  useToast: () => ({ pushToast: mockPushToast })
}));

const LoadingDebugState: React.FC = () => {
  const { activeCount } = useLoading();
  return <output data-testid="loading-active-count">{activeCount}</output>;
};

interface RouterHostProps {
  showRouter: boolean;
}

const RouterHost: React.FC<RouterHostProps> = ({ showRouter }) => (
  <LoadingProvider>
    <LoadingDebugState />
    <FullPageLoadingScreen />
    {showRouter ? (
      <MemoryRouter>
        <AppRouter />
      </MemoryRouter>
    ) : null}
  </LoadingProvider>
);

describe('AppRouter loading integration', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockPushToast.mockReset();
    mockUseAuth.mockReturnValue({
      user: null,
      activeAccountId: null,
      activeAccount: null,
      canManageTenantUsers: false,
      loading: true,
      login: vi.fn(),
      logout: vi.fn(),
      isAuthenticated: false
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('uses shared loading manager and cleans up on router unmount', () => {
    const { rerender } = render(<RouterHost showRouter />);

    expect(screen.queryByText('Lade Ansicht ...')).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(150);
    });

    expect(screen.getByTestId('full-page-loading-screen')).toBeInTheDocument();
    expect(screen.getByTestId('loading-active-count')).toHaveTextContent('1');

    rerender(<RouterHost showRouter={false} />);

    expect(screen.getByTestId('loading-active-count')).toHaveTextContent('0');
    expect(screen.queryByTestId('full-page-loading-screen')).not.toBeInTheDocument();
  });
});
