import React from 'react';
import LoadingSpinner from './LoadingSpinner';
import { useLoading } from './LoadingProvider';
import { LOADING_FALLBACK_MESSAGE, loadingCardClassName, toProgressPercent } from './loading-ui';

const FullPageLoadingScreen: React.FC = () => {
  const { isActive, shouldReveal, isShortVisible, display } = useLoading();

  if (!isActive || !shouldReveal) {
    return null;
  }

  const message = display.message.trim() || LOADING_FALLBACK_MESSAGE;
  const progressPercent = toProgressPercent(display.progress);

  return (
    <div
      className="fixed inset-0 z-[1600] pointer-events-auto flex items-center justify-center px-4"
      role="status"
      aria-live="polite"
      aria-busy="true"
      data-testid="full-page-loading-screen"
    >
      <div className="absolute inset-0 bg-slate-900/18 backdrop-blur-[1px]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.32),rgba(255,255,255,0.06)_45%,transparent_70%)]" />

      <div className={loadingCardClassName(isShortVisible)} data-short-variant={isShortVisible ? 'true' : 'false'}>
        <div className="flex items-center gap-3">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900/5">
            <LoadingSpinner className="h-6 w-6 text-slate-700" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold tracking-tight text-slate-800">{message}</p>
            <p className="text-xs text-slate-500 mt-0.5">Bitte einen Moment...</p>
          </div>
          {progressPercent !== null && (
            <span className="ml-2 rounded-full border border-slate-300/80 px-2 py-1 text-xs font-semibold text-slate-700">
              {progressPercent}%
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default FullPageLoadingScreen;
