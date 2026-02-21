import { useState, useEffect, Dispatch, SetStateAction } from 'react';
import { BusType, Customer, MapDefaultView, Route, Worker } from '../types';
import { BusFlowApi } from '../api';

const DEFAULT_MAP_VIEW: MapDefaultView = { address: 'Deutschland', lat: 51.1657, lon: 10.4515, zoom: 6 };

export interface BusflowData {
  routes: Route[];
  busTypes: BusType[];
  workers: Worker[];
  customers: Customer[];
  loading: boolean;
  mapDefaultView: MapDefaultView;
  setRoutes: Dispatch<SetStateAction<Route[]>>;
  setBusTypes: Dispatch<SetStateAction<BusType[]>>;
  setWorkers: Dispatch<SetStateAction<Worker[]>>;
  setCustomers: Dispatch<SetStateAction<Customer[]>>;
  setMapDefaultView: Dispatch<SetStateAction<MapDefaultView>>;
  refreshRoutes: () => Promise<void>;
  refreshSettingsData: () => Promise<void>;
}

export function useBusflowData(activeAccountId: string | null): BusflowData {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [busTypes, setBusTypes] = useState<BusType[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
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
      setWorkers([]);
      setCustomers([]);
      setLoading(false);
      return;
    }

    const loadData = async () => {
      setLoading(true);
      try {
        const [fetchedRoutes, fetchedBusTypes, fetchedWorkers, fetchedCustomers] = await Promise.all([
          BusFlowApi.getRoutes(),
          BusFlowApi.getBusTypes(),
          BusFlowApi.getWorkers(),
          BusFlowApi.getCustomersForSuggestions(),
        ]);
        const fetchedMapDefault = await BusFlowApi.getMapDefaultView();
        setRoutes(fetchedRoutes);
        setBusTypes(fetchedBusTypes);
        setWorkers(fetchedWorkers);
        setCustomers(fetchedCustomers);
        if (fetchedMapDefault) setMapDefaultView(fetchedMapDefault);
      } catch (error) {
        console.error('Fehler beim Laden der Daten:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [activeAccountId]);

  const refreshRoutes = async () => {
    const fetched = await BusFlowApi.getRoutes();
    setRoutes(fetched);
  };

  const refreshSettingsData = async () => {
    const [fetchedBusTypes, fetchedWorkers, fetchedCustomers] = await Promise.all([
      BusFlowApi.getBusTypes(),
      BusFlowApi.getWorkers(),
      BusFlowApi.getCustomersForSuggestions(),
    ]);
    const fetchedMapDefault = await BusFlowApi.getMapDefaultView();
    setBusTypes(fetchedBusTypes);
    setWorkers(fetchedWorkers);
    setCustomers(fetchedCustomers);
    if (fetchedMapDefault) setMapDefaultView(fetchedMapDefault);
  };

  return {
    routes, busTypes, workers, customers, loading, mapDefaultView,
    setRoutes, setBusTypes, setWorkers, setCustomers, setMapDefaultView,
    refreshRoutes, refreshSettingsData,
  };
}
