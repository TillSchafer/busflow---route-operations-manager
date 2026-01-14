
export interface Stop {
  id: string;
  location: string;
  arrivalTime: string;
  departureTime: string;
  actualArrivalTime?: string;
  actualDepartureTime?: string;
  boarding: number;
  leaving: number;
  currentTotal: number;
  lat?: number;
  lon?: number;
  notes?: string;
}

export interface Route {
  id: string;
  name: string;
  date: string;
  busNumber: string;
  driverName: string;
  capacity: number;
  stops: Stop[];
  status: 'Draft' | 'Published';
  busTypeId?: string;
  workerId?: string;
  operationalNotes?: string;
  kmStartBetrieb?: string;
  kmStartCustomer?: string;
  kmEndCustomer?: string;
  kmEndBetrieb?: string;
  totalKm?: string;
  timeReturnBetrieb?: string;
  timeReturnCustomer?: string;
}

export type RouteAction = 
  | { type: 'ADD_ROUTE'; payload: Route }
  | { type: 'UPDATE_ROUTE'; payload: Route }
  | { type: 'DELETE_ROUTE'; payload: string }
  | { type: 'SET_ROUTES'; payload: Route[] };

export interface BusType {
  id: string;
  name: string;
  capacity: number;
  notes?: string;
}

export interface Worker {
  id: string;
  name: string;
  role?: string;
}
