import { useState, useEffect, useCallback, Dispatch, SetStateAction } from 'react';
import { AccountMember, BusType, Customer, MapDefaultView, Route } from '../types';
import { DizpoApi } from '../api';
import { useLoading } from '../../../shared/loading';

const DEFAULT_MAP_VIEW: MapDefaultView = { address: 'Deutschland', lat: 51.1657, lon: 10.4515, zoom: 6 };

export interface DizpoData {
  routes: Route[];
  busTypes: BusType[];
  accountMembers: AccountMember[];
  customers: Customer[];
  mapDefaultView: MapDefaultView;
  setRoutes: Dispatch<SetStateAction<Route[]>>;
  setCustomers: Dispatch<SetStateAction<Customer[]>>;
  setMapDefaultView: Dispatch<SetStateAction<MapDefaultView>>;
  refreshRoutes: () => Promise<void>;
  refreshSettingsData: () => Promise<void>;
}

export function useDizpoData(activeAccountId: string | null): DizpoData {
  const { runWithLoading } = useLoading();
  const [routes, setRoutes] = useState<Route[]>([]);
  const [busTypes, setBusTypes] = useState<BusType[]>([]);
  const [accountMembers, setAccountMembers] = useState<AccountMember[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [mapDefaultView, setMapDefaultView] = useState<MapDefaultView>(DEFAULT_MAP_VIEW);

  useEffect(() => {
    DizpoApi.setActiveAccountId(activeAccountId);
  }, [activeAccountId]);

  useEffect(() => {
    if (!activeAccountId) {
      setRoutes([]);
      setBusTypes([]);
      setAccountMembers([]);
      setCustomers([]);
      return;
    }

    const loadData = async () => {
      try {
        await runWithLoading(async () => {
          const [fetchedRoutes, fetchedBusTypes, fetchedMembers, fetchedCustomers, fetchedMapDefault] = await Promise.all([
            DizpoApi.getRoutes(),
            DizpoApi.getBusTypes(),
            DizpoApi.getAccountMembers(),
            DizpoApi.getCustomersForSuggestions(),
            DizpoApi.getMapDefaultView(),
          ]);
          setRoutes(fetchedRoutes);
          setBusTypes(fetchedBusTypes);
          setAccountMembers(fetchedMembers);
          setCustomers(fetchedCustomers);
          if (fetchedMapDefault) setMapDefaultView(fetchedMapDefault);
        }, { scope: 'route' });
      } catch (error) {
        console.error('Fehler beim Laden der Daten:', error);
      }
    };

    loadData();
  }, [activeAccountId, runWithLoading]);

  const refreshRoutes = useCallback(async () => {
    const fetched = await DizpoApi.getRoutes();
    setRoutes(fetched);
  }, []);

  const refreshSettingsData = useCallback(async () => {
    const [fetchedBusTypes, fetchedMembers, fetchedCustomers] = await Promise.all([
      DizpoApi.getBusTypes(),
      DizpoApi.getAccountMembers(),
      DizpoApi.getCustomersForSuggestions(),
    ]);
    const fetchedMapDefault = await DizpoApi.getMapDefaultView();
    setBusTypes(fetchedBusTypes);
    setAccountMembers(fetchedMembers);
    setCustomers(fetchedCustomers);
    if (fetchedMapDefault) setMapDefaultView(fetchedMapDefault);
  }, []);

  return {
    routes, busTypes, accountMembers, customers, mapDefaultView,
    setRoutes, setCustomers, setMapDefaultView,
    refreshRoutes, refreshSettingsData,
  };
}
