import { useState, useEffect, useCallback, Dispatch, SetStateAction } from 'react';
import { AccountMember, BusType, Customer, MapDefaultView, Route } from '../types';
import { BusFlowApi } from '../api';
import { useLoading } from '../../../shared/loading';

const DEFAULT_MAP_VIEW: MapDefaultView = { address: 'Deutschland', lat: 51.1657, lon: 10.4515, zoom: 6 };

export interface BusflowData {
  routes: Route[];
  busTypes: BusType[];
  accountMembers: AccountMember[];
  customers: Customer[];
  loading: boolean;
  mapDefaultView: MapDefaultView;
  setRoutes: Dispatch<SetStateAction<Route[]>>;
  setBusTypes: Dispatch<SetStateAction<BusType[]>>;
  setAccountMembers: Dispatch<SetStateAction<AccountMember[]>>;
  setCustomers: Dispatch<SetStateAction<Customer[]>>;
  setMapDefaultView: Dispatch<SetStateAction<MapDefaultView>>;
  refreshRoutes: () => Promise<void>;
  refreshSettingsData: () => Promise<void>;
}

export function useBusflowData(activeAccountId: string | null): BusflowData {
  const { runWithLoading } = useLoading();
  const [routes, setRoutes] = useState<Route[]>([]);
  const [busTypes, setBusTypes] = useState<BusType[]>([]);
  const [accountMembers, setAccountMembers] = useState<AccountMember[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [mapDefaultView, setMapDefaultView] = useState<MapDefaultView>(DEFAULT_MAP_VIEW);

  useEffect(() => {
    BusFlowApi.setActiveAccountId(activeAccountId);
  }, [activeAccountId]);

  useEffect(() => {
    if (!activeAccountId) {
      setRoutes([]);
      setBusTypes([]);
      setAccountMembers([]);
      setCustomers([]);
      setLoading(false);
      return;
    }

    const loadData = async () => {
      setLoading(true);
      try {
        await runWithLoading(async () => {
          const [fetchedRoutes, fetchedBusTypes, fetchedMembers, fetchedCustomers, fetchedMapDefault] = await Promise.all([
            BusFlowApi.getRoutes(),
            BusFlowApi.getBusTypes(),
            BusFlowApi.getAccountMembers(),
            BusFlowApi.getCustomersForSuggestions(),
            BusFlowApi.getMapDefaultView(),
          ]);
          setRoutes(fetchedRoutes);
          setBusTypes(fetchedBusTypes);
          setAccountMembers(fetchedMembers);
          setCustomers(fetchedCustomers);
          if (fetchedMapDefault) setMapDefaultView(fetchedMapDefault);
        }, { scope: 'route' });
      } catch (error) {
        console.error('Fehler beim Laden der Daten:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [activeAccountId, runWithLoading]);

  const refreshRoutes = useCallback(async () => {
    const fetched = await BusFlowApi.getRoutes();
    setRoutes(fetched);
  }, []);

  const refreshSettingsData = useCallback(async () => {
    const [fetchedBusTypes, fetchedMembers, fetchedCustomers] = await Promise.all([
      BusFlowApi.getBusTypes(),
      BusFlowApi.getAccountMembers(),
      BusFlowApi.getCustomersForSuggestions(),
    ]);
    const fetchedMapDefault = await BusFlowApi.getMapDefaultView();
    setBusTypes(fetchedBusTypes);
    setAccountMembers(fetchedMembers);
    setCustomers(fetchedCustomers);
    if (fetchedMapDefault) setMapDefaultView(fetchedMapDefault);
  }, []);

  return {
    routes, busTypes, accountMembers, customers, loading, mapDefaultView,
    setRoutes, setBusTypes, setAccountMembers, setCustomers, setMapDefaultView,
    refreshRoutes, refreshSettingsData,
  };
}
