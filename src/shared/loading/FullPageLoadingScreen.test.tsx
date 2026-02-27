import React from 'react';
import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import FullPageLoadingScreen from './FullPageLoadingScreen';
import { LoadingProvider, useLoading, type LoadingContextValue } from './LoadingProvider';

const Harness = React.forwardRef<LoadingContextValue, Record<string, never>>((_, ref) => {
  const loading = useLoading();
  React.useImperativeHandle(ref, () => loading, [loading]);
  return <FullPageLoadingScreen />;
});
Harness.displayName = 'Harness';

const renderScreen = () => {
  const loadingRef = React.createRef<LoadingContextValue>();
  render(
    <LoadingProvider>
      <Harness ref={loadingRef} />
    </LoadingProvider>
  );
  expect(loadingRef.current).not.toBeNull();
  return loadingRef;
};

describe('FullPageLoadingScreen', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders fallback message when no custom message is provided', () => {
    const loadingRef = renderScreen();

    act(() => {
      loadingRef.current!.start();
      vi.advanceTimersByTime(150);
    });

    expect(screen.getByTestId('full-page-loading-screen')).toBeInTheDocument();
    expect(screen.getByText('Lade...')).toBeInTheDocument();
    expect(screen.queryByText('Bitte einen Moment...')).not.toBeInTheDocument();
    expect(screen.getByTestId('loading-spinner-loader15')).toBeInTheDocument();
  });

  it('shows determinate percentage only when progress data exists', () => {
    const loadingRef = renderScreen();

    let firstToken = '';
    act(() => {
      firstToken = loadingRef.current!.start({ progress: { current: 3, total: 5 } });
      vi.advanceTimersByTime(150);
    });

    expect(screen.getByText('60%')).toBeInTheDocument();

    let secondToken = '';
    act(() => {
      loadingRef.current!.stop(firstToken);
      secondToken = loadingRef.current!.start({ message: 'No progress' });
      vi.advanceTimersByTime(1);
    });

    expect(screen.queryByText('60%')).not.toBeInTheDocument();
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();

    act(() => {
      loadingRef.current!.stop(secondToken);
    });
  });

  it('renders blocking overlay with transparent backdrop variant for non-route scopes', () => {
    const loadingRef = renderScreen();

    let token = '';
    act(() => {
      token = loadingRef.current!.start({ message: 'Initial load', scope: 'action' });
      vi.advanceTimersByTime(150);
    });

    const overlay = screen.getByTestId('full-page-loading-screen');
    expect(overlay).toHaveClass('pointer-events-auto');
    expect(overlay).toHaveAttribute('aria-busy', 'true');

    const backdrop = screen.getByTestId('loading-backdrop');
    expect(backdrop).toHaveAttribute('data-backdrop-variant', 'transparent');

    const card = overlay.querySelector('[data-short-variant]');
    expect(card).toHaveAttribute('data-short-variant', 'true');

    act(() => {
      vi.advanceTimersByTime(900);
      loadingRef.current!.update(token, { message: 'Still loading' });
    });

    expect(card).toHaveAttribute('data-short-variant', 'false');
  });

  it('uses white backdrop variant for route scope', () => {
    const loadingRef = renderScreen();

    act(() => {
      loadingRef.current!.start({ scope: 'route', message: 'Route change' });
      vi.advanceTimersByTime(150);
    });

    expect(screen.getByTestId('loading-backdrop')).toHaveAttribute('data-backdrop-variant', 'white');
  });
});
