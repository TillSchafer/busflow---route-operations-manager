
import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { Stop } from '../types';

interface Props {
  stops: Stop[];
  capacity: number;
}

const PassengerChart: React.FC<Props> = ({ stops, capacity }) => {
  const data = stops.map(s => ({
    name: s.location || '?',
    passengers: s.currentTotal,
    time: s.departureTime
  }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart
        data={data}
        margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
      >
        <defs>
          <linearGradient id="colorPass" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
        <XAxis 
          dataKey="name" 
          stroke="#94a3b8" 
          fontSize={12} 
          tickLine={false} 
          axisLine={false}
        />
        <YAxis 
          stroke="#94a3b8" 
          fontSize={12} 
          tickLine={false} 
          axisLine={false}
          domain={[0, Math.max(capacity, ...stops.map(s => s.currentTotal)) + 5]}
        />
        <Tooltip 
          contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
          itemStyle={{ fontWeight: 'bold' }}
        />
        <ReferenceLine y={capacity} label="KAPAZITÄT" stroke="#ef4444" strokeDasharray="3 3" />
        <Area 
          type="monotone" 
          dataKey="passengers" 
          stroke="#2563eb" 
          fillOpacity={1} 
          fill="url(#colorPass)" 
          strokeWidth={3}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
};

export default PassengerChart;
