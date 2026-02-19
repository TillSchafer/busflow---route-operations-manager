import React, { useMemo, useState } from 'react';
import { CustomerImportPreview } from '../types';

interface Props {
  isOpen: boolean;
  preview: CustomerImportPreview | null;
  onClose: () => void;
  onConfirm: (resolutions: Record<number, 'import' | 'skip'>) => Promise<void>;
}

const CustomerImportConflictDialog: React.FC<Props> = ({ isOpen, preview, onClose, onConfirm }) => {
  const [resolutions, setResolutions] = useState<Record<number, 'import' | 'skip'>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const conflicts = preview?.conflicts || [];
  const importCount = useMemo(
    () => conflicts.filter(conflict => (resolutions[conflict.rowNumber] || 'skip') === 'import').length,
    [conflicts, resolutions]
  );

  if (!isOpen || !preview) return null;

  const setAll = (value: 'import' | 'skip') => {
    const next: Record<number, 'import' | 'skip'> = {};
    conflicts.forEach(conflict => {
      next[conflict.rowNumber] = value;
    });
    setResolutions(next);
  };

  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      await onConfirm(resolutions);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[1600] px-4">
      <div className="w-full max-w-5xl bg-white rounded-xl shadow-2xl border border-slate-200">
        <div className="px-6 py-4 border-b border-slate-200">
          <h3 className="text-lg font-bold text-slate-900">Import-Konflikte bei Kontakten</h3>
          <p className="text-sm text-slate-600">
            {conflicts.length} Konflikt(e) erkannt. Importieren: {importCount}, Überspringen: {conflicts.length - importCount}
          </p>
        </div>
        <div className="px-6 py-3 border-b border-slate-200 flex items-center gap-2">
          <button
            type="button"
            className="px-3 py-1.5 rounded-md border border-slate-300 text-sm text-slate-700 hover:bg-slate-50"
            onClick={() => setAll('import')}
            disabled={isSubmitting}
          >
            Alle importieren
          </button>
          <button
            type="button"
            className="px-3 py-1.5 rounded-md border border-slate-300 text-sm text-slate-700 hover:bg-slate-50"
            onClick={() => setAll('skip')}
            disabled={isSubmitting}
          >
            Alle überspringen
          </button>
        </div>
        <div className="p-6 max-h-[60vh] overflow-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-3 py-2 font-semibold text-slate-700">Zeile</th>
                <th className="text-left px-3 py-2 font-semibold text-slate-700">Firma</th>
                <th className="text-left px-3 py-2 font-semibold text-slate-700">Bestehend</th>
                <th className="text-left px-3 py-2 font-semibold text-slate-700">CSV-Kontakt</th>
                <th className="text-left px-3 py-2 font-semibold text-slate-700">Aktion</th>
              </tr>
            </thead>
            <tbody>
              {conflicts.map(conflict => (
                <tr key={conflict.rowNumber} className="border-b border-slate-100">
                  <td className="px-3 py-2 text-slate-600">{conflict.rowNumber}</td>
                  <td className="px-3 py-2 text-slate-800 font-medium">{conflict.companyName}</td>
                  <td className="px-3 py-2 text-slate-700">
                    <div>{conflict.existingContact.fullName || '-'}</div>
                    <div className="text-xs text-slate-500">{conflict.existingContact.email || '-'}</div>
                  </td>
                  <td className="px-3 py-2 text-slate-700">
                    <div>{conflict.incomingContact.fullName || '-'}</div>
                    <div className="text-xs text-slate-500">{conflict.incomingContact.email || '-'}</div>
                  </td>
                  <td className="px-3 py-2">
                    <select
                      value={resolutions[conflict.rowNumber] || 'skip'}
                      onChange={e => setResolutions(prev => ({ ...prev, [conflict.rowNumber]: e.target.value as 'import' | 'skip' }))}
                      disabled={isSubmitting}
                      className="border border-slate-300 rounded-md px-2 py-1"
                    >
                      <option value="skip">Überspringen</option>
                      <option value="import">Importieren</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-6 pb-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            Abbrechen
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isSubmitting}
            className="px-4 py-2.5 rounded-lg bg-[#2663EB] hover:bg-[#1f54c7] text-white font-semibold disabled:opacity-60"
          >
            Entscheidungen anwenden
          </button>
        </div>
      </div>
    </div>
  );
};

export default CustomerImportConflictDialog;

