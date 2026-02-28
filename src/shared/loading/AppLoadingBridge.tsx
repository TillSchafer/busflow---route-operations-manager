import React, { useEffect, useRef } from 'react';
import { useLoading } from './LoadingProvider';
import type { LoadingMessageKey, LoadingToken } from './loading-types';

interface AppLoadingBridgeProps {
  authLoading: boolean;
  message?: string;
  messageKey?: LoadingMessageKey;
}

const AppLoadingBridge: React.FC<AppLoadingBridgeProps> = ({
  authLoading,
  message,
  messageKey = 'auth.bootstrap'
}) => {
  const { start, stop } = useLoading();
  const tokenRef = useRef<LoadingToken | null>(null);

  useEffect(() => {
    if (authLoading && tokenRef.current === null) {
      tokenRef.current = start({ scope: 'auth', message, messageKey });
      return;
    }

    if (!authLoading && tokenRef.current !== null) {
      stop(tokenRef.current);
      tokenRef.current = null;
    }
  }, [authLoading, message, messageKey, start, stop]);

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
  messageKey?: LoadingMessageKey;
}

export const RouteLoadingFallback: React.FC<RouteLoadingFallbackProps> = ({
  message,
  messageKey = 'route.transition'
}) => {
  const { start, stop } = useLoading();

  useEffect(() => {
    const token = start({ scope: 'route', message, messageKey });
    return () => {
      stop(token);
    };
  }, [message, messageKey, start, stop]);

  return null;
};

export default AppLoadingBridge;
