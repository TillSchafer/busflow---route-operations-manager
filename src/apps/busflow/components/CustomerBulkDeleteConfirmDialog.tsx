import React from 'react';

interface Props {
  isOpen: boolean;
  count: number;
  onCancel: () => void;
  onConfirm: () => void;
}

const CustomerBulkDeleteConfirmDialog: React.FC<Props> = ({
  isOpen,
  count,
  onCancel,
  onConfirm
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[1600] px-4">
      <div className="w-full max-w-lg bg-white rounded-xl shadow-2xl border border-slate-200">
        <div className="px-6 py-4 border-b border-slate-200">
          <h3 className="text-lg font-bold text-slate-900">Mehrere Kontakte löschen</h3>
          <p className="text-sm text-slate-500 mt-1">
            Möchtest du wirklich {count} Kontakt{count === 1 ? '' : 'e'} löschen?
          </p>
        </div>
        <div className="px-6 py-4 text-sm text-slate-600">
          Kontakte mit bestehenden Routenverknüpfungen werden übersprungen und im Ergebnisbericht aufgeführt.
        </div>
        <div className="px-6 pb-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50"
          >
            Abbrechen
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-4 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold"
          >
            Löschen
          </button>
        </div>
      </div>
    </div>
  );
};

export default CustomerBulkDeleteConfirmDialog;
