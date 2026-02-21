import React, { useState } from 'react';
import { BusType } from '../../types';
import { Plus, Trash2 } from 'lucide-react';

interface Props {
  busTypes: BusType[];
  onAddBusType: (busType: BusType) => void;
  onRemoveBusType: (id: string) => void;
  canManage?: boolean;
}

const BusTypePanel: React.FC<Props> = ({ busTypes, onAddBusType, onRemoveBusType, canManage = true }) => {
  const [busTypeName, setBusTypeName] = useState('');
  const [busTypeCapacity, setBusTypeCapacity] = useState(50);
  const [busTypeNotes, setBusTypeNotes] = useState('');

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

  return (
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
            className="w-full bg-[#2663EB] hover:bg-[#1f54c7] text-white px-4 py-2.5 rounded-lg font-semibold flex items-center justify-center space-x-2 transition-colors"
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
  );
};

export default BusTypePanel;
