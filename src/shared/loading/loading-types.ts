export type LoadingScope = 'route' | 'auth' | 'action' | 'system';

export type LoadingToken = string;

export interface LoadingProgress {
  current: number;
  total: number;
}

export interface LoadingStartOptions {
  scope?: LoadingScope;
  message?: string;
  progress?: LoadingProgress;
}

export interface LoadingUpdatePatch {
  message?: string;
  progress?: LoadingProgress;
}

export interface LoadingDisplayState {
  scope: LoadingScope;
  message: string;
  progress?: LoadingProgress;
}

export interface LoadingEngineSnapshot {
  activeCount: number;
  isActive: boolean;
  shouldReveal: boolean;
  isShortVisible: boolean;
  visibleSinceMs: number | null;
  lastSettledAtMs: number | null;
  revealDelayMs: number;
  shortVariantThresholdMs: number;
  display: LoadingDisplayState;
}

export interface LoadingEngineOptions {
  revealDelayMs?: number;
  rapidResumeWindowMs?: number;
  shortVariantThresholdMs?: number;
  defaultMessage?: string;
  now?: () => number;
}
