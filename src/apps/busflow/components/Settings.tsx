import React, { useState } from 'react';
import { BusType, Worker, Customer } from '../types';
import { Plus, Trash2 } from 'lucide-react';

interface Props {
  busTypes: BusType[];
  workers: Worker[];
  onAddBusType: (busType: BusType) => void;
  onRemoveBusType: (id: string) => void;
  onAddWorker: (worker: Worker) => void;
  onRemoveWorker: (id: string) => void;
  customers: Customer[];
  onAddCustomer: (customer: Customer) => void;
  onRemoveCustomer: (id: string) => void;
  canManage?: boolean;
}

const Settings: React.FC<Props> = ({
  busTypes,
  workers,
  onAddBusType,
  onRemoveBusType,
  onAddWorker,
  onRemoveWorker,
  customers,
  onAddCustomer,
  onRemoveCustomer,
  canManage = true
}) => {
  const [busTypeName, setBusTypeName] = useState('');
  const [busTypeCapacity, setBusTypeCapacity] = useState(50);
  const [busTypeNotes, setBusTypeNotes] = useState('');
  const [workerName, setWorkerName] = useState('');
  const [workerRole, setWorkerRole] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerNotes, setCustomerNotes] = useState('');

  const handleAddBusType = () => {
    if (!canManage) return;
    if (!busTypeName.trim()) return;
    onAddBusType({
      id: Date.now().toString(),
      name: busTypeName.trim(),
      capacity: Number(busTypeCapacity) || 0,
      notes: busTypeNotes.trim() || undefined
    });
    setBusTypeName('');
    setBusTypeCapacity(50);
    setBusTypeNotes('');
  };

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

  const handleAddCustomer = () => {
    if (!canManage) return;
    if (!customerName.trim()) return;
    onAddCustomer({
      id: Date.now().toString(),
      name: customerName.trim(),
      notes: customerNotes.trim() || undefined
    });
    setCustomerName('');
    setCustomerNotes('');
  };

  return (
    <div className="space-y-10">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
        <h2 className="text-xl font-bold text-slate-800 mb-1">Bustypen</h2>
        <p className="text-sm text-slate-500 mb-6">Vorlagen für Fahrzeugkapazität und Bezeichnungen.</p>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="md:col-span-2">
            <label className="block text-sm font-semibold text-slate-700 mb-1">Bustyp-Name</label>
            <input
              type="text"
              value={busTypeName}
              onChange={e => setBusTypeName(e.target.value)}
              disabled={!canManage}
              className="w-full border-slate-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2.5 bg-white border transition-all"
              placeholder="z. B. Stadtbus 40"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Kapazität</label>
            <input
              type="number"
              value={busTypeCapacity}
              onChange={e => setBusTypeCapacity(parseInt(e.target.value, 10) || 0)}
              disabled={!canManage}
              className="w-full border-slate-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2.5 bg-white border transition-all"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={handleAddBusType}
              disabled={!canManage}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg font-semibold flex items-center justify-center space-x-2 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Bustyp hinzufügen</span>
            </button>
          </div>
          <div className="md:col-span-4">
            <label className="block text-sm font-semibold text-slate-700 mb-1">Notizen</label>
            <input
              type="text"
              value={busTypeNotes}
              onChange={e => setBusTypeNotes(e.target.value)}
              disabled={!canManage}
              className="w-full border-slate-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2.5 bg-white border transition-all"
              placeholder="Optionale Notizen"
            />
          </div>
        </div>

        <div className="space-y-3">
          {busTypes.length === 0 && (
            <p className="text-sm text-slate-400 italic">Noch keine Bustypen. Fügen Sie oben den ersten hinzu.</p>
          )}
          {busTypes.map(busType => (
            <div key={busType.id} className="flex items-center justify-between border border-slate-200 rounded-lg p-3">
              <div>
                <p className="font-semibold text-slate-800">{busType.name}</p>
                <p className="text-xs text-slate-500">Kapazität: {busType.capacity}</p>
                {busType.notes && <p className="text-xs text-slate-400">{busType.notes}</p>}
              </div>
              <button
                onClick={() => onRemoveBusType(busType.id)}
                disabled={!canManage}
                className={`transition-colors p-2 ${canManage ? 'text-slate-400 hover:text-red-600' : 'text-slate-300 cursor-not-allowed'}`}
                title="Bustyp entfernen"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>

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
              className="w-full bg-slate-900 hover:bg-slate-800 text-white px-4 py-2.5 rounded-lg font-semibold flex items-center justify-center space-x-2 transition-colors"
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

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
        <h2 className="text-xl font-bold text-slate-800 mb-1">Kunden</h2>
        <p className="text-sm text-slate-500 mb-6">Verwalten Sie Auftraggeber für die Routenerstellung.</p>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="md:col-span-2">
            <label className="block text-sm font-semibold text-slate-700 mb-1">Kundenname</label>
            <input
              type="text"
              value={customerName}
              onChange={e => setCustomerName(e.target.value)}
              disabled={!canManage}
              className="w-full border-slate-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2.5 bg-white border transition-all"
              placeholder="z. B. Stadtwerke GmbH"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Notizen</label>
            <input
              type="text"
              value={customerNotes}
              onChange={e => setCustomerNotes(e.target.value)}
              disabled={!canManage}
              className="w-full border-slate-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2.5 bg-white border transition-all"
              placeholder="Optional"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={handleAddCustomer}
              disabled={!canManage}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-lg font-semibold flex items-center justify-center space-x-2 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Kunde hinzufügen</span>
            </button>
          </div>
        </div>

        <div className="space-y-3">
          {customers.length === 0 && (
            <p className="text-sm text-slate-400 italic">Noch keine Kunden. Fügen Sie oben den ersten hinzu.</p>
          )}
          {customers.map(customer => (
            <div key={customer.id} className="flex items-center justify-between border border-slate-200 rounded-lg p-3">
              <div>
                <p className="font-semibold text-slate-800">{customer.name}</p>
                {customer.notes && <p className="text-xs text-slate-500">{customer.notes}</p>}
              </div>
              <button
                onClick={() => onRemoveCustomer(customer.id)}
                disabled={!canManage}
                className={`transition-colors p-2 ${canManage ? 'text-slate-400 hover:text-red-600' : 'text-slate-300 cursor-not-allowed'}`}
                title="Kunde entfernen"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Settings;
