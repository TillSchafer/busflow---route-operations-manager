import type { LoadingProgress, LoadingScope } from './loading-types';

export const LOADING_FALLBACK_MESSAGE = 'Lade...';
export const SHORT_VARIANT_THRESHOLD_MS = 850;
export type LoadingBackdropVariant = 'white' | 'transparent';

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

export const resolveBackdropVariant = (scope: LoadingScope): LoadingBackdropVariant => {
  return scope === 'route' || scope === 'auth' ? 'white' : 'transparent';
};

export const loadingBackdropClassName = (variant: LoadingBackdropVariant, isShortVariant: boolean): string => {
  if (variant === 'white') {
    return isShortVariant ? 'absolute inset-0 bg-white/88' : 'absolute inset-0 bg-white/96';
  }

  if (isShortVariant) {
    return 'absolute inset-0 bg-slate-100/42 backdrop-blur-[0.5px]';
  }
  return 'absolute inset-0 bg-slate-200/58 backdrop-blur-[1px]';
};

export const loadingContentClassName = (variant: LoadingBackdropVariant, isShortVariant: boolean): string => {
  if (variant === 'white') {
    return [
      'relative flex flex-col items-center gap-2 text-center',
      isShortVariant ? 'text-slate-700' : 'text-slate-800'
    ].join(' ');
  }

  if (isShortVariant) {
    return [
      'relative flex flex-col items-center gap-2 text-center',
      'rounded-xl border border-white/55 bg-white/72 px-5 py-4',
      'shadow-sm backdrop-blur-md transition-all duration-200 text-slate-700'
    ].join(' ');
  }

  return [
    'relative flex flex-col items-center gap-3 text-center',
      'rounded-xl border border-white/70 bg-white/86 px-6 py-5',
    'shadow-lg backdrop-blur-xl transition-all duration-250 text-slate-800'
  ].join(' ');
};
