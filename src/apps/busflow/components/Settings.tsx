import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  BusType,
  Worker,
  CustomerContactListItem,
  MapDefaultView,
  CustomerImportResult,
  CustomerImportPreview,
  CustomerImportRow,
  CustomerContactListParams,
  CustomerContactListResult,
  CustomerBulkDeleteResult
} from '../types';
import { Plus, Trash2, Upload, Search, Loader2, Pencil, ChevronLeft, ChevronRight } from 'lucide-react';
import { useToast } from '../../../shared/components/ToastProvider';
import { useProgress } from '../../../shared/components/ProgressProvider';
import { useStableScroll } from '../../../shared/hooks/useStableScroll';
import { parseCustomerCsv } from '../utils/customerCsv';
import CustomerEditDialog, { CustomerContactFormPayload } from './CustomerEditDialog';
import CustomerImportReportDialog from './CustomerImportReportDialog';
import CustomerBulkDeleteConfirmDialog from './CustomerBulkDeleteConfirmDialog';
import CustomerBulkDeleteReportDialog from './CustomerBulkDeleteReportDialog';
import CustomerImportConflictDialog from './CustomerImportConflictDialog';

interface Props {
  busTypes: BusType[];
  workers: Worker[];
  onAddBusType: (busType: BusType) => void;
  onRemoveBusType: (id: string) => void;
  onAddWorker: (worker: Worker) => void;
  onRemoveWorker: (id: string) => void;
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
  onSaveMapDefaultView: (view: MapDefaultView) => void;
  canManage?: boolean;
}

const CUSTOMER_PAGE_SIZE = 25;

