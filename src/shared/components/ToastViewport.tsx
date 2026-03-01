import React from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { ToastItem, useToastStore } from './ToastProvider';

const styleByType: Record<ToastItem['type'], { icon: React.ReactNode; border: string; bg: string; title: string }> = {
  success: {
    icon: <CheckCircle2 className="w-5 h-5 text-emerald-600" />,
    border: 'border-emerald-200',
    bg: 'bg-emerald-50/80',
    title: 'text-emerald-900'
  },
  error: {
    icon: <AlertCircle className="w-5 h-5 text-red-600" />,
    border: 'border-red-200',
    bg: 'bg-red-50/80',
    title: 'text-red-900'
  },
  warning: {
    icon: <AlertTriangle className="w-5 h-5 text-amber-600" />,
    border: 'border-amber-200',
    bg: 'bg-amber-50/80',
    title: 'text-amber-900'
  },
  info: {
    icon: <Info className="w-5 h-5 text-sky-600" />,
    border: 'border-sky-200',
    bg: 'bg-sky-50/80',
    title: 'text-sky-900'
  }
};

const ToastViewport: React.FC = () => {
  const { toasts, removeToast } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div className="toast-viewport no-print fixed z-[1500] bottom-4 right-4 left-4 md:left-auto md:w-[360px] space-y-3 pointer-events-none">
      {toasts.map(toast => {
        const styles = styleByType[toast.type];
        return (
          <div
            key={toast.id}
            className={`pointer-events-auto rounded-xl border ${styles.border} ${styles.bg} backdrop-blur-sm shadow-lg p-3`}
            role="status"
            aria-live="polite"
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5">{styles.icon}</div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-bold ${styles.title}`}>{toast.title}</p>
                {toast.message != null && <div className="text-sm text-slate-700 mt-0.5">{toast.message}</div>}
              </div>
              <button
                type="button"
                onClick={() => removeToast(toast.id)}
                className="text-slate-400 hover:text-slate-700 transition-colors"
                aria-label="Benachrichtigung schließen"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ToastViewport;
