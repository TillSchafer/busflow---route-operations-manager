import React from 'react';
import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LoadingProvider, useLoading, type LoadingContextValue } from './LoadingProvider';

let latestLoading: LoadingContextValue | null = null;

const LoadingProbe: React.FC = () => {
  const loading = useLoading();
  latestLoading = loading;

  return (
    <output data-testid="loading-state">
      {loading.activeCount}|{loading.shouldReveal ? '1' : '0'}
    </output>
  );
};

const renderProbe = () => {
  render(
    <LoadingProvider>
      <LoadingProbe />
    </LoadingProvider>
  );
  expect(latestLoading).not.toBeNull();
};

describe('LoadingProvider', () => {
  beforeEach(() => {
    latestLoading = null;
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('cleans up loading state after success and error paths', async () => {
    renderProbe();

    let successRun!: Promise<void>;
    act(() => {
      successRun = latestLoading!.runWithLoading(async () => {
        await new Promise<void>(resolve => setTimeout(resolve, 200));
      });
    });

    expect(screen.getByTestId('loading-state')).toHaveTextContent('1|0');

    act(() => {
      vi.advanceTimersByTime(150);
    });
    expect(screen.getByTestId('loading-state')).toHaveTextContent('1|1');

    await act(async () => {
      vi.advanceTimersByTime(50);
      await successRun;
    });

    expect(screen.getByTestId('loading-state')).toHaveTextContent('0|0');

    let failingRun!: Promise<never>;
    act(() => {
      failingRun = latestLoading!.runWithLoading(async () => {
        throw new Error('boom');
      });
    });

    let caughtError: unknown;
    await act(async () => {
      try {
        await failingRun;
      } catch (error: unknown) {
        caughtError = error;
      }
    });
    expect(caughtError).toBeInstanceOf(Error);
    expect((caughtError as Error).message).toBe('boom');
    expect(screen.getByTestId('loading-state')).toHaveTextContent('0|0');
  });

  it('keeps loading active while overlapping operations are in progress', () => {
    renderProbe();

    let firstToken: string;
    let secondToken: string;
    act(() => {
      firstToken = latestLoading!.start({ message: 'first' });
      secondToken = latestLoading!.start({ message: 'second' });
    });

    expect(screen.getByTestId('loading-state')).toHaveTextContent('2|0');

    act(() => {
      latestLoading!.stop(firstToken);
    });
    expect(screen.getByTestId('loading-state')).toHaveTextContent('1|0');

    act(() => {
      latestLoading!.stop(secondToken);
    });
    expect(screen.getByTestId('loading-state')).toHaveTextContent('0|0');
  });

  it('cancels delayed reveal when operation completes before threshold', () => {
    renderProbe();

    let token: string;
    act(() => {
      token = latestLoading!.start();
      vi.advanceTimersByTime(100);
      latestLoading!.stop(token);
    });

    expect(screen.getByTestId('loading-state')).toHaveTextContent('0|0');

    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(screen.getByTestId('loading-state')).toHaveTextContent('0|0');
  });
});
