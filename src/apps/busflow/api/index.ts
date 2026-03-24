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
  upsertMapDefaultView,
  getMapPageDefaultView,
  upsertMapPageDefaultView,
  getMapPageSettings,
  upsertMapPageSettings
} from './settings.api';
import {
  getCustomersForSuggestions
} from './customers.api';
import {
  createCustomerContactWithCompany,
  deleteCustomerContact,
  getCustomerContacts,
  getCustomerContactsList,
  updateCustomerContact
} from './contacts.api';
import {
  commitCustomerImport,
  importCustomersPreview
} from './import.api';
import { setActiveAccountId } from './shared';

export const DizpoApi = {
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
  getCustomersForSuggestions,
  getCustomerContactsList,
  getCustomerContacts,
  createCustomerContactWithCompany,
  updateCustomerContact,
  deleteCustomerContact,
  importCustomersPreview,
  commitCustomerImport,
  getMapDefaultView,
  upsertMapDefaultView,
  getMapPageDefaultView,
  upsertMapPageDefaultView,
  getMapPageSettings,
  upsertMapPageSettings
};
