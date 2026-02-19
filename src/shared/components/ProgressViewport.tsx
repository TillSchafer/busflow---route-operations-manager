import React from 'react';
import { Loader2 } from 'lucide-react';
import { useProgress } from './ProgressProvider';

const ProgressViewport: React.FC = () => {
  const { activeProgress } = useProgress();
  if (!activeProgress) return null;

  const percent =
    activeProgress.total > 0
      ? Math.min(100, Math.max(0, Math.round((activeProgress.current / activeProgress.total) * 100)))
      : 0;

  return (
    <div className="no-print fixed z-[1490] bottom-4 right-4 left-4 md:left-auto md:w-[360px] pointer-events-none">
      <div className="pointer-events-auto rounded-xl border border-blue-200 bg-white/95 backdrop-blur-sm shadow-lg p-3">
        <div className="flex items-start gap-3">
          <Loader2 className="w-5 h-5 text-[#2663EB] animate-spin mt-0.5" />
          <div className="flex-1 min-w-0 space-y-2">
            <p className="text-sm font-bold text-slate-900">{activeProgress.title}</p>
            {activeProgress.message && <p className="text-xs text-slate-600">{activeProgress.message}</p>}
            {activeProgress.indeterminate ? (
              <div className="h-2 w-full rounded-full bg-slate-200 overflow-hidden">
                <div className="h-full w-1/3 bg-[#2663EB] animate-pulse" />
              </div>
            ) : (
              <>
                <div className="h-2 w-full rounded-full bg-slate-200 overflow-hidden">
                  <div className="h-full bg-[#2663EB] transition-all duration-200" style={{ width: `${percent}%` }} />
                </div>
                <div className="flex items-center justify-between text-xs text-slate-600">
                  <span>{activeProgress.current} / {activeProgress.total}</span>
                  <span>{percent}%</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProgressViewport;

