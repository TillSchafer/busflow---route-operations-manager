import { useCallback, useRef } from 'react';

type ScrollSnapshot = {
  x: number;
  y: number;
  createdAt: number;
};

export const useStableScroll = () => {
  const snapshotsRef = useRef<Record<string, ScrollSnapshot>>({});
  const latestTokenRef = useRef<string | null>(null);

  const captureScroll = useCallback(() => {
    if (typeof window === 'undefined') return;
    const token = `scroll-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    snapshotsRef.current[token] = {
      x: window.scrollX || 0,
      y: window.scrollY || 0,
      createdAt: Date.now()
    };
    latestTokenRef.current = token;
    return token;
  }, []);

  const clearSnapshot = useCallback((token: string) => {
    delete snapshotsRef.current[token];
    if (latestTokenRef.current === token) {
      latestTokenRef.current = null;
    }
  }, []);

  const restoreNow = useCallback((token: string) => {
    if (typeof window === 'undefined') return;
    if (latestTokenRef.current !== token) return;
    const snapshot = snapshotsRef.current[token];
    if (!snapshot) return;

    const activeElement = document.activeElement as HTMLElement | null;
    if (activeElement && typeof activeElement.blur === 'function') {
      activeElement.blur();
    }

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        window.setTimeout(() => {
          window.scrollTo({ left: snapshot.x, top: snapshot.y, behavior: 'auto' });
          clearSnapshot(token);
        }, 0);
      });
    });
  }, [clearSnapshot]);

  const requestRestore = useCallback((token: string) => {
    restoreNow(token);
  }, [restoreNow]);

  const cancelRestore = useCallback((token: string) => {
    clearSnapshot(token);
  }, [clearSnapshot]);

  const runWithStableScroll = useCallback(
    async <T>(fn: () => Promise<T> | T): Promise<T> => {
      const token = captureScroll();
      try {
        return await fn();
      } finally {
        if (token) {
          requestRestore(token);
        }
      }
    },
    [captureScroll, requestRestore]
  );

  return {
    beginStableScroll: captureScroll,
    requestRestore,
    cancelRestore,
    restoreNow,
    runWithStableScroll
  };
};
