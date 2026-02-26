import React, { useState } from 'react';
import { Plus, Printer, Settings as SettingsIcon, Leaf, Search, History, Calendar } from 'lucide-react';
import BackToOverviewButton from '../../shared/components/BackToOverviewButton';
import RouteEditor from './components/RouteEditor';
import RouteList from './components/RouteList';
import PrintPreview from './components/PrintPreview';
import Settings from './components/Settings';
import { CustomerContactFormPayload } from './components/CustomerEditDialog';
import AppHeader from '../../shared/components/AppHeader';
import ConfirmDialog from '../../shared/components/ConfirmDialog';
import {
  BusType,
  CustomerBulkDeleteResult,
  CustomerImportPreview,
  CustomerImportRow,
  CustomerImportResult,
  CustomerContactListParams,
  CustomerContactListResult,
  MapDefaultView,
  Route,
  Worker
} from './types';
import { BusFlowApi } from './api';
import { useToast } from '../../shared/components/ToastProvider';
import { useBusflowData } from './hooks/useBusflowData';
import { useRealtimeSync } from './hooks/useRealtimeSync';
import { useRouteFiltering } from './hooks/useRouteFiltering';
import { getErrorCode, getErrorMessage } from '../../shared/lib/error-mapping';

interface User {
  name: string;
  role: 'ADMIN' | 'DISPATCH' | 'VIEWER';
  avatarUrl?: string;
  isPlatformOwner?: boolean;
}

interface Props {
  authUser: User | null;
  activeAccountId: string | null;
  onProfile: () => void;
  onLogout: () => void;
  onGoHome: () => void;
  onAdmin: () => void;
  onOwner?: () => void;
}

