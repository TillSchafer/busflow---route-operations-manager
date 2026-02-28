import { useCallback } from 'react';
import { useLoading } from './LoadingProvider';
import { resolveScopedLoadingMessage } from './loading-messages';
import type { LoadingMessageKey, LoadingStartOptions } from './loading-types';

export interface ActionLoadingOptions extends Omit<LoadingStartOptions, 'scope' | 'messageKey'> {
  messageKey: LoadingMessageKey;
}

const assertActionMessageKey = (messageKey: LoadingMessageKey): void => {
  if (typeof messageKey !== 'string' || messageKey.trim().length === 0) {
    throw new Error('useActionLoading requires a non-empty action messageKey.');
  }
};

const warnOnUnresolvedActionKey = (messageKey: LoadingMessageKey): void => {
  if (!import.meta.env.DEV) {
    return;
  }

  const resolved = resolveScopedLoadingMessage('action', messageKey);
  if (resolved !== null) {
    return;
  }

  console.warn(`[loading] Unknown action messageKey "${messageKey}". Falling back to Lade...`);
};

export const useActionLoading = () => {
  const { runWithLoading } = useLoading();

  const runWithActionLoading = useCallback(
    async <T,>(operation: () => Promise<T> | T, options: ActionLoadingOptions): Promise<T> => {
      assertActionMessageKey(options.messageKey);
      const messageKey = options.messageKey.trim();
      warnOnUnresolvedActionKey(messageKey);

      return runWithLoading(operation, {
        ...options,
        scope: 'action',
        messageKey
      });
    },
    [runWithLoading]
  );

  return {
    runWithActionLoading
  };
};
