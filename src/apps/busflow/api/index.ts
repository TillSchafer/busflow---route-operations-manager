import {
  createRoute,
  deleteRoute,
  getRoutes,
  saveRouteWithStops
} from './routes.api';
import {
  createBusType,
  createWorker,
  deleteBusType,
  deleteWorker,
  getBusTypes,
  getMapDefaultView,
  getWorkers,
  upsertMapDefaultView
} from './settings.api';
import {
  createCustomer,
  deleteCustomer,
  getCustomers,
  getCustomersForSuggestions,
  updateCustomer
} from './customers.api';
import {
  createCustomerContactWithCompany,
  deleteCustomerContact,
  getCustomerContacts,
  getCustomerContactsList,
  updateCustomerContact,
  upsertCustomerContact
} from './contacts.api';
import {
  commitCustomerImport,
  importCustomersPreview
} from './import.api';
import { setActiveAccountId } from './shared';

export const BusFlowApi = {
  setActiveAccountId,
  getRoutes,
  createRoute,
  saveRouteWithStops,
  deleteRoute,
  getBusTypes,
  createBusType,
  deleteBusType,
  getWorkers,
  createWorker,
  deleteWorker,
  getCustomers,
  getCustomersForSuggestions,
  getCustomerContactsList,
  getCustomerContacts,
  createCustomer,
  upsertCustomerContact,
  createCustomerContactWithCompany,
  updateCustomerContact,
  deleteCustomerContact,
  updateCustomer,
  importCustomersPreview,
  commitCustomerImport,
  deleteCustomer,
  getMapDefaultView,
  upsertMapDefaultView
};
