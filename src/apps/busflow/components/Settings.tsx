import React from 'react';
import { BusType, MapDefaultView, CustomerImportResult, CustomerImportPreview, CustomerImportRow, CustomerContactListParams, CustomerContactListResult, CustomerBulkDeleteResult } from '../types';
import type { CustomerContactFormPayload } from './CustomerEditDialog';
import MapDefaultViewPanel from './settings/MapDefaultViewPanel';
import BusTypePanel from './settings/BusTypePanel';
import CustomerManagementPanel from './settings/CustomerManagementPanel';

interface Props {
  busTypes: BusType[];
  onAddBusType: (busType: BusType) => Promise<void>;
  onRemoveBusType: (id: string) => Promise<void>;
  onAddCustomerContact: (contact: CustomerContactFormPayload) => Promise<void>;
  onRemoveCustomerContact: (contactId: string) => Promise<void>;
  onUpdateCustomerContact: (contactId: string, patch: CustomerContactFormPayload) => Promise<void>;
  onBulkRemoveCustomerContacts: (
    items: Array<{ id: string; name: string; companyName: string }>,
    onProgress?: (progress: { current: number; total: number }) => void
  ) => Promise<CustomerBulkDeleteResult>;
  onFetchCustomerContacts: (params: CustomerContactListParams) => Promise<CustomerContactListResult>;
  onPreviewCustomerImport: (rows: CustomerImportRow[]) => Promise<CustomerImportPreview>;
  onCommitCustomerImport: (
    preview: CustomerImportPreview,
    resolutions: Record<number, 'import' | 'skip'>,
    onProgress?: (progress: { current: number; total: number }) => void
  ) => Promise<CustomerImportResult>;
  mapDefaultView: MapDefaultView;
  onSaveMapDefaultView: (view: MapDefaultView) => Promise<void>;
  canManage?: boolean;
}

const Settings: React.FC<Props> = ({
  busTypes,
  onAddBusType,
  onRemoveBusType,
  onAddCustomerContact,
  onRemoveCustomerContact,
  onUpdateCustomerContact,
  onBulkRemoveCustomerContacts,
  onFetchCustomerContacts,
  onPreviewCustomerImport,
  onCommitCustomerImport,
  mapDefaultView,
  onSaveMapDefaultView,
  canManage = true
}) => {
  return (
    <div className="space-y-10">
      <MapDefaultViewPanel
        mapDefaultView={mapDefaultView}
        onSaveMapDefaultView={onSaveMapDefaultView}
        canManage={canManage}
      />
      <BusTypePanel
        busTypes={busTypes}
        onAddBusType={onAddBusType}
        onRemoveBusType={onRemoveBusType}
        canManage={canManage}
      />
      <CustomerManagementPanel
        onAddCustomerContact={onAddCustomerContact}
        onRemoveCustomerContact={onRemoveCustomerContact}
        onUpdateCustomerContact={onUpdateCustomerContact}
        onBulkRemoveCustomerContacts={onBulkRemoveCustomerContacts}
        onFetchCustomerContacts={onFetchCustomerContacts}
        onPreviewCustomerImport={onPreviewCustomerImport}
        onCommitCustomerImport={onCommitCustomerImport}
        canManage={canManage}
      />
    </div>
  );
};

export default Settings;
