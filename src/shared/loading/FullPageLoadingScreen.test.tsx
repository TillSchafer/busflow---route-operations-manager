import React from 'react';
import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import FullPageLoadingScreen from './FullPageLoadingScreen';
import { LoadingProvider, useLoading, type LoadingContextValue } from './LoadingProvider';

let latestLoading: LoadingContextValue | null = null;

const Harness: React.FC = () => {
  latestLoading = useLoading();
  return <FullPageLoadingScreen />;
};

const renderScreen = () => {
  render(
    <LoadingProvider>
      <Harness />
    </LoadingProvider>
  );
  expect(latestLoading).not.toBeNull();
};

describe('FullPageLoadingScreen', () => {
  beforeEach(() => {
    latestLoading = null;
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders fallback message when no custom message is provided', () => {
    renderScreen();

    act(() => {
      latestLoading!.start();
      vi.advanceTimersByTime(150);
    });

    expect(screen.getByTestId('full-page-loading-screen')).toBeInTheDocument();
    expect(screen.getByText('Lade...')).toBeInTheDocument();
  });

  it('shows determinate percentage only when progress data exists', () => {
    renderScreen();

    let firstToken = '';
    act(() => {
      firstToken = latestLoading!.start({ progress: { current: 3, total: 5 } });
      vi.advanceTimersByTime(150);
    });

    expect(screen.getByText('60%')).toBeInTheDocument();

    let secondToken = '';
    act(() => {
      latestLoading!.stop(firstToken);
      secondToken = latestLoading!.start({ message: 'No progress' });
      vi.advanceTimersByTime(1);
    });

    expect(screen.queryByText('60%')).not.toBeInTheDocument();
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();

    act(() => {
      latestLoading!.stop(secondToken);
    });
  });

  it('renders blocking overlay with faint backdrop and short-variant state', () => {
    renderScreen();

    let token = '';
    act(() => {
      token = latestLoading!.start({ message: 'Initial load' });
      vi.advanceTimersByTime(150);
    });

    const overlay = screen.getByTestId('full-page-loading-screen');
    expect(overlay).toHaveClass('pointer-events-auto');
    expect(overlay).toHaveAttribute('aria-busy', 'true');

    const backdrop = overlay.querySelector('.bg-slate-900\\/18');
    expect(backdrop).not.toBeNull();

    const card = overlay.querySelector('[data-short-variant]');
    expect(card).toHaveAttribute('data-short-variant', 'true');

    act(() => {
      vi.advanceTimersByTime(900);
      latestLoading!.update(token, { message: 'Still loading' });
    });

    expect(card).toHaveAttribute('data-short-variant', 'false');
  });
});