const Settings: React.FC<Props> = ({
  busTypes,
  workers,
  onAddBusType,
  onRemoveBusType,
  onAddWorker,
  onRemoveWorker,
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
  const { pushToast } = useToast();
  const { startProgress, updateProgress, finishProgress } = useProgress();
  const { beginStableScroll, requestRestore, cancelRestore } = useStableScroll();
  const [busTypeName, setBusTypeName] = useState('');
  const [busTypeCapacity, setBusTypeCapacity] = useState(50);
  const [busTypeNotes, setBusTypeNotes] = useState('');
  const [workerName, setWorkerName] = useState('');
  const [workerRole, setWorkerRole] = useState('');

  const [customerRows, setCustomerRows] = useState<CustomerContactListItem[]>([]);
  const [customerTotal, setCustomerTotal] = useState(0);
  const [customersLoading, setCustomersLoading] = useState(false);
  const [customerPage, setCustomerPage] = useState(1);
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [debouncedCustomerSearchQuery, setDebouncedCustomerSearchQuery] = useState('');
  const [isCustomerSaving, setIsCustomerSaving] = useState(false);
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<string[]>([]);
  const [isBulkDeleteConfirmOpen, setIsBulkDeleteConfirmOpen] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [bulkDeleteReport, setBulkDeleteReport] = useState<CustomerBulkDeleteResult | null>(null);
  const [isBulkDeleteReportOpen, setIsBulkDeleteReportOpen] = useState(false);
  const [isDeleteOverlayOpen, setIsDeleteOverlayOpen] = useState(false);
  const [deleteOverlayMode, setDeleteOverlayMode] = useState<'single' | null>(null);
  const [deleteOverlayText, setDeleteOverlayText] = useState('');

  const [isCustomerEditOpen, setIsCustomerEditOpen] = useState(false);
  const [isCustomerCreateOpen, setIsCustomerCreateOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<CustomerContactListItem | null>(null);

  const [importReport, setImportReport] = useState<CustomerImportResult | null>(null);
  const [isImportReportOpen, setIsImportReportOpen] = useState(false);
  const [importPreview, setImportPreview] = useState<CustomerImportPreview | null>(null);
  const [isImportConflictOpen, setIsImportConflictOpen] = useState(false);

  const [mapAddress, setMapAddress] = useState(mapDefaultView.address || '');
  const [mapLat, setMapLat] = useState<number>(mapDefaultView.lat);
  const [mapLon, setMapLon] = useState<number>(mapDefaultView.lon);
  const zoomToPercent = (zoom: number) => {
    const clamped = Math.min(16, Math.max(3, zoom));
    return Math.round(((clamped - 3) / (16 - 3)) * 100);
  };
  const percentToZoom = (percent: number) => {
    const clamped = Math.min(100, Math.max(0, percent));
    return Math.round(3 + ((16 - 3) * clamped) / 100);
  };
  const [mapZoomPercent, setMapZoomPercent] = useState<number>(zoomToPercent(mapDefaultView.zoom || 6));
  const [mapSuggestions, setMapSuggestions] = useState<Array<{ label: string; lat: number; lon: number }>>([]);
  const [mapSuggestionsOpen, setMapSuggestionsOpen] = useState(false);
  const searchTimeoutRef = useRef<number | null>(null);
  const searchAbortRef = useRef<AbortController | null>(null);
  const customerCsvInputRef = useRef<HTMLInputElement | null>(null);
  const [isImportingCustomers, setIsImportingCustomers] = useState(false);
  const isDeleteBusy = isDeleteOverlayOpen || isCustomerSaving;
  const pendingRestoreTokenRef = useRef<string | null>(null);
  const skipNextAutoFetchRef = useRef(false);
  const prevCustomersLoadingRef = useRef(false);

  const totalPages = Math.max(1, Math.ceil(customerTotal / CUSTOMER_PAGE_SIZE));

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedCustomerSearchQuery(customerSearchQuery.trim());
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [customerSearchQuery]);

  useEffect(() => {
    setSelectedCustomerIds([]);
  }, [customerPage, debouncedCustomerSearchQuery]);

  const loadCustomers = useCallback(async (page: number, query: string) => {
    setCustomersLoading(true);
    try {
      const result = await onFetchCustomerContacts({
        query,
        page,
        pageSize: CUSTOMER_PAGE_SIZE
      });
      setCustomerRows(result.items);
      setCustomerTotal(result.total);
      setSelectedCustomerIds([]);
    } catch (e) {
      pushToast({
        type: 'error',
        title: 'Laden fehlgeschlagen',
        message: 'Kontakte konnten nicht geladen werden.'
      });
    } finally {
      setCustomersLoading(false);
    }
  }, [onFetchCustomerContacts, pushToast]);

  useEffect(() => {
    if (skipNextAutoFetchRef.current) {
      skipNextAutoFetchRef.current = false;
      return;
    }
    loadCustomers(customerPage, debouncedCustomerSearchQuery);
  }, [loadCustomers, customerPage, debouncedCustomerSearchQuery]);

  useLayoutEffect(() => {
    const wasLoading = prevCustomersLoadingRef.current;
    if (wasLoading && !customersLoading && pendingRestoreTokenRef.current) {
      const token = pendingRestoreTokenRef.current;
      pendingRestoreTokenRef.current = null;
      requestRestore(token);
    }
    prevCustomersLoadingRef.current = customersLoading;
  }, [customersLoading, requestRestore]);

  useEffect(() => {
    return () => {
      if (pendingRestoreTokenRef.current) {
        cancelRestore(pendingRestoreTokenRef.current);
        pendingRestoreTokenRef.current = null;
      }
    };
  }, [cancelRestore]);

  useEffect(() => {
    setMapAddress(mapDefaultView.address || '');
    setMapLat(mapDefaultView.lat);
    setMapLon(mapDefaultView.lon);
    setMapZoomPercent(zoomToPercent(mapDefaultView.zoom || 6));
  }, [mapDefaultView]);

  const handleAddBusType = () => {
    if (!canManage) return;
    if (!busTypeName.trim()) return;
    onAddBusType({
      id: Date.now().toString(),
      name: busTypeName.trim(),
      capacity: Number(busTypeCapacity) || 0,
      notes: busTypeNotes.trim() || undefined
    });
    setBusTypeName('');
    setBusTypeCapacity(50);
    setBusTypeNotes('');
  };

  const handleAddWorker = () => {
    if (!canManage) return;
    if (!workerName.trim()) return;
    onAddWorker({
      id: Date.now().toString(),
      name: workerName.trim(),
      role: workerRole.trim() || undefined
    });
    setWorkerName('');
    setWorkerRole('');
  };

  const handleCustomerCreateSave = async (payload: CustomerContactFormPayload) => {
    if (!canManage) return;
    const token = beginStableScroll();
    if (token) pendingRestoreTokenRef.current = token;
    let didLoadCustomers = false;
    setIsCustomerSaving(true);
    try {
      await onAddCustomerContact(payload);
      skipNextAutoFetchRef.current = true;
      setCustomerPage(1);
      didLoadCustomers = true;
      await loadCustomers(1, debouncedCustomerSearchQuery);
    } finally {
      setIsCustomerSaving(false);
      if (token && pendingRestoreTokenRef.current === token && !didLoadCustomers) {
        pendingRestoreTokenRef.current = null;
        requestRestore(token);
      }
    }
  };

  const handleRemoveCustomer = async (contactId: string) => {
    if (!canManage) return;
    const token = beginStableScroll();
    if (token) pendingRestoreTokenRef.current = token;
    let didLoadCustomers = false;
    setIsCustomerSaving(true);
    setDeleteOverlayMode('single');
    setDeleteOverlayText('Kontakt wird gelöscht...');
    setIsDeleteOverlayOpen(true);
    try {
      await onRemoveCustomerContact(contactId);
      const nextPage = customerRows.length === 1 && customerPage > 1 ? customerPage - 1 : customerPage;
      skipNextAutoFetchRef.current = true;
      setCustomerPage(nextPage);
      didLoadCustomers = true;
      await loadCustomers(nextPage, debouncedCustomerSearchQuery);
    } finally {
      setIsCustomerSaving(false);
      setIsDeleteOverlayOpen(false);
      setDeleteOverlayMode(null);
      setDeleteOverlayText('');
      if (token && pendingRestoreTokenRef.current === token && !didLoadCustomers) {
        pendingRestoreTokenRef.current = null;
        requestRestore(token);
      }
    }
  };

  const handleToggleCustomerSelection = (id: string) => {
    setSelectedCustomerIds(prev => (
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    ));
  };

  const handleSelectAllCurrentPage = () => {
    const allIds = customerRows.map(customer => customer.contactId);
    const areAllSelected = allIds.length > 0 && allIds.every(id => selectedCustomerIds.includes(id));
    setSelectedCustomerIds(areAllSelected ? [] : allIds);
  };

  const handleRunBulkDelete = async () => {
    if (!canManage || selectedCustomerIds.length === 0) return;
    const token = beginStableScroll();
    if (token) pendingRestoreTokenRef.current = token;
    let didLoadCustomers = false;
    const items = customerRows
      .filter(customer => selectedCustomerIds.includes(customer.contactId))
      .map(customer => ({
        id: customer.contactId,
        name: customer.fullName || [customer.firstName, customer.lastName].filter(Boolean).join(' ').trim() || 'Kontakt',
        companyName: customer.companyName
      }));

    setIsBulkDeleting(true);
    setIsBulkDeleteConfirmOpen(false);
    const progressId = startProgress({
      type: 'delete_customers',
      title: 'Kontakte werden gelöscht...',
      message: 'Löschvorgang läuft im Hintergrund.',
      current: 0,
      total: items.length
    });
    try {
      const result = await onBulkRemoveCustomerContacts(items, progress => {
        updateProgress(progressId, {
          current: progress.current,
          total: progress.total,
          message: `${progress.current} von ${progress.total} verarbeitet`
        });
      });
      setBulkDeleteReport(result);
      setIsBulkDeleteReportOpen(true);
      setSelectedCustomerIds([]);
      didLoadCustomers = true;
      await loadCustomers(customerPage, debouncedCustomerSearchQuery);
    } finally {
      setIsBulkDeleting(false);
      finishProgress(progressId);
      if (token && pendingRestoreTokenRef.current === token && !didLoadCustomers) {
        pendingRestoreTokenRef.current = null;
        requestRestore(token);
      }
    }
  };

  const handleCustomerEditSave = async (id: string, patch: CustomerContactFormPayload) => {
    const token = beginStableScroll();
    if (token) pendingRestoreTokenRef.current = token;
    let didLoadCustomers = false;
    try {
      await onUpdateCustomerContact(id, patch);
      didLoadCustomers = true;
      await loadCustomers(customerPage, debouncedCustomerSearchQuery);
    } finally {
      if (token && pendingRestoreTokenRef.current === token && !didLoadCustomers) {
        pendingRestoreTokenRef.current = null;
        requestRestore(token);
      }
    }
  };

  const searchMapAddress = (query: string) => {
    const trimmed = query.trim();
    if (searchTimeoutRef.current) {
      window.clearTimeout(searchTimeoutRef.current);
    }
    if (!trimmed) {
      setMapSuggestions([]);
      return;
    }

    searchTimeoutRef.current = window.setTimeout(async () => {
      if (searchAbortRef.current) {
        searchAbortRef.current.abort();
      }
      const controller = new AbortController();
      searchAbortRef.current = controller;

      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&dedupe=1&countrycodes=de&limit=8&q=${encodeURIComponent(trimmed)}&accept-language=de`,
          { signal: controller.signal }
        );
        const result = await response.json();
        const items = (result || []).map((item: any) => ({
          label: item.display_name as string,
          lat: Number(item.lat),
          lon: Number(item.lon)
        }));
        setMapSuggestions(items);
        setMapSuggestionsOpen(true);
      } catch (error) {
        if ((error as any)?.name === 'AbortError') return;
      }
    }, 250);
  };

  const handleSaveMapDefault = () => {
    if (!canManage) return;
    if (!Number.isFinite(mapLat) || !Number.isFinite(mapLon)) {
      pushToast({
        type: 'error',
        title: 'Ungültige Adresse',
        message: 'Bitte wählen Sie eine Adresse aus den Vorschlägen.'
      });
      return;
    }
    onSaveMapDefaultView({
      address: mapAddress.trim(),
      lat: mapLat,
      lon: mapLon,
      zoom: percentToZoom(mapZoomPercent)
    });
  };

  const handleCustomerCsvUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !canManage) return;

    const token = beginStableScroll();
    if (token) pendingRestoreTokenRef.current = token;
    let didLoadCustomers = false;
    setIsImportingCustomers(true);
    const progressId = startProgress({
      type: 'import_customers',
      title: 'Kundenimport läuft...',
      message: 'CSV wird geprüft...',
      indeterminate: true
    });
    try {
      const fileContent = await file.text();
      const parsed = parseCustomerCsv(fileContent);
      if (parsed.rows.length === 0) {
        pushToast({
          type: 'error',
          title: 'Import fehlgeschlagen',
          message: parsed.errors[0]?.reason || 'Keine gültigen Kunden im CSV gefunden.'
        });
        if (token) {
          cancelRestore(token);
          pendingRestoreTokenRef.current = null;
        }
        return;
      }

      const preview = await onPreviewCustomerImport(parsed.rows);
      const mergedPreview: CustomerImportPreview = {
        ...preview,
        errors: [...preview.errors, ...parsed.errors]
      };

      if (mergedPreview.conflicts.length > 0) {
        finishProgress(progressId);
        setImportPreview(mergedPreview);
        setIsImportConflictOpen(true);
        if (token) {
          pendingRestoreTokenRef.current = null;
          requestRestore(token);
        }
      } else {
        updateProgress(progressId, {
          indeterminate: false,
          current: 0,
          total: mergedPreview.rows.length,
          message: 'Kunden werden importiert...'
        });
        const result = await onCommitCustomerImport(mergedPreview, {}, progress => {
          updateProgress(progressId, {
            current: progress.current,
            total: progress.total,
            message: `${progress.current} von ${progress.total} importiert`
          });
        });
        setImportReport(result);
        if (result.errors.length > 0) {
          setIsImportReportOpen(true);
        }
        skipNextAutoFetchRef.current = true;
        setCustomerPage(1);
        didLoadCustomers = true;
        await loadCustomers(1, debouncedCustomerSearchQuery);
      }
    } catch (error: any) {
      pushToast({
        type: 'error',
        title: 'Import fehlgeschlagen',
        message: error?.message || 'CSV konnte nicht verarbeitet werden.'
      });
    } finally {
      setIsImportingCustomers(false);
      finishProgress(progressId);
      if (token && pendingRestoreTokenRef.current === token && !didLoadCustomers) {
        pendingRestoreTokenRef.current = null;
        requestRestore(token);
      }
    }
  };

  const handleResolveImportConflicts = async (resolutions: Record<number, 'import' | 'skip'>) => {
    if (!importPreview) return;
    const token = beginStableScroll();
    if (token) pendingRestoreTokenRef.current = token;
    let didLoadCustomers = false;
    setIsImportingCustomers(true);
    const progressId = startProgress({
      type: 'import_customers',
      title: 'Kundenimport läuft...',
      message: 'Entscheidungen werden angewendet...',
      current: 0,
      total: importPreview.rows.length
    });
    try {
      const result = await onCommitCustomerImport(importPreview, resolutions, progress => {
        updateProgress(progressId, {
          current: progress.current,
          total: progress.total,
          message: `${progress.current} von ${progress.total} importiert`
        });
      });
      setImportReport(result);
      setIsImportConflictOpen(false);
      setImportPreview(null);
      if (result.errors.length > 0 || result.skipped > 0 || result.conflicts > 0) {
        setIsImportReportOpen(true);
      }
      skipNextAutoFetchRef.current = true;
      setCustomerPage(1);
      didLoadCustomers = true;
      await loadCustomers(1, debouncedCustomerSearchQuery);
    } catch (error: any) {
      pushToast({
        type: 'error',
        title: 'Import fehlgeschlagen',
        message: error?.message || 'Konflikt-Import konnte nicht abgeschlossen werden.'
      });
    } finally {
      setIsImportingCustomers(false);
      finishProgress(progressId);
      if (token && pendingRestoreTokenRef.current === token && !didLoadCustomers) {
        pendingRestoreTokenRef.current = null;
        requestRestore(token);
      }
    }
  };

  const handleDownloadCustomerCsvTemplate = () => {
    const csv = 'company_name;name;surname;mail;mobile_number;street;postcode;city;country;notes\n';
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'kunden_import_template.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <CustomerEditDialog
        isOpen={isCustomerEditOpen}
        mode="edit"
        customer={editingCustomer}
        onClose={() => {
          setIsCustomerEditOpen(false);
          setEditingCustomer(null);
        }}
        onSave={handleCustomerEditSave}
      />
      <CustomerEditDialog
        isOpen={isCustomerCreateOpen}
        mode="create"
        onClose={() => setIsCustomerCreateOpen(false)}
        onCreate={handleCustomerCreateSave}
      />
      <CustomerImportReportDialog
        isOpen={isImportReportOpen}
        report={importReport}
        onClose={() => setIsImportReportOpen(false)}
      />
      <CustomerImportConflictDialog
        isOpen={isImportConflictOpen}
        preview={importPreview}
        onClose={() => {
          setIsImportConflictOpen(false);
          setImportPreview(null);
        }}
        onConfirm={handleResolveImportConflicts}
      />
      <CustomerBulkDeleteConfirmDialog
        isOpen={isBulkDeleteConfirmOpen}
        count={selectedCustomerIds.length}
        onCancel={() => setIsBulkDeleteConfirmOpen(false)}
        onConfirm={handleRunBulkDelete}
      />
      <CustomerBulkDeleteReportDialog
        isOpen={isBulkDeleteReportOpen}
        report={bulkDeleteReport}
        onClose={() => setIsBulkDeleteReportOpen(false)}
      />
      <div className="space-y-10">
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
          <h2 className="text-xl font-bold text-slate-800 mb-1">Karten-Standard</h2>
          <p className="text-sm text-slate-500 mb-6">Diese Position wird beim Erstellen neuer Routen als Startansicht verwendet.</p>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="md:col-span-3">
              <label className="block text-sm font-semibold text-slate-700 mb-1">Standardadresse</label>
              <div className="relative">
                <input
                  type="text"
                  value={mapAddress}
                  onChange={(e) => {
                    const value = e.target.value;
                    setMapAddress(value);
                    searchMapAddress(value);
                  }}
                  onFocus={() => setMapSuggestionsOpen(true)}
                  onBlur={() => window.setTimeout(() => setMapSuggestionsOpen(false), 150)}
                  disabled={!canManage}
                  className="w-full border-slate-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2.5 bg-white border transition-all"
                  placeholder="z. B. Bövergeest 85b, 25826, Sankt.Peter-Ording"
                />
                {mapSuggestionsOpen && mapSuggestions.length > 0 && (
                  <div className="absolute z-20 mt-1 w-full rounded-lg border border-slate-200 bg-white shadow-lg overflow-hidden max-h-64 overflow-y-auto">
                    {mapSuggestions.map((option, idx) => (
                      <button
                        key={`${option.label}-${idx}`}
                        type="button"
                        onMouseDown={e => e.preventDefault()}
                        onClick={() => {
                          setMapAddress(option.label);
                          setMapLat(option.lat);
                          setMapLon(option.lon);
                          setMapSuggestionsOpen(false);
                        }}
                        className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-1">Aktuelle Koordinaten: {mapLat.toFixed(5)}, {mapLon.toFixed(5)}</p>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Zoom / Radius</label>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={mapZoomPercent}
                onChange={e => setMapZoomPercent(parseInt(e.target.value, 10) || 0)}
                disabled={!canManage}
                className="w-full accent-[#2663EB]"
              />
              <p className="text-xs text-slate-600 mt-1 font-medium">{mapZoomPercent}%</p>
              <p className="text-xs text-slate-500 mt-1">0% = weit herausgezoomt, 100% = stark hineingezoomt</p>
            </div>
            <div className="md:col-span-4">
              <button
                onClick={handleSaveMapDefault}
                disabled={!canManage}
                className="bg-[#2663EB] hover:bg-[#1f54c7] text-white px-4 py-2.5 rounded-lg font-semibold transition-colors"
              >
                Karten-Standard speichern
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
          <h2 className="text-xl font-bold text-slate-800 mb-1">Bustypen</h2>
          <p className="text-sm text-slate-500 mb-6">Vorlagen für Fahrzeugkapazität und Bezeichnungen.</p>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-slate-700 mb-1">Bustyp-Name</label>
              <input
                type="text"
                value={busTypeName}
                onChange={e => setBusTypeName(e.target.value)}
                disabled={!canManage}
                className="w-full border-slate-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2.5 bg-white border transition-all"
                placeholder="z. B. Stadtbus 40"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Kapazität</label>
              <input
                type="number"
                value={busTypeCapacity}
                onChange={e => setBusTypeCapacity(parseInt(e.target.value, 10) || 0)}
                disabled={!canManage}
                className="w-full border-slate-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2.5 bg-white border transition-all"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={handleAddBusType}
                disabled={!canManage}
                className="w-full bg-[#2663EB] hover:bg-[#1f54c7] text-white px-4 py-2.5 rounded-lg font-semibold flex items-center justify-center space-x-2 transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Bustyp hinzufügen</span>
              </button>
            </div>
            <div className="md:col-span-4">
              <label className="block text-sm font-semibold text-slate-700 mb-1">Notizen</label>
              <input
                type="text"
                value={busTypeNotes}
                onChange={e => setBusTypeNotes(e.target.value)}
                disabled={!canManage}
                className="w-full border-slate-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2.5 bg-white border transition-all"
                placeholder="Optionale Notizen"
              />
            </div>
          </div>

          <div className="space-y-3">
            {busTypes.length === 0 && (
              <p className="text-sm text-slate-400 italic">Noch keine Bustypen. Fügen Sie oben den ersten hinzu.</p>
            )}
            {busTypes.map(busType => (
              <div key={busType.id} className="flex items-center justify-between border border-slate-200 rounded-lg p-3">
                <div>
                  <p className="font-semibold text-slate-800">{busType.name}</p>
                  <p className="text-xs text-slate-500">Kapazität: {busType.capacity}</p>
                  {busType.notes && <p className="text-xs text-slate-400">{busType.notes}</p>}
                </div>
                <button
                  onClick={() => onRemoveBusType(busType.id)}
                  disabled={!canManage}
                  className={`transition-colors p-2 ${canManage ? 'text-slate-400 hover:text-red-600' : 'text-slate-300 cursor-not-allowed'}`}
                  title="Bustyp entfernen"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
          <h2 className="text-xl font-bold text-slate-800 mb-1">Mitarbeiter</h2>
          <p className="text-sm text-slate-500 mb-6">Erstellen Sie eine Liste für die Fahrerzuweisung.</p>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-slate-700 mb-1">Name</label>
              <input
                type="text"
                value={workerName}
                onChange={e => setWorkerName(e.target.value)}
                disabled={!canManage}
                className="w-full border-slate-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2.5 bg-white border transition-all"
                placeholder="z. B. Alex Schmidt"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Rolle</label>
              <input
                type="text"
                value={workerRole}
                onChange={e => setWorkerRole(e.target.value)}
                disabled={!canManage}
                className="w-full border-slate-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2.5 bg-white border transition-all"
                placeholder="Fahrer"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={handleAddWorker}
                disabled={!canManage}
                className="w-full bg-[#2663EB] hover:bg-[#1f54c7] text-white px-4 py-2.5 rounded-lg font-semibold flex items-center justify-center space-x-2 transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Mitarbeiter hinzufügen</span>
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {workers.length === 0 && (
              <p className="text-sm text-slate-400 italic">Noch keine Mitarbeiter. Fügen Sie Ihr Team oben hinzu.</p>
            )}
            {workers.map(worker => (
              <div key={worker.id} className="flex items-center justify-between border border-slate-200 rounded-lg p-3">
                <div>
                  <p className="font-semibold text-slate-800">{worker.name}</p>
                  {worker.role && <p className="text-xs text-slate-500">{worker.role}</p>}
                </div>
                <button
                  onClick={() => onRemoveWorker(worker.id)}
                  disabled={!canManage}
                  className={`transition-colors p-2 ${canManage ? 'text-slate-400 hover:text-red-600' : 'text-slate-300 cursor-not-allowed'}`}
                  title="Mitarbeiter entfernen"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 relative">
          {isDeleteOverlayOpen && (
            <div className="absolute inset-0 z-20 rounded-2xl bg-white/75 backdrop-blur-[2px] flex items-center justify-center p-6">
              <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-lg p-5 space-y-4">
                <div className="flex items-center gap-3 text-slate-700">
                  <Loader2 className="w-5 h-5 animate-spin text-[#2663EB]" />
                  <p className="font-semibold">{deleteOverlayText}</p>
                </div>
              </div>
            </div>
          )}
          <div className="flex items-start justify-between gap-4 mb-6">
            <div>
              <h2 className="text-xl font-bold text-slate-800 mb-1">Kunden</h2>
              <p className="text-sm text-slate-500">Verwalten Sie Firmen und Kontakte für die Routenerstellung.</p>
              <p className="text-xs text-slate-500 mt-2">
                CSV mit Headern, mindestens <span className="font-semibold">company_name</span>.
                <button
                  type="button"
                  onClick={handleDownloadCustomerCsvTemplate}
                  className="ml-1 text-[#2663EB] hover:text-[#1f54c7] underline underline-offset-2"
                >
                  Beispiel-CSV herunterladen
                </button>
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsCustomerCreateOpen(true)}
                disabled={!canManage || isCustomerSaving || isDeleteBusy}
                className="shrink-0 h-[42px] w-[42px] rounded-lg border border-slate-300 text-slate-600 hover:text-[#2663EB] hover:border-[#2663EB] disabled:opacity-60 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
                title="Kontakt hinzufügen"
              >
                <Plus className="w-4 h-4" />
              </button>
              <input
                ref={customerCsvInputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={handleCustomerCsvUpload}
              />
              <button
                type="button"
                onClick={() => customerCsvInputRef.current?.click()}
                disabled={!canManage || isImportingCustomers || isDeleteBusy}
                className="shrink-0 h-[42px] w-[42px] rounded-lg border border-slate-300 text-slate-600 hover:text-[#2663EB] hover:border-[#2663EB] disabled:opacity-60 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
                title="Kontakte per CSV importieren"
              >
                {isImportingCustomers ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="border border-slate-200 rounded-lg p-3 mb-4 bg-slate-50/60">
            <div className="flex items-center gap-2">
              <Search className="w-4 h-4 text-slate-500" />
              <input
                type="text"
                value={customerSearchQuery}
                onChange={e => {
                  setCustomerSearchQuery(e.target.value);
                  setCustomerPage(1);
                }}
                placeholder="Kontakte suchen (Firma, Name, E-Mail, Telefon, Stadt, Straße)"
                disabled={isDeleteBusy}
                className="w-full bg-transparent outline-none text-sm text-slate-700 placeholder:text-slate-400"
              />
            </div>
          </div>
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm text-slate-600">{selectedCustomerIds.length} ausgewählt</div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSelectAllCurrentPage}
                disabled={customersLoading || customerRows.length === 0 || isDeleteBusy || isBulkDeleting}
                className="px-3 py-1.5 rounded-md border border-slate-300 text-slate-700 text-sm disabled:opacity-50"
              >
                Alle markieren
              </button>
              <button
                type="button"
                onClick={() => setIsBulkDeleteConfirmOpen(true)}
                disabled={!canManage || selectedCustomerIds.length === 0 || isDeleteBusy || isBulkDeleting}
                className="px-3 py-1.5 rounded-md bg-red-600 hover:bg-red-700 text-white text-sm font-semibold disabled:opacity-50"
              >
                Auswahl löschen
              </button>
            </div>
          </div>

          {customersLoading ? (
            <div className="py-8 flex items-center justify-center gap-2 text-slate-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Lade Kontakte...</span>
            </div>
          ) : (
            <div className="space-y-3" style={{ overflowAnchor: 'none' }}>
              {customerRows.length === 0 && (
                <p className="text-sm text-slate-400 italic">Keine Kontakte für die aktuelle Suche.</p>
              )}
              {customerRows.map(customer => (
                <div key={customer.contactId} className="border border-slate-200 rounded-lg p-3 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 w-full">
                      <input
                        type="checkbox"
                        checked={selectedCustomerIds.includes(customer.contactId)}
                        onChange={() => handleToggleCustomerSelection(customer.contactId)}
                        disabled={!canManage || isDeleteBusy || isBulkDeleting}
                        className="mt-1 h-4 w-4 accent-[#2663EB]"
                        aria-label={`Kontakt ${customer.fullName || customer.companyName} auswählen`}
                      />
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-x-4 gap-y-1 text-sm w-full">
                      <p><span className="text-slate-500">Firmenname:</span> <span className="text-slate-800 font-semibold">{customer.companyName}</span></p>
                      <p><span className="text-slate-500">Telefon:</span> <span className="text-slate-800">{customer.phone || ''}</span></p>
                      <p><span className="text-slate-500">E-Mail:</span> <span className="text-slate-800">{customer.email || ''}</span></p>
                      <p><span className="text-slate-500">Straße:</span> <span className="text-slate-800">{customer.street || ''}</span></p>
                      <p><span className="text-slate-500">PLZ:</span> <span className="text-slate-800">{customer.postalCode || ''}</span></p>
                      <p><span className="text-slate-500">Stadt:</span> <span className="text-slate-800">{customer.city || ''}</span></p>
                      <p><span className="text-slate-500">Land:</span> <span className="text-slate-800">{customer.country || ''}</span></p>
                      <p><span className="text-slate-500">Name:</span> <span className="text-slate-800">{customer.fullName || [customer.firstName, customer.lastName].filter(Boolean).join(' ') || ''}</span></p>
                      <p><span className="text-slate-500">Notizen:</span> <span className="text-slate-800">{customer.notes || ''}</span></p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingCustomer(customer);
                          setIsCustomerEditOpen(true);
                        }}
                        disabled={!canManage || isDeleteBusy}
                        className={`p-2 rounded-md ${canManage ? 'text-slate-400 hover:text-[#2663EB]' : 'text-slate-300 cursor-not-allowed'}`}
                        title="Kontakt bearbeiten"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleRemoveCustomer(customer.contactId)}
                        disabled={!canManage || isDeleteBusy}
                        className={`p-2 rounded-md ${canManage ? 'text-slate-400 hover:text-red-600' : 'text-slate-300 cursor-not-allowed'}`}
                        title="Kontakt entfernen"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
            <span>Gesamt: {customerTotal}</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCustomerPage(prev => Math.max(1, prev - 1))}
                disabled={customerPage <= 1 || customersLoading || isDeleteBusy}
                className="px-3 py-1.5 rounded-md border border-slate-300 disabled:opacity-50 inline-flex items-center gap-1"
              >
                <ChevronLeft className="w-4 h-4" /> Zurück
              </button>
              <span>Seite {customerPage} / {totalPages}</span>
              <button
                type="button"
                onClick={() => setCustomerPage(prev => Math.min(totalPages, prev + 1))}
                disabled={customerPage >= totalPages || customersLoading || isDeleteBusy}
                className="px-3 py-1.5 rounded-md border border-slate-300 disabled:opacity-50 inline-flex items-center gap-1"
              >
                Weiter <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Settings;
