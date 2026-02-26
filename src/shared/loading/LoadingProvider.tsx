import React, { createContext, useContext, useMemo, useRef, useSyncExternalStore } from 'react';
import { LoadingEngine } from './loading-engine';
import type { LoadingEngineOptions, LoadingEngineSnapshot, LoadingStartOptions, LoadingToken, LoadingUpdatePatch } from './loading-types';

export interface LoadingContextValue {
  activeCount: number;
  isActive: boolean;
  shouldReveal: boolean;
  isShortVisible: boolean;
  revealDelayMs: number;
  shortVariantThresholdMs: number;
  visibleSinceMs: number | null;
  display: LoadingEngineSnapshot['display'];
  start: (options?: LoadingStartOptions) => LoadingToken;
  update: (token: LoadingToken, patch: LoadingUpdatePatch) => boolean;
  stop: (token: LoadingToken) => boolean;
  runWithLoading: <T>(operation: () => Promise<T> | T, options?: LoadingStartOptions) => Promise<T>;
}

const LoadingContext = createContext<LoadingContextValue | undefined>(undefined);

interface LoadingProviderProps {
  children: React.ReactNode;
  options?: LoadingEngineOptions;
}

export const LoadingProvider: React.FC<LoadingProviderProps> = ({ children, options }) => {
  const engineRef = useRef<LoadingEngine | null>(null);
  if (!engineRef.current) {
    engineRef.current = new LoadingEngine(options);
  }
  const engine = engineRef.current;

  const snapshot = useSyncExternalStore(
    listener => engine.subscribe(listener),
    () => engine.getSnapshot(),
    () => engine.getSnapshot()
  );

  const value = useMemo<LoadingContextValue>(() => {
    const nowMs = Date.now();
    const isShortVisible =
      snapshot.shouldReveal &&
      snapshot.visibleSinceMs !== null &&
      nowMs - snapshot.visibleSinceMs < snapshot.shortVariantThresholdMs;

    return {
      activeCount: snapshot.activeCount,
      isActive: snapshot.isActive,
      shouldReveal: snapshot.shouldReveal,
      isShortVisible,
      revealDelayMs: snapshot.revealDelayMs,
      shortVariantThresholdMs: snapshot.shortVariantThresholdMs,
      visibleSinceMs: snapshot.visibleSinceMs,
      display: snapshot.display,
      start: startOptions => engine.start(startOptions),
      update: (token, patch) => engine.update(token, patch),
      stop: token => engine.stop(token),
      runWithLoading: (operation, runOptions) => engine.runWithLoading(operation, runOptions)
    };
  }, [engine, snapshot]);

  return <LoadingContext.Provider value={value}>{children}</LoadingContext.Provider>;
};

export const useLoading = (): LoadingContextValue => {
  const context = useContext(LoadingContext);
  if (!context) {
    throw new Error('useLoading must be used within a LoadingProvider');
  }
  return context;
};
