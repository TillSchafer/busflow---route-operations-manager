
import React from 'react';
import { BusType, Route } from '../types';

interface Props {
  route: Route;
  busTypes: BusType[];
}

const PrintPreview: React.FC<Props> = ({ route, busTypes }) => {
  const busTypeName = busTypes.find(busType => busType.id === route.busTypeId)?.name;
  const busTypeCapacity = busTypes.find(busType => busType.id === route.busTypeId)?.capacity;
  return (
    <div className="p-8 max-w-[210mm] mx-auto bg-white text-black leading-snug text-[13px]">
      {/* Header */}
      <div className="flex justify-between items-start border-b-2 border-black pb-3 mb-5">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight uppercase">Busfahrplan</h1>
          <p className="text-lg font-bold text-slate-700">{route.name}</p>
        </div>
        <div className="text-right">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Betriebstag</p>
          <p className="text-lg font-bold">{new Date(route.date).toLocaleDateString('de-DE')}</p>
        </div>
      </div>

      {/* Basic Metadata */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="border p-3">
          <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Zugewiesener Fahrer</p>
          <p className="text-base font-bold">{route.driverName || '________________'}</p>
        </div>
        <div className="border p-3">
          <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Bustyp</p>
          <p className="text-base font-bold">{busTypeName || '________________'}</p>
        </div>
        <div className="border p-3">
          <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Fahrzeugkapazität</p>
          <p className="text-base font-bold">{busTypeCapacity || route.capacity} Sitze</p>
        </div>
      </div>

      {/* Operational Fields */}
      <div className="grid grid-cols-2 gap-4 mb-5 text-[12px]">
        <div className="flex flex-col gap-2">
          <div className="border border-black px-2 py-2 flex items-center justify-between">
            <span className="font-semibold">Km Anfang Betrieb</span>
            <span className="min-w-[120px] text-right">{route.kmStartBetrieb || ''}</span>
          </div>
          <div className="border border-black px-2 py-2 flex items-center justify-between">
            <span className="font-semibold">Km Anfang Kunde</span>
            <span className="min-w-[120px] text-right">{route.kmStartCustomer || ''}</span>
          </div>
          <div className="border border-black px-2 py-2 flex items-center justify-between">
            <span className="font-semibold">Km Ende Kunde</span>
            <span className="min-w-[120px] text-right">{route.kmEndCustomer || ''}</span>
          </div>
          <div className="border border-black px-2 py-2 flex items-center justify-between">
            <span className="font-semibold">Km Ende Betrieb</span>
            <span className="min-w-[120px] text-right">{route.kmEndBetrieb || ''}</span>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <div className="border border-black px-2 py-2 flex items-center justify-between">
            <span className="font-semibold">Gesamtkilometer</span>
            <span className="min-w-[120px] text-right">{route.totalKm || ''}</span>
          </div>
          <div className="border border-black px-2 py-2 flex items-center justify-between">
            <span className="font-semibold">Uhr Rückkehr Kunde</span>
            <span className="min-w-[120px] text-right">{route.timeReturnCustomer || ''}</span>
          </div>
          <div className="border border-black px-2 py-2 flex items-center justify-between">
            <span className="font-semibold">Uhr Rückkehr Betrieb</span>
            <span className="min-w-[120px] text-right">{route.timeReturnBetrieb || ''}</span>
          </div>
        </div>
      </div>

      {/* Timeline Table */}
      <table className="print-route-table w-full border-collapse border-2 border-black mb-6 text-[12px]">
        <thead>
          <tr className="bg-slate-100 border-b-2 border-black">
            <th className="border-r-2 border-black px-2 py-2 text-left font-bold">Ort</th>
            <th className="border-r-2 border-black px-2 py-2 text-center w-20">Plan Ank.</th>
            <th className="border-r-2 border-black px-2 py-2 text-center w-20">Plan Abf.</th>
            <th className="border-r-2 border-black px-2 py-2 text-center w-20">Tats. Ank.</th>
            <th className="border-r-2 border-black px-2 py-2 text-center w-20">Tats. Abf.</th>
            <th className="px-2 py-2 text-center w-16">Pers.</th>
          </tr>
        </thead>
        <tbody>
          {route.stops.map((stop, i) => (
            <tr key={stop.id} className="border-b border-slate-300 h-12">
              <td className="border-r-2 border-black px-2 py-1.5 font-semibold">
                {stop.location}
                {stop.notes && <p className="text-sm font-normal text-slate-500 mt-1 italic">{stop.notes}</p>}
              </td>
              <td className="border-r-2 border-black px-2 py-1.5 text-center font-mono">{stop.arrivalTime}</td>
              <td className="border-r-2 border-black px-2 py-1.5 text-center font-mono font-semibold">{stop.departureTime}</td>
              <td className="border-r-2 border-black px-2 py-1.5 text-center font-mono">{stop.actualArrivalTime || ''}</td>
              <td className="border-r-2 border-black px-2 py-1.5 text-center font-mono">{stop.actualDepartureTime || ''}</td>
              <td className="px-2 py-1.5 text-center bg-slate-50 font-bold">{stop.currentTotal}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Footer / Notes for Driver */}
      <section className="print-signature-block grid grid-cols-2 gap-8 pt-2">
        <div className="space-y-4">
           <h3 className="font-bold uppercase tracking-wider text-xs border-b pb-1">Betriebliche Hinweise</h3>
           <ul className="text-xs list-disc list-inside space-y-1 text-slate-600">
             {route.operationalNotes?.trim()
               ? route.operationalNotes
                   .split('\n')
                   .map(line => line.trim())
                   .filter(Boolean)
                   .map((line, idx) => <li key={idx}>{line}</li>)
               : <li>Keine betrieblichen Hinweise hinterlegt.</li>}
           </ul>
        </div>
        <div className="flex flex-col justify-between items-end space-y-8 min-h-[260px]">
          <div className="w-full border border-black rounded-md p-2 min-h-[140px]">
            <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Notizen Fahrer</p>
            <div className="h-[104px]" />
          </div>
          <div className="w-full pt-4 grid grid-cols-2 gap-6">
            <div>
              <div className="border-b-2 border-black" />
              <p className="text-[10px] uppercase font-bold text-slate-400 mt-2">Unterschrift Fahrer</p>
            </div>
            <div>
              <div className="border-b-2 border-black" />
              <p className="text-[10px] uppercase font-bold text-slate-400 mt-2">Bestätigung Leitstelle</p>
            </div>
          </div>
        </div>
      </section>

      <div className="mt-6 pt-4 border-t text-[10px] text-slate-400 flex justify-between">
        <p>Schäfer Tours Routenplanung • Version 1.0.4</p>
        <p>Gedruckt: {new Date().toLocaleString('de-DE')} • Routen-ID: {route.id}</p>
      </div>
    </div>
  );
};

export default PrintPreview;