const BusflowApp: React.FC<Props> = ({ authUser, activeAccountId, onProfile, onLogout, onGoHome, onAdmin, onOwner }) => {
  const { pushToast, clearToasts } = useToast();

  const [view, setView] = useState<'LIST' | 'EDITOR' | 'PRINT' | 'SETTINGS'>('LIST');
  const [currentRoute, setCurrentRoute] = useState<Route | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [routeIdToDelete, setRouteIdToDelete] = useState<string | null>(null);
  const [editConflictMessage, setEditConflictMessage] = useState<string | null>(null);
  const [isNewRouteDraft, setIsNewRouteDraft] = useState(false);

  const canManageRoutes = authUser?.role === 'ADMIN' || authUser?.role === 'DISPATCH';
  const canManageSettings = canManageRoutes;

  const {
    routes, busTypes, workers, customers, loading, mapDefaultView,
    setRoutes, setCustomers, setMapDefaultView,
    refreshRoutes, refreshSettingsData,
  } = useBusflowData(activeAccountId);

  useRealtimeSync({ activeAccountId, refreshRoutes, refreshSettingsData });

  const { filteredRoutes, activeSection, otherSection, isSearching } = useRouteFiltering(routes, busTypes, searchQuery);

  // --- Route handlers ---

  const handleCreateNew = async () => {
    if (!canManageRoutes) {
      pushToast({ type: 'error', title: 'Keine Berechtigung', message: 'Sie haben nur Leserechte.' });
      return;
    }
    const newRouteDraft: Route = {
      id: `draft-${Date.now()}`,
      name: '',
      date: new Date().toISOString().split('T')[0],
      busNumber: '',
      driverName: '',
      customerId: '',
      customerName: '',
      customerContactId: undefined,
      customerContactName: '',
      capacity: 0,
      stops: [],
      status: 'Entwurf',
      operationalNotes: '',
      busTypeId: undefined,
      workerId: undefined,
    };
    setEditConflictMessage(null);
    setIsNewRouteDraft(true);
    setCurrentRoute(newRouteDraft);
    setView('EDITOR');
  };

  const handleEditRoute = (route: Route) => {
    if (!canManageRoutes) {
      pushToast({ type: 'error', title: 'Keine Berechtigung', message: 'Sie haben nur Leserechte.' });
      return;
    }
    setEditConflictMessage(null);
    setIsNewRouteDraft(false);
    setCurrentRoute(route);
    setView('EDITOR');
  };

  const handlePrintRoute = (route: Route) => {
    clearToasts();
    setCurrentRoute(route);
    setView('PRINT');
    setTimeout(() => window.print(), 300);
  };

  const handleSaveRoute = async (updatedRoute: Route) => {
    if (!canManageRoutes) {
      pushToast({ type: 'error', title: 'Keine Berechtigung', message: 'Sie haben nur Leserechte.' });
      return;
    }
    try {
      setEditConflictMessage(null);
      if (isNewRouteDraft) {
        const { id: _draftId, updatedAt: _draftUpdatedAt, ...createPayload } = updatedRoute;
        const created = await BusFlowApi.createRoute(createPayload);
        await BusFlowApi.saveRouteWithStops(
          { ...updatedRoute, id: created.id, updatedAt: created.updatedAt },
          created.updatedAt
        );
      } else {
        await BusFlowApi.saveRouteWithStops(updatedRoute, updatedRoute.updatedAt);
      }
      await refreshRoutes();
      setIsNewRouteDraft(false);
      setView('LIST');
      pushToast({ type: 'success', title: 'Gespeichert', message: 'Routenänderungen wurden gespeichert.' });
    } catch (error) {
      console.error(error);
      if (getErrorCode(error) === 'ROUTE_CONFLICT') {
        const fetched = await BusFlowApi.getRoutes();
        setRoutes(fetched);
        const latestRoute = fetched.find(r => r.id === updatedRoute.id) || null;
        if (latestRoute) {
          setCurrentRoute(latestRoute);
          setEditConflictMessage('Die Route wurde von einem anderen Benutzer geändert. Die neuesten Daten wurden geladen.');
          setView('EDITOR');
          return;
        }
        setEditConflictMessage(null);
        setView('LIST');
        return;
      }
      const errorToasts: Record<string, { title: string; message: string }> = {
        ROUTE_NOT_FOUND: { title: 'Nicht gefunden', message: 'Diese Route wurde bereits gelöscht.' },
        CUSTOMER_REQUIRED: { title: 'Kunde erforderlich', message: 'Bitte wählen Sie einen Kunden aus der Liste aus.' },
        CUSTOMER_CONTACT_MISMATCH: { title: 'Kontakt passt nicht', message: 'Der ausgewählte Kontakt gehört nicht zum gewählten Kunden.' },
        CONTACT_NOT_FOUND: { title: 'Kontakt nicht gefunden', message: 'Bitte wählen Sie die Kontaktperson erneut aus.' },
        WORKER_NOT_FOUND: { title: 'Fahrer ungültig', message: 'Der ausgewählte Fahrer gehört nicht zu Ihrem Account.' },
        WORKER_ACCOUNT_MISMATCH: { title: 'Fahrer ungültig', message: 'Der ausgewählte Fahrer gehört nicht zu Ihrem Account.' },
        BUS_TYPE_NOT_FOUND: { title: 'Bustyp ungültig', message: 'Der ausgewählte Bustyp gehört nicht zu Ihrem Account.' },
        BUS_TYPE_ACCOUNT_MISMATCH: { title: 'Bustyp ungültig', message: 'Der ausgewählte Bustyp gehört nicht zu Ihrem Account.' },
      };
      const code = getErrorCode(error);
      if (code && errorToasts[code]) {
        pushToast({ type: 'error', ...errorToasts[code] });
        if (code === 'ROUTE_NOT_FOUND') {
          await refreshRoutes();
          setView('LIST');
        }
        return;
      }
      pushToast({ type: 'error', title: 'Speichern fehlgeschlagen', message: 'Bitte versuchen Sie es erneut.' });
    }
  };

  const handleDeleteRoute = (id: string) => {
    if (!canManageRoutes) {
      pushToast({ type: 'error', title: 'Keine Berechtigung', message: 'Sie haben nur Leserechte.' });
      return;
    }
    setRouteIdToDelete(id);
  };

  const handleConfirmDeleteRoute = async () => {
    if (!routeIdToDelete) return;
    try {
      await BusFlowApi.deleteRoute(routeIdToDelete);
      setRoutes(prev => prev.filter(r => r.id !== routeIdToDelete));
      setRouteIdToDelete(null);
      pushToast({ type: 'success', title: 'Gelöscht', message: 'Die Route wurde gelöscht.' });
    } catch (error) {
      if (getErrorCode(error) === 'ROUTE_NOT_FOUND') {
        setRouteIdToDelete(null);
        await refreshRoutes();
        pushToast({ type: 'error', title: 'Nicht gefunden', message: 'Diese Route wurde bereits gelöscht.' });
        return;
      }
      console.error(error);
      pushToast({ type: 'error', title: 'Löschen fehlgeschlagen', message: 'Die Route konnte nicht gelöscht werden.' });
    }
  };

  // --- Settings handlers ---

  const requireSettings = (): boolean => {
    if (!canManageSettings) {
      pushToast({ type: 'error', title: 'Keine Berechtigung', message: 'Sie haben keine Berechtigung für Einstellungen.' });
      return false;
    }
    return true;
  };

  const handleAddBusType = async (busType: BusType) => {
    if (!requireSettings()) return;
    try {
      await BusFlowApi.createBusType(busType);
      await refreshSettingsData();
      pushToast({ type: 'success', title: 'Gespeichert', message: 'Bustyp wurde gespeichert.' });
    } catch {
      pushToast({ type: 'error', title: 'Speichern fehlgeschlagen', message: 'Bustyp konnte nicht gespeichert werden.' });
    }
  };

  const handleRemoveBusType = async (id: string) => {
    if (!requireSettings()) return;
    try {
      await BusFlowApi.deleteBusType(id);
      await refreshSettingsData();
      pushToast({ type: 'success', title: 'Gelöscht', message: 'Bustyp wurde entfernt.' });
    } catch (error) {
      const code = getErrorCode(error);
      if (code === 'BUS_TYPE_IN_USE') {
        pushToast({ type: 'error', title: 'Löschen nicht möglich', message: 'Bustyp kann nicht gelöscht werden, da noch Routen zugeordnet sind.' });
        return;
      }
      if (code === 'BUS_TYPE_NOT_FOUND') {
        pushToast({ type: 'error', title: 'Nicht gefunden', message: 'Der Bustyp wurde bereits gelöscht.' });
        await refreshSettingsData();
        return;
      }
      pushToast({ type: 'error', title: 'Löschen fehlgeschlagen', message: 'Bustyp konnte nicht gelöscht werden.' });
    }
  };

  const handleAddWorker = async (worker: Worker) => {
    if (!requireSettings()) return;
    try {
      await BusFlowApi.createWorker({ name: worker.name, role: worker.role });
      await refreshSettingsData();
      pushToast({ type: 'success', title: 'Gespeichert', message: 'Mitarbeiter wurde gespeichert.' });
    } catch {
      pushToast({ type: 'error', title: 'Speichern fehlgeschlagen', message: 'Mitarbeiter konnte nicht gespeichert werden.' });
    }
  };

  const handleRemoveWorker = async (id: string) => {
    if (!requireSettings()) return;
    try {
      await BusFlowApi.deleteWorker(id);
      await refreshSettingsData();
      pushToast({ type: 'success', title: 'Gelöscht', message: 'Mitarbeiter wurde entfernt.' });
    } catch (error) {
      const code = getErrorCode(error);
      if (code === 'WORKER_IN_USE') {
        pushToast({ type: 'error', title: 'Löschen nicht möglich', message: 'Mitarbeiter kann nicht gelöscht werden, da noch Routen zugeordnet sind.' });
        return;
      }
      if (code === 'WORKER_NOT_FOUND') {
        pushToast({ type: 'error', title: 'Nicht gefunden', message: 'Der Mitarbeiter wurde bereits gelöscht.' });
        await refreshSettingsData();
        return;
      }
      pushToast({ type: 'error', title: 'Löschen fehlgeschlagen', message: 'Mitarbeiter konnte nicht gelöscht werden.' });
    }
  };

  const handleAddCustomerContact = async (contact: CustomerContactFormPayload) => {
    if (!requireSettings()) return;
    try {
      await BusFlowApi.createCustomerContactWithCompany(contact);
      const fetched = await BusFlowApi.getCustomersForSuggestions();
      setCustomers(fetched);
      pushToast({ type: 'success', title: 'Gespeichert', message: 'Kontakt wurde gespeichert.' });
    } catch (error) {
      pushToast({ type: 'error', title: 'Speichern fehlgeschlagen', message: `Kontakt konnte nicht gespeichert werden.${getErrorMessage(error) ? ` ${getErrorMessage(error)}` : ''}` });
    }
  };

  const handleRemoveCustomerContact = async (contactId: string) => {
    if (!requireSettings()) return;
    try {
      await BusFlowApi.deleteCustomerContact(contactId);
      const fetched = await BusFlowApi.getCustomersForSuggestions();
      setCustomers(fetched);
      pushToast({ type: 'success', title: 'Gelöscht', message: 'Kontakt wurde entfernt.' });
    } catch (error) {
      if (getErrorCode(error) === 'CONTACT_IN_USE') {
        pushToast({ type: 'error', title: 'Löschen nicht möglich', message: 'Kontakt kann nicht gelöscht werden, da noch Routen zugeordnet sind.' });
        return;
      }
      if (getErrorCode(error) === 'CONTACT_NOT_FOUND') {
        pushToast({ type: 'error', title: 'Nicht gefunden', message: 'Der Kontakt wurde bereits gelöscht.' });
        const fetched = await BusFlowApi.getCustomersForSuggestions();
        setCustomers(fetched);
        return;
      }
      pushToast({ type: 'error', title: 'Löschen fehlgeschlagen', message: 'Kontakt konnte nicht gelöscht werden.' });
    }
  };

  const handleFetchCustomerContacts = async (params: CustomerContactListParams): Promise<CustomerContactListResult> => {
    return BusFlowApi.getCustomerContactsList(params);
  };

  const handleUpdateCustomerContact = async (id: string, patch: CustomerContactFormPayload) => {
    if (!requireSettings()) return;
    try {
      await BusFlowApi.updateCustomerContact(id, patch);
      const fetched = await BusFlowApi.getCustomersForSuggestions();
      setCustomers(fetched);
      pushToast({ type: 'success', title: 'Gespeichert', message: 'Kontakt wurde aktualisiert.' });
    } catch (error) {
      pushToast({ type: 'error', title: 'Speichern fehlgeschlagen', message: `Kontakt konnte nicht aktualisiert werden.${getErrorMessage(error) ? ` ${getErrorMessage(error)}` : ''}` });
      throw error;
    }
  };

  const handlePreviewCustomerImport = async (rows: CustomerImportRow[]): Promise<CustomerImportPreview> => {
    if (!canManageSettings) {
      pushToast({ type: 'error', title: 'Keine Berechtigung', message: 'Sie haben keine Berechtigung für Einstellungen.' });
      return { rows: [], conflicts: [], errors: rows.map(row => ({ rowNumber: row.rowNumber, reason: 'Keine Berechtigung' })) };
    }
    try {
      return await BusFlowApi.importCustomersPreview(rows);
    } catch (error) {
      pushToast({ type: 'error', title: 'Import-Vorschau fehlgeschlagen', message: `CSV konnte nicht geprüft werden.${getErrorMessage(error) ? ` ${getErrorMessage(error)}` : ''}` });
      return { rows: [], conflicts: [], errors: rows.map(row => ({ rowNumber: row.rowNumber, reason: 'Vorschau fehlgeschlagen.' })) };
    }
  };

  const handleCommitCustomerImport = async (
    preview: CustomerImportPreview,
    resolutions: Record<number, 'import' | 'skip'>,
    onProgress?: (progress: { current: number; total: number }) => void
  ): Promise<CustomerImportResult> => {
    if (!canManageSettings) {
      pushToast({ type: 'error', title: 'Keine Berechtigung', message: 'Sie haben keine Berechtigung für Einstellungen.' });
      return { insertedCompanies: 0, insertedContacts: 0, updatedContacts: 0, skipped: preview.rows.length, conflicts: preview.conflicts.length, errors: preview.rows.map(row => ({ rowNumber: row.rowNumber, reason: 'Keine Berechtigung' })) };
    }
    try {
      const result = await BusFlowApi.commitCustomerImport(preview, resolutions, onProgress);
      const fetched = await BusFlowApi.getCustomersForSuggestions();
      setCustomers(fetched);
      pushToast({ type: 'success', title: 'Import abgeschlossen', message: `Firmen: +${result.insertedCompanies}, Kontakte: +${result.insertedContacts}, Updates: ${result.updatedContacts}.` });
      return result;
    } catch (error) {
      pushToast({ type: 'error', title: 'Import fehlgeschlagen', message: `Kunden konnten nicht importiert werden.${getErrorMessage(error) ? ` ${getErrorMessage(error)}` : ''}` });
      return { insertedCompanies: 0, insertedContacts: 0, updatedContacts: 0, skipped: preview.rows.length, conflicts: preview.conflicts.length, errors: preview.rows.map(row => ({ rowNumber: row.rowNumber, reason: 'Import fehlgeschlagen.' })) };
    }
  };

  const handleBulkRemoveCustomerContacts = async (
    items: Array<{ id: string; name: string; companyName: string }>,
    onProgress?: (progress: { current: number; total: number }) => void
  ): Promise<CustomerBulkDeleteResult> => {
    if (!canManageSettings) {
      pushToast({ type: 'error', title: 'Keine Berechtigung', message: 'Sie haben keine Berechtigung für Einstellungen.' });
      return { requested: items.length, deleted: 0, failed: items.map(i => ({ id: i.id, name: i.name, companyName: i.companyName, reason: 'Keine Berechtigung' })) };
    }
    const failed: CustomerBulkDeleteResult['failed'] = [];
    let deleted = 0;
    let processed = 0;
    onProgress?.({ current: 0, total: items.length });
    for (const item of items) {
      try {
        await BusFlowApi.deleteCustomerContact(item.id);
        deleted += 1;
      } catch (error) {
        const errorCode = getErrorCode(error);
        failed.push({ id: item.id, name: item.name, companyName: item.companyName, code: errorCode || 'UNKNOWN', reason: errorCode === 'CONTACT_IN_USE' ? 'Kontakt ist noch in Routen verknüpft.' : getErrorMessage(error) || 'Unbekannter Fehler beim Löschen.' });
      }
      processed += 1;
      onProgress?.({ current: processed, total: items.length });
    }
    const fetched = await BusFlowApi.getCustomersForSuggestions();
    setCustomers(fetched);
    if (deleted > 0 && failed.length === 0) {
      pushToast({ type: 'success', title: 'Gelöscht', message: `${deleted} Kontakt(e) wurden gelöscht.` });
    } else if (deleted > 0 && failed.length > 0) {
      pushToast({ type: 'info', title: 'Teilweise gelöscht', message: `${deleted} gelöscht, ${failed.length} fehlgeschlagen.` });
    } else {
      pushToast({ type: 'error', title: 'Löschen fehlgeschlagen', message: 'Kein ausgewählter Kontakt konnte gelöscht werden.' });
    }
    return { requested: items.length, deleted, failed };
  };

  const handleSaveMapDefaultView = async (mapView: MapDefaultView) => {
    if (!requireSettings()) return;
    try {
      await BusFlowApi.upsertMapDefaultView(mapView);
      setMapDefaultView(mapView);
      pushToast({ type: 'success', title: 'Gespeichert', message: 'Karten-Standard wurde gespeichert.' });
    } catch {
      pushToast({ type: 'error', title: 'Speichern fehlgeschlagen', message: 'Karten-Standard konnte nicht gespeichert werden.' });
    }
  };

  // --- Render ---

  const SearchInput = (
    <div className="relative w-full max-w-md">
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
        <Search className="h-4 w-4 text-slate-400" />
      </div>
      <input
        type="text"
        placeholder="Suche (Name, Kunde, Datum, Status...)"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="block w-full pl-10 pr-3 py-1.5 border border-slate-600 rounded-md leading-5 bg-slate-800 text-slate-100 placeholder-slate-400 focus:outline-none focus:bg-slate-700 focus:border-slate-500 sm:text-sm transition-colors"
      />
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <Leaf className="w-8 h-8 animate-spin text-emerald-600" />
          <p className="text-slate-500">Lade BusFlow Daten...</p>
        </div>
      </div>
    );
  }

  if (!activeAccountId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="bg-white border border-slate-200 rounded-xl p-6 text-center">
          <h2 className="text-lg font-bold text-slate-900 mb-2">Kein Account zugewiesen</h2>
          <p className="text-sm text-slate-600">Ihr Benutzer hat noch keinen aktiven Mandanten. Bitte Administrator kontaktieren.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <ConfirmDialog
        isOpen={!!routeIdToDelete}
        title="Fahrt löschen"
        message="Möchtest du diese Fahrt wirklich löschen?"
        confirmText="Löschen"
        cancelText="Nein"
        type="danger"
        cancelButtonClassName="px-4 py-2 bg-emerald-600 text-white hover:bg-emerald-700 rounded-lg font-semibold transition-colors"
        confirmButtonClassName="px-4 py-2 bg-red-600 text-white hover:bg-red-700 rounded-lg font-bold shadow-sm transition-colors"
        onConfirm={handleConfirmDeleteRoute}
        onCancel={() => setRouteIdToDelete(null)}
      />
      <AppHeader
        title="BusPilot Routenplanung"
        user={view === 'EDITOR' ? null : authUser}
        onHome={onGoHome}
        onProfile={onProfile}
        onAdmin={onAdmin}
        onOwner={onOwner}
        onLogout={onLogout}
        searchBar={view === 'LIST' ? SearchInput : undefined}
        actions={view === 'LIST' && canManageSettings ? (
          <button
            onClick={() => setView('SETTINGS')}
            className="flex items-center space-x-1 px-3 py-1.5 rounded-md transition-colors hover:bg-slate-800"
          >
            <SettingsIcon className="w-4 h-4" />
            <span>Einstellungen</span>
          </button>
        ) : undefined}
      />

      <main className="flex-1 p-4 md:p-8 no-print max-w-7xl mx-auto w-full">
        {view === 'LIST' && (
          <div className="space-y-12">
            {isSearching ? (
              <div className="space-y-4">
                <div className="flex items-center space-x-2 border-b border-slate-200 pb-2">
                  <Search className="w-5 h-5 text-blue-600" />
                  <h2 className="text-xl font-bold text-slate-800">Suchergebnisse</h2>
                  <span className="bg-blue-100 text-blue-700 text-xs font-semibold px-2 py-0.5 rounded-full">{filteredRoutes.length}</span>
                </div>
                {filteredRoutes.length > 0 ? (
                  <RouteList routes={filteredRoutes} busTypes={busTypes} onEdit={handleEditRoute} onPrint={handlePrintRoute} onDelete={handleDeleteRoute} canManageRoutes={canManageRoutes} />
                ) : (
                  <div className="text-center py-10 bg-slate-50 rounded-lg border border-dashed border-slate-300">
                    <p className="text-slate-500">Keine Routen gefunden für "{searchQuery}".</p>
                  </div>
                )}
              </div>
            ) : (
              <>
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <div className="flex items-center space-x-2">
                      <Calendar className="w-5 h-5 text-emerald-600" />
                      <h2 className="text-xl font-bold text-slate-800">Aktive Routen</h2>
                      <span className="bg-emerald-100 text-emerald-700 text-xs font-semibold px-2 py-0.5 rounded-full">{activeSection.length}</span>
                    </div>
                    <button
                      disabled={!canManageRoutes}
                      onClick={handleCreateNew}
                      className={`flex items-center space-x-1 px-4 py-1.5 rounded-md whitespace-nowrap shadow-sm ${canManageRoutes ? 'bg-blue-600 hover:bg-blue-500 text-white transition-colors' : 'bg-slate-300 text-slate-500 cursor-not-allowed'}`}
                    >
                      <Plus className="w-4 h-4" />
                      <span>Route erstellen</span>
                    </button>
                  </div>
                  {activeSection.length > 0 ? (
                    <RouteList routes={activeSection} busTypes={busTypes} onEdit={handleEditRoute} onPrint={handlePrintRoute} onDelete={handleDeleteRoute} canManageRoutes={canManageRoutes} />
                  ) : (
                    <div className="text-center py-10 bg-slate-50 rounded-lg border border-dashed border-slate-300">
                      <p className="text-slate-500">Keine aktiven Routen.</p>
                    </div>
                  )}
                </div>

                <div className="space-y-4 opacity-75 hover:opacity-100 transition-opacity">
                  <div className="flex items-center space-x-2 border-b border-slate-200 pb-2">
                    <History className="w-5 h-5 text-slate-500" />
                    <h2 className="text-xl font-bold text-slate-700">Andere (Geplant, Entwurf, Archiv)</h2>
                    <span className="bg-slate-100 text-slate-600 text-xs font-semibold px-2 py-0.5 rounded-full">{otherSection.length}</span>
                  </div>
                  {otherSection.length > 0 ? (
                    <RouteList routes={otherSection} busTypes={busTypes} onEdit={handleEditRoute} onPrint={handlePrintRoute} onDelete={handleDeleteRoute} canManageRoutes={canManageRoutes} />
                  ) : (
                    <div className="text-center py-6">
                      <p className="text-slate-400 text-sm">Keine weiteren Routen.</p>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {view === 'EDITOR' && currentRoute && (
          <div className="space-y-6">
            <BackToOverviewButton onClick={() => setView('LIST')} />
            {editConflictMessage && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                <p className="text-sm text-amber-900 font-medium">{editConflictMessage}</p>
              </div>
            )}
            <RouteEditor
              key={`${currentRoute.id}-${currentRoute.updatedAt || ''}`}
              route={currentRoute}
              onSave={handleSaveRoute}
              onCancel={() => setView('LIST')}
              busTypes={busTypes}
              workers={workers}
              customers={customers}
              mapDefaultView={mapDefaultView}
            />
          </div>
        )}

        {view === 'SETTINGS' && (
          <div className="space-y-6">
            <BackToOverviewButton onClick={() => setView('LIST')} />
            <Settings
              busTypes={busTypes}
              workers={workers}
              onAddBusType={handleAddBusType}
              onRemoveBusType={handleRemoveBusType}
              onAddWorker={handleAddWorker}
              onRemoveWorker={handleRemoveWorker}
              onAddCustomerContact={handleAddCustomerContact}
              onRemoveCustomerContact={handleRemoveCustomerContact}
              onUpdateCustomerContact={handleUpdateCustomerContact}
              onBulkRemoveCustomerContacts={handleBulkRemoveCustomerContacts}
              onFetchCustomerContacts={handleFetchCustomerContacts}
              onPreviewCustomerImport={handlePreviewCustomerImport}
              onCommitCustomerImport={handleCommitCustomerImport}
              mapDefaultView={mapDefaultView}
              onSaveMapDefaultView={handleSaveMapDefaultView}
              canManage={canManageSettings}
            />
          </div>
        )}

        {view === 'PRINT' && currentRoute && (
          <div className="flex flex-col items-center space-y-4">
            <div className="bg-white p-8 border rounded-lg shadow-sm w-full max-w-4xl opacity-50 select-none">
              <p className="text-center italic">Die Druckvorschau wird erstellt. Falls sie nicht automatisch geöffnet wurde, klicken Sie unten.</p>
            </div>
            <button onClick={() => window.print()} className="bg-slate-900 text-white px-6 py-2 rounded-lg flex items-center space-x-2">
              <Printer className="w-5 h-5" />
              <span>Druckdialog öffnen</span>
            </button>
            <button onClick={() => setView('LIST')} className="text-blue-600">Zurück zur App</button>
          </div>
        )}
      </main>

      <div className="print-only">
        {currentRoute && <PrintPreview route={currentRoute} busTypes={busTypes} />}
      </div>
    </div>
  );
};

export default BusflowApp;
