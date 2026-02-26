import React, { useEffect, useRef } from 'react';
import { useLoading } from './LoadingProvider';
import { LOADING_FALLBACK_MESSAGE } from './loading-ui';
import type { LoadingToken } from './loading-types';

interface AppLoadingBridgeProps {
  authLoading: boolean;
  message?: string;
}

const AppLoadingBridge: React.FC<AppLoadingBridgeProps> = ({ authLoading, message = LOADING_FALLBACK_MESSAGE }) => {
  const { start, stop } = useLoading();
  const tokenRef = useRef<LoadingToken | null>(null);

  useEffect(() => {
    if (authLoading && tokenRef.current === null) {
      tokenRef.current = start({ scope: 'auth', message });
      return;
    }

    if (!authLoading && tokenRef.current !== null) {
      stop(tokenRef.current);
      tokenRef.current = null;
    }
  }, [authLoading, message, start, stop]);

  useEffect(() => {
    return () => {
      if (tokenRef.current !== null) {
        stop(tokenRef.current);
        tokenRef.current = null;
      }
    };
  }, [stop]);

  return null;
};

interface RouteLoadingFallbackProps {
  message?: string;
}

export const RouteLoadingFallback: React.FC<RouteLoadingFallbackProps> = ({ message = LOADING_FALLBACK_MESSAGE }) => {
  const { start, stop } = useLoading();

  useEffect(() => {
    const token = start({ scope: 'route', message });
    return () => {
      stop(token);
    };
  }, [message, start, stop]);

  return null;
};

export default AppLoadingBridge;
