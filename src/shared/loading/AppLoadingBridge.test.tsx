import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import AppLoadingBridge from './AppLoadingBridge';
import { LoadingProvider, useLoading } from './LoadingProvider';

interface BridgeHarnessProps {
  authLoading: boolean;
  showBridge?: boolean;
  message?: string;
}

const LoadingProbe: React.FC = () => {
  const { activeCount, display } = useLoading();
  return <output data-testid="loading-probe">{activeCount}|{display.message}</output>;
};

const BridgeHarness: React.FC<BridgeHarnessProps> = ({ authLoading, showBridge = true, message }) => (
  <LoadingProvider>
    <LoadingProbe />
    {showBridge ? <AppLoadingBridge authLoading={authLoading} message={message} /> : null}
  </LoadingProvider>
);

describe('AppLoadingBridge', () => {
  it('starts and stops auth loading tokens on authLoading transitions', async () => {
    const { rerender } = render(<BridgeHarness authLoading />);

    await waitFor(() => {
      expect(screen.getByTestId('loading-probe')).toHaveTextContent('1|Lade...');
    });

    rerender(<BridgeHarness authLoading={false} />);

    await waitFor(() => {
      expect(screen.getByTestId('loading-probe')).toHaveTextContent('0|Lade...');
    });
  });

  it('cleans up active token when bridge unmounts', async () => {
    const { rerender } = render(<BridgeHarness authLoading />);

    await waitFor(() => {
      expect(screen.getByTestId('loading-probe')).toHaveTextContent('1|Lade...');
    });

    rerender(<BridgeHarness authLoading showBridge={false} />);

    await waitFor(() => {
      expect(screen.getByTestId('loading-probe')).toHaveTextContent('0|Lade...');
    });
  });

  it('preserves explicit auth message overrides', async () => {
    render(<BridgeHarness authLoading message="Authentifiziere..." />);

    await waitFor(() => {
      expect(screen.getByTestId('loading-probe')).toHaveTextContent('1|Authentifiziere...');
    });
  });
});
