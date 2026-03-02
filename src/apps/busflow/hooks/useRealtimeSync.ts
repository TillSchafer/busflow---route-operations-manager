import { useEffect, useRef } from 'react';
import { supabase } from '../../../shared/lib/supabase';

interface RealtimeSyncOptions {
  activeAccountId: string | null;
  refreshRoutes: () => Promise<void>;
  refreshSettingsData: () => Promise<void>;
}

export function useRealtimeSync({ activeAccountId, refreshRoutes, refreshSettingsData }: RealtimeSyncOptions) {
  const routesRefreshTimeout = useRef<number | null>(null);
  const settingsRefreshTimeout = useRef<number | null>(null);
  const pollingInterval = useRef<number | null>(null);

  useEffect(() => {
    if (!activeAccountId) return;

    const scheduleRoutesRefresh = () => {
      if (routesRefreshTimeout.current) window.clearTimeout(routesRefreshTimeout.current);
      routesRefreshTimeout.current = window.setTimeout(() => {
        refreshRoutes().catch(err => console.error('Realtime route refresh failed:', err));
      }, 200);
    };

    const scheduleSettingsRefresh = () => {
      if (settingsRefreshTimeout.current) window.clearTimeout(settingsRefreshTimeout.current);
      settingsRefreshTimeout.current = window.setTimeout(() => {
        refreshSettingsData().catch(err => console.error('Realtime settings refresh failed:', err));
      }, 200);
    };

    const accountFilter = `account_id=eq.${activeAccountId}`;
    const channel = supabase
      .channel(`busflow-live-sync-${activeAccountId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'busflow_routes', filter: accountFilter }, scheduleRoutesRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'busflow_stops', filter: accountFilter }, scheduleRoutesRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'busflow_bus_types', filter: accountFilter }, scheduleSettingsRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'busflow_customers', filter: accountFilter }, scheduleSettingsRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'busflow_customer_contacts', filter: accountFilter }, scheduleSettingsRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'busflow_app_settings', filter: accountFilter }, scheduleSettingsRefresh)
      .subscribe();

    // Fallback polling: ensures UI still updates even if realtime is briefly unavailable.
    const runPollingRefresh = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      refreshRoutes().catch(err => console.error('Polling route refresh failed:', err));
    };
    pollingInterval.current = window.setInterval(runPollingRefresh, 8000);

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        runPollingRefresh();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      if (routesRefreshTimeout.current) window.clearTimeout(routesRefreshTimeout.current);
      if (settingsRefreshTimeout.current) window.clearTimeout(settingsRefreshTimeout.current);
      if (pollingInterval.current) window.clearInterval(pollingInterval.current);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      supabase.removeChannel(channel);
    };
  }, [activeAccountId, refreshRoutes, refreshSettingsData]);
}
