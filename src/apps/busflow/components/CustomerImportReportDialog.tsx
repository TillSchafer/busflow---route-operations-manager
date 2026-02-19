import React from 'react';
import { CustomerImportResult } from '../types';

interface Props {
  isOpen: boolean;
  report: CustomerImportResult | null;
  onClose: () => void;
}

const CustomerImportReportDialog: React.FC<Props> = ({ isOpen, report, onClose }) => {
  if (!isOpen || !report) return null;

  const downloadErrorsCsv = () => {
    const lines = ['rowNumber;name;reason'];
    report.errors.forEach(error => {
      const name = (error.name || '').replace(/;/g, ',');
      const reason = error.reason.replace(/;/g, ',');
      lines.push(`${error.rowNumber};${name};${reason}`);
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'kunden_import_fehler.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[1600] px-4">
      <div className="w-full max-w-3xl bg-white rounded-xl shadow-2xl border border-slate-200">
        <div className="px-6 py-4 border-b border-slate-200">
          <h3 className="text-lg font-bold text-slate-900">Import-Fehlerbericht</h3>
          <p className="text-sm text-slate-600">
            Firmen: {report.insertedCompanies} · Kontakte neu: {report.insertedContacts} · Kontakte aktualisiert: {report.updatedContacts} · Übersprungen: {report.skipped} · Fehler: {report.errors.length}
          </p>
        </div>
        <div className="p-6 max-h-[60vh] overflow-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-3 py-2 font-semibold text-slate-700">Zeile</th>
                <th className="text-left px-3 py-2 font-semibold text-slate-700">Name</th>
                <th className="text-left px-3 py-2 font-semibold text-slate-700">Grund</th>
              </tr>
            </thead>
            <tbody>
              {report.errors.map((error, index) => (
                <tr key={`${error.rowNumber}-${index}`} className="border-b border-slate-100">
                  <td className="px-3 py-2 text-slate-600">{error.rowNumber}</td>
                  <td className="px-3 py-2 text-slate-800">{error.name || ''}</td>
                  <td className="px-3 py-2 text-red-700">{error.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-6 pb-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={downloadErrorsCsv}
            className="px-4 py-2.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50"
          >
            Fehler-CSV herunterladen
          </button>
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

export default CustomerImportReportDialog;
