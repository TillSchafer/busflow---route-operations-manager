import React from 'react';
import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LoadingProvider, useLoading, type LoadingContextValue } from './LoadingProvider';

const LoadingProbe = React.forwardRef<LoadingContextValue, Record<string, never>>((_, ref) => {
  const loading = useLoading();
  React.useImperativeHandle(ref, () => loading, [loading]);

  return (
    <output data-testid="loading-state">
      {loading.activeCount}|{loading.shouldReveal ? '1' : '0'}
    </output>
  );
});
LoadingProbe.displayName = 'LoadingProbe';

const renderProbe = () => {
  const loadingRef = React.createRef<LoadingContextValue>();
  render(
    <LoadingProvider>
      <LoadingProbe ref={loadingRef} />
    </LoadingProvider>
  );
  expect(loadingRef.current).not.toBeNull();
  return loadingRef;
};

describe('LoadingProvider', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('cleans up loading state after success and error paths', async () => {
    const loadingRef = renderProbe();

    let successRun!: Promise<void>;
    act(() => {
      successRun = loadingRef.current!.runWithLoading(async () => {
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
      failingRun = loadingRef.current!.runWithLoading(async () => {
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
    const loadingRef = renderProbe();

    let firstToken: string;
    let secondToken: string;
    act(() => {
      firstToken = loadingRef.current!.start({ message: 'first' });
      secondToken = loadingRef.current!.start({ message: 'second' });
    });

    expect(screen.getByTestId('loading-state')).toHaveTextContent('2|0');

    act(() => {
      loadingRef.current!.stop(firstToken);
    });
    expect(screen.getByTestId('loading-state')).toHaveTextContent('1|0');

    act(() => {
      loadingRef.current!.stop(secondToken);
    });
    expect(screen.getByTestId('loading-state')).toHaveTextContent('0|0');
  });

  it('cancels delayed reveal when operation completes before threshold', () => {
    const loadingRef = renderProbe();

    let token: string;
    act(() => {
      token = loadingRef.current!.start();
      vi.advanceTimersByTime(100);
      loadingRef.current!.stop(token);
    });

    expect(screen.getByTestId('loading-state')).toHaveTextContent('0|0');

    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(screen.getByTestId('loading-state')).toHaveTextContent('0|0');
  });
});
