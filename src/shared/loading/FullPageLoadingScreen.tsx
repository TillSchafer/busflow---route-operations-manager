import React from 'react';
import LoadingSpinner from './LoadingSpinner';
import { useLoading } from './LoadingProvider';
import {
  LOADING_FALLBACK_MESSAGE,
  loadingBackdropClassName,
  loadingContentClassName,
  resolveBackdropVariant,
  toProgressPercent
} from './loading-ui';

const FullPageLoadingScreen: React.FC = () => {
  const { isActive, shouldReveal, isShortVisible, display } = useLoading();

  if (!isActive || !shouldReveal) {
    return null;
  }

  const message = display.message.trim() || LOADING_FALLBACK_MESSAGE;
  const progressPercent = toProgressPercent(display.progress);
  const backdropVariant = resolveBackdropVariant(display.scope);

  return (
    <div
      className="fixed inset-0 z-[1600] pointer-events-auto flex items-center justify-center px-4"
      role="status"
      aria-live="polite"
      aria-busy="true"
      data-testid="full-page-loading-screen"
    >
      <div
        className={loadingBackdropClassName(backdropVariant, isShortVisible)}
        data-testid="loading-backdrop"
        data-backdrop-variant={backdropVariant}
      />
      {backdropVariant === 'transparent' && (
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.45),rgba(255,255,255,0.1)_45%,transparent_70%)]" />
      )}

      <div className={loadingContentClassName(backdropVariant, isShortVisible)} data-short-variant={isShortVisible ? 'true' : 'false'}>
        <LoadingSpinner className="h-9 w-9 text-slate-700" />
        <p className="text-sm font-semibold tracking-tight">{message}</p>
        {progressPercent !== null && (
          <span className="rounded-full border border-slate-300/80 px-2 py-1 text-xs font-semibold text-slate-700">
            {progressPercent}%
          </span>
        )}
      </div>
    </div>
  );
};

export default FullPageLoadingScreen;
