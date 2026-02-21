import React, { useState } from 'react';
import { Worker } from '../../types';
import { Plus, Trash2 } from 'lucide-react';

interface Props {
  workers: Worker[];
  onAddWorker: (worker: Worker) => void;
  onRemoveWorker: (id: string) => void;
  canManage?: boolean;
}

const WorkerPanel: React.FC<Props> = ({ workers, onAddWorker, onRemoveWorker, canManage = true }) => {
  const [workerName, setWorkerName] = useState('');
  const [workerRole, setWorkerRole] = useState('');

  const handleAddWorker = () => {
    if (!canManage) return;
    if (!workerName.trim()) return;
    onAddWorker({
      id: Date.now().toString(),
      name: workerName.trim(),
      role: workerRole.trim() || undefined
    });
    setWorkerName('');
    setWorkerRole('');
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
      <h2 className="text-xl font-bold text-slate-800 mb-1">Mitarbeiter</h2>
      <p className="text-sm text-slate-500 mb-6">Erstellen Sie eine Liste für die Fahrerzuweisung.</p>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="md:col-span-2">
          <label className="block text-sm font-semibold text-slate-700 mb-1">Name</label>
          <input
            type="text"
            value={workerName}
            onChange={e => setWorkerName(e.target.value)}
            disabled={!canManage}
            className="w-full border-slate-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2.5 bg-white border transition-all"
            placeholder="z. B. Alex Schmidt"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">Rolle</label>
          <input
            type="text"
            value={workerRole}
            onChange={e => setWorkerRole(e.target.value)}
            disabled={!canManage}
            className="w-full border-slate-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2.5 bg-white border transition-all"
            placeholder="Fahrer"
          />
        </div>
        <div className="flex items-end">
          <button
            onClick={handleAddWorker}
            disabled={!canManage}
            className="w-full bg-[#2663EB] hover:bg-[#1f54c7] text-white px-4 py-2.5 rounded-lg font-semibold flex items-center justify-center space-x-2 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Mitarbeiter hinzufügen</span>
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {workers.length === 0 && (
          <p className="text-sm text-slate-400 italic">Noch keine Mitarbeiter. Fügen Sie Ihr Team oben hinzu.</p>
        )}
        {workers.map(worker => (
          <div key={worker.id} className="flex items-center justify-between border border-slate-200 rounded-lg p-3">
            <div>
              <p className="font-semibold text-slate-800">{worker.name}</p>
              {worker.role && <p className="text-xs text-slate-500">{worker.role}</p>}
            </div>
            <button
              onClick={() => onRemoveWorker(worker.id)}
              disabled={!canManage}
              className={`transition-colors p-2 ${canManage ? 'text-slate-400 hover:text-red-600' : 'text-slate-300 cursor-not-allowed'}`}
              title="Mitarbeiter entfernen"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default WorkerPanel;
