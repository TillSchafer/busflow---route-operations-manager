
import React from 'react';
import { BusType, Route } from '../types';

interface Props {
  route: Route;
  busTypes: BusType[];
}

const PrintPreview: React.FC<Props> = ({ route, busTypes }) => {
  const busTypeName = busTypes.find(busType => busType.id === route.busTypeId)?.name;
  const firstStop = route.stops[0]?.location;
  const lastStop = route.stops[route.stops.length - 1]?.location;

  return (
    <div className="p-12 max-w-[210mm] mx-auto bg-white text-black leading-tight">
      {/* Header */}
      <div className="flex justify-between items-start border-b-4 border-black pb-4 mb-8">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tighter mb-1 uppercase">Busfahrplan</h1>
          <p className="text-2xl font-bold text-slate-700">{route.name}</p>
          {firstStop && lastStop && (
            <p className="text-sm font-semibold text-slate-500 mt-1">
              Von {firstStop} nach {lastStop}
            </p>
          )}
        </div>
        <div className="text-right">
          <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Betriebstag</p>
          <p className="text-2xl font-bold">{new Date(route.date).toLocaleDateString('de-DE')}</p>
        </div>
      </div>

      {/* Basic Metadata */}
      <div className="grid grid-cols-3 gap-6 mb-6">
        <div className="border p-4">
          <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Zugewiesener Fahrer</p>
          <p className="text-xl font-bold">{route.driverName || '________________'}</p>
        </div>
        <div className="border p-4">
          <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Bustyp</p>
          <p className="text-xl font-bold">{busTypeName || '________________'}</p>
        </div>
        <div className="border p-4">
          <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Fahrzeugkapazität</p>
          <p className="text-xl font-bold">{route.capacity} Sitze</p>
        </div>
      </div>

      {/* Operational Fields */}
      <div className="grid grid-cols-2 gap-6 mb-8">
        <div className="border border-black">
          <div className="grid grid-cols-2 text-sm">
            <div className="border-b border-r border-black px-3 py-2 font-semibold">Km Anfang Betrieb</div>
            <div className="border-b border-black px-3 py-2">{route.kmStartBetrieb || '______________'}</div>
            <div className="border-b border-r border-black px-3 py-2 font-semibold">Km Anfang Kunde</div>
            <div className="border-b border-black px-3 py-2">{route.kmStartCustomer || '______________'}</div>
            <div className="border-b border-r border-black px-3 py-2 font-semibold">Km Ende Kunde</div>
            <div className="border-b border-black px-3 py-2">{route.kmEndCustomer || '______________'}</div>
            <div className="border-r border-black px-3 py-2 font-semibold">Km Ende Betrieb</div>
            <div className="px-3 py-2">{route.kmEndBetrieb || '______________'}</div>
          </div>
        </div>
        <div className="border border-black">
          <div className="grid grid-cols-2 text-sm">
            <div className="border-b border-r border-black px-3 py-2 font-semibold">Gesamtkilometer</div>
            <div className="border-b border-black px-3 py-2">{route.totalKm || '______________'}</div>
            <div className="border-b border-r border-black px-3 py-2 font-semibold">Uhr Rückkehr Kunde</div>
            <div className="border-b border-black px-3 py-2">{route.timeReturnCustomer || '____:____'}</div>
            <div className="border-r border-black px-3 py-2 font-semibold">Uhr Rückkehr Betrieb</div>
            <div className="px-3 py-2">{route.timeReturnBetrieb || '____:____'}</div>
          </div>
        </div>
      </div>

      {/* Timeline Table */}
      <table className="w-full border-collapse border-2 border-black mb-12 text-base">
        <thead>
          <tr className="bg-slate-100 border-b-2 border-black">
            <th className="border-r-2 border-black px-3 py-3 text-left font-bold">Ort</th>
            <th className="border-r-2 border-black px-3 py-3 text-center w-24">Plan Ank.</th>
            <th className="border-r-2 border-black px-3 py-3 text-center w-24">Plan Abf.</th>
            <th className="border-r-2 border-black px-3 py-3 text-center w-24">Ist Ank.</th>
            <th className="border-r-2 border-black px-3 py-3 text-center w-24">Ist Abf.</th>
            <th className="px-3 py-3 text-center w-20">PERSONEN</th>
          </tr>
        </thead>
        <tbody>
          {route.stops.map((stop, i) => (
            <tr key={stop.id} className="border-b border-slate-300 h-16">
              <td className="border-r-2 border-black px-3 py-2 font-bold">
                {stop.location}
                {stop.notes && <p className="text-sm font-normal text-slate-500 mt-1 italic">{stop.notes}</p>}
              </td>
              <td className="border-r-2 border-black px-3 py-2 text-center font-mono">{stop.arrivalTime}</td>
              <td className="border-r-2 border-black px-3 py-2 text-center font-mono font-bold text-lg">{stop.departureTime}</td>
              <td className="border-r-2 border-black px-3 py-2 text-center font-mono">{stop.actualArrivalTime || '____'}</td>
              <td className="border-r-2 border-black px-3 py-2 text-center font-mono">{stop.actualDepartureTime || '____'}</td>
              <td className="px-3 py-2 text-center bg-slate-50 font-black text-lg">{stop.currentTotal}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Footer / Notes for Driver */}
      <div className="grid grid-cols-2 gap-12 mt-auto">
        <div className="space-y-4">
           <h3 className="font-bold uppercase tracking-wider text-sm border-b pb-1">Betriebliche Hinweise</h3>
           <ul className="text-sm list-disc list-inside space-y-2 text-slate-600">
             {route.operationalNotes?.trim()
               ? route.operationalNotes
                   .split('\n')
                   .map(line => line.trim())
                   .filter(Boolean)
                   .map((line, idx) => <li key={idx}>{line}</li>)
               : <li>Keine betrieblichen Hinweise hinterlegt.</li>}
           </ul>
        </div>
        <div className="flex flex-col justify-end items-end space-y-8">
          <div className="w-full max-w-[200px] border-b-2 border-dotted border-black pb-1">
             <p className="text-[10px] uppercase font-bold text-slate-400">Unterschrift Fahrer</p>
          </div>
          <div className="w-full max-w-[200px] border-b-2 border-dotted border-black pb-1">
             <p className="text-[10px] uppercase font-bold text-slate-400">Bestätigung Leitstelle</p>
          </div>
        </div>
      </div>

      <div className="mt-12 pt-8 border-t text-[10px] text-slate-400 flex justify-between">
        <p>Schäfer Tours Routenplanung • Version 1.0.4</p>
        <p>Gedruckt: {new Date().toLocaleString('de-DE')} • Routen-ID: {route.id}</p>
      </div>
    </div>
  );
};

export default PrintPreview;
