import type { LoadingMessageKey, LoadingScope } from './loading-types';

export const LOADING_DEFAULT_MESSAGE = 'Lade...';

const SCOPED_LOADING_MESSAGES: Record<LoadingScope, Record<LoadingMessageKey, string>> = {
  route: {
    'route.transition': 'Lade...',
    'route.bootstrap': 'Lade...'
  },
  auth: {
    'auth.bootstrap': 'Lade...',
    'auth.session': 'Lade...'
  },
  action: {
    'action.save': 'Speichere...',
    'action.delete': 'Loesche...',
    'action.import': 'Importiere...'
  },
  system: {
    'system.default': 'Lade...'
  }
};

export interface ResolveLoadingMessageInput {
  scope: LoadingScope;
  message?: string;
  messageKey?: LoadingMessageKey;
  fallback?: string;
}

export const resolveScopedLoadingMessage = (scope: LoadingScope, messageKey?: LoadingMessageKey): string | null => {
  if (!messageKey) {
    return null;
  }
  const scopedMap = SCOPED_LOADING_MESSAGES[scope];
  const resolved = scopedMap?.[messageKey];
  return resolved?.trim() || null;
};

export const resolveLoadingMessage = ({
  scope,
  message,
  messageKey,
  fallback = LOADING_DEFAULT_MESSAGE
}: ResolveLoadingMessageInput): string => {
  const explicitMessage = message?.trim();
  if (explicitMessage) {
    return explicitMessage;
  }

  const scoped = resolveScopedLoadingMessage(scope, messageKey);
  if (scoped) {
    return scoped;
  }

  return fallback.trim() || LOADING_DEFAULT_MESSAGE;
};

export const loadingMessageRegistry = SCOPED_LOADING_MESSAGES;
