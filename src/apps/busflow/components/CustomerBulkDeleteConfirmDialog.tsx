import React from 'react';
import { Loader2 } from 'lucide-react';

interface Props {
  isOpen: boolean;
  count: number;
  isDeleting: boolean;
  progress?: { current: number; total: number } | null;
  statusText?: string;
  onCancel: () => void;
  onConfirm: () => void;
}

const CustomerBulkDeleteConfirmDialog: React.FC<Props> = ({
  isOpen,
  count,
  isDeleting,
  progress,
  statusText,
  onCancel,
  onConfirm
}) => {
  if (!isOpen) return null;
  const percent = progress && progress.total > 0
    ? Math.round((progress.current / progress.total) * 100)
    : 0;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[1600] px-4">
      <div className="w-full max-w-lg bg-white rounded-xl shadow-2xl border border-slate-200">
        <div className="px-6 py-4 border-b border-slate-200">
          <h3 className="text-lg font-bold text-slate-900">Mehrere Kunden löschen</h3>
          {!isDeleting && (
            <p className="text-sm text-slate-500 mt-1">
              Möchtest du wirklich {count} Kunde{count === 1 ? '' : 'n'} löschen?
            </p>
          )}
        </div>
        {!isDeleting ? (
          <div className="px-6 py-4 text-sm text-slate-600">
            Kunden mit bestehenden Routenverknüpfungen werden übersprungen und im Ergebnisbericht aufgeführt.
          </div>
        ) : (
          <div className="px-6 py-4 space-y-3">
            <div className="flex items-center gap-2 text-slate-700">
              <Loader2 className="w-4 h-4 animate-spin text-[#2663EB]" />
              <span className="text-sm font-medium">{statusText || 'Kunden werden gelöscht...'}</span>
            </div>
            {progress && progress.total > 0 && (
              <div className="space-y-1.5">
                <div className="h-2 w-full rounded-full bg-slate-200 overflow-hidden">
                  <div
                    className="h-full bg-[#2663EB] transition-all duration-200"
                    style={{ width: `${percent}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-xs text-slate-600">
                  <span>{progress.current} / {progress.total}</span>
                  <span>{percent}%</span>
                </div>
              </div>
            )}
          </div>
        )}
        <div className="px-6 pb-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isDeleting}
            className="px-4 py-2.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            Abbrechen
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="px-4 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold disabled:opacity-60"
          >
            {isDeleting ? 'Lösche...' : 'Löschen'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CustomerBulkDeleteConfirmDialog;
