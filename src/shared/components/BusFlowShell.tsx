import React from 'react';
import { Outlet } from 'react-router-dom';
import { AppSidebar } from './AppSidebar';

export function BusFlowShell() {
  return (
    <div className="flex min-h-screen bg-slate-50">
      <AppSidebar />
      <div className="flex-1 overflow-auto min-w-0">
        <Outlet />
      </div>
    </div>
  );
}
