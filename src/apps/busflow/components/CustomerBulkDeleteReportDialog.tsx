import React from 'react';
import { CustomerBulkDeleteResult } from '../types';

interface Props {
  isOpen: boolean;
  report: CustomerBulkDeleteResult | null;
  onClose: () => void;
}

const CustomerBulkDeleteReportDialog: React.FC<Props> = ({ isOpen, report, onClose }) => {
  if (!isOpen || !report) return null;

  const downloadCsv = () => {
    const lines = ['id;name;company;code;reason'];
    report.failed.forEach(item => {
      const name = item.name.replace(/;/g, ',');
      const company = (item.companyName || '').replace(/;/g, ',');
      const reason = item.reason.replace(/;/g, ',');
      lines.push(`${item.id};${name};${company};${item.code || ''};${reason}`);
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'kunden_bulk_delete_fehler.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[1600] px-4">
      <div className="w-full max-w-3xl bg-white rounded-xl shadow-2xl border border-slate-200">
        <div className="px-6 py-4 border-b border-slate-200">
          <h3 className="text-lg font-bold text-slate-900">Bulk-Löschen Ergebnis</h3>
          <p className="text-sm text-slate-600">
            Angefordert: {report.requested} · Gelöscht: {report.deleted} · Fehlgeschlagen: {report.failed.length}
          </p>
        </div>
        <div className="p-6 max-h-[60vh] overflow-auto">
          {report.failed.length === 0 ? (
            <p className="text-sm text-emerald-700 font-medium">Alle ausgewählten Kontakte wurden erfolgreich gelöscht.</p>
          ) : (
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-3 py-2 font-semibold text-slate-700">Kontakt</th>
                  <th className="text-left px-3 py-2 font-semibold text-slate-700">Firma</th>
                  <th className="text-left px-3 py-2 font-semibold text-slate-700">Code</th>
                  <th className="text-left px-3 py-2 font-semibold text-slate-700">Grund</th>
                </tr>
              </thead>
              <tbody>
                {report.failed.map((item, idx) => (
                  <tr key={`${item.id}-${idx}`} className="border-b border-slate-100">
                    <td className="px-3 py-2 text-slate-800">{item.name}</td>
                    <td className="px-3 py-2 text-slate-700">{item.companyName || ''}</td>
                    <td className="px-3 py-2 text-slate-600">{item.code || ''}</td>
                    <td className="px-3 py-2 text-red-700">{item.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="px-6 pb-6 flex items-center justify-end gap-3">
          {report.failed.length > 0 && (
            <button
              type="button"
              onClick={downloadCsv}
              className="px-4 py-2.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50"
            >
              Fehler-CSV herunterladen
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-lg bg-[#2663EB] hover:bg-[#1f54c7] text-white font-semibold"
          >
            Schließen
          </button>
        </div>
      </div>
    </div>
  );
};

export default CustomerBulkDeleteReportDialog;
