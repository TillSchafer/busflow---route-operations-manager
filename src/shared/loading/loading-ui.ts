import type { LoadingProgress } from './loading-types';

export const LOADING_FALLBACK_MESSAGE = 'Lade...';
export const SHORT_VARIANT_THRESHOLD_MS = 850;

export const isDeterminateProgress = (progress?: LoadingProgress): progress is LoadingProgress =>
  !!progress &&
  Number.isFinite(progress.current) &&
  Number.isFinite(progress.total) &&
  progress.total > 0 &&
  progress.current >= 0;

export const toProgressPercent = (progress?: LoadingProgress): number | null => {
  if (!isDeterminateProgress(progress)) {
    return null;
  }
  const percent = Math.round((progress.current / progress.total) * 100);
  return Math.max(0, Math.min(100, percent));
};

export const loadingCardClassName = (isShortVariant: boolean): string => {
  if (isShortVariant) {
    return [
      'rounded-2xl border border-white/50 bg-white/78 shadow-md',
      'backdrop-blur-md p-5 w-[min(92vw,380px)] transition-all duration-200'
    ].join(' ');
  }
  return [
    'rounded-3xl border border-white/65 bg-white/88 shadow-2xl',
    'backdrop-blur-xl p-6 w-[min(92vw,420px)] transition-all duration-250'
  ].join(' ');
};
