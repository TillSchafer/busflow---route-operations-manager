import {
  completeRoute,
  createRoute,
  deleteRoute,
  getRoutes,
  saveRouteWithStops
} from './routes.api';
import {
  createBusType,
  deleteBusType,
  getAccountMembers,
  getBusTypes,
  getMapDefaultView,
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
  completeRoute,
  deleteRoute,
  getBusTypes,
  createBusType,
  deleteBusType,
  getAccountMembers,
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
