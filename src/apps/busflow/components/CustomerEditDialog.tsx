import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { CustomerContactListItem } from '../types';
import { useToast } from '../../../shared/components/ToastProvider';

export interface CustomerContactFormPayload {
  companyName: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  phone?: string;
  street?: string;
  postalCode?: string;
  city?: string;
  country?: string;
  email?: string;
  notes?: string;
  metadata?: Record<string, string>;
}

interface Props {
  isOpen: boolean;
  mode: 'create' | 'edit';
  customer?: CustomerContactListItem | null;
  onClose: () => void;
  onCreate?: (payload: CustomerContactFormPayload) => Promise<void>;
  onSave?: (id: string, patch: CustomerContactFormPayload) => Promise<void>;
}

const CustomerEditDialog: React.FC<Props> = ({ isOpen, mode, customer = null, onClose, onCreate, onSave }) => {
  const { pushToast } = useToast();
  const [form, setForm] = useState<Partial<CustomerContactFormPayload>>({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    if (mode === 'edit' && customer) {
      setForm({
        companyName: customer.companyName || '',
        firstName: customer.firstName || '',
        lastName: customer.lastName || '',
        fullName: customer.fullName || '',
        notes: customer.notes || '',
        phone: customer.phone || '',
        street: customer.street || '',
        postalCode: customer.postalCode || '',
        city: customer.city || '',
        country: customer.country || '',
        email: customer.email || '',
        metadata: customer.metadata || {}
      });
    } else {
      setForm({
        companyName: '',
        firstName: '',
        lastName: '',
        fullName: '',
        notes: '',
        phone: '',
        street: '',
        postalCode: '',
        city: '',
        country: '',
        email: '',
        metadata: {}
      });
    }
  }, [customer, mode, isOpen]);

  if (!isOpen) return null;
  if (mode === 'edit' && !customer) return null;

  const handleSubmit = async () => {
    const companyName = (form.companyName || '').trim();
    if (!companyName) {
      pushToast({ type: 'error', title: 'Pflichtfeld fehlt', message: 'Bitte Firmennamen eingeben.' });
      return;
    }

    const firstName = (form.firstName || '').trim();
    const lastName = (form.lastName || '').trim();
    const fullName = [firstName, lastName].filter(Boolean).join(' ').trim() || (form.fullName || '').trim() || undefined;

    setIsSaving(true);
    try {
      const payload = {
        ...form,
        companyName,
        firstName: firstName || undefined,
        lastName: lastName || undefined,
        fullName,
        notes: (form.notes || '').trim() || undefined,
        phone: (form.phone || '').trim() || undefined,
        street: (form.street || '').trim() || undefined,
        postalCode: (form.postalCode || '').trim() || undefined,
        city: (form.city || '').trim() || undefined,
        country: (form.country || '').trim() || undefined,
        email: (form.email || '').trim() || undefined
      };
      if (mode === 'create') {
        if (!onCreate) throw new Error('Create handler fehlt.');
        await onCreate(payload as CustomerContactFormPayload);
      } else {
        if (!customer || !onSave) throw new Error('Edit handler fehlt.');
        await onSave(customer.contactId, payload as CustomerContactFormPayload);
      }
      onClose();
    } catch {
      pushToast({ type: 'error', title: 'Speichern fehlgeschlagen', message: mode === 'create' ? 'Kontakt konnte nicht erstellt werden.' : 'Kontakt konnte nicht gespeichert werden.' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[1600] px-4">
      <div className="w-full max-w-3xl bg-white rounded-xl shadow-2xl border border-slate-200">
        <div className="px-6 py-4 border-b border-slate-200">
          <h3 className="text-lg font-bold text-slate-900">{mode === 'create' ? 'Kontakt hinzufügen' : 'Kontakt bearbeiten'}</h3>
          <p className="text-sm text-slate-500">
            {mode === 'create'
              ? 'Erfassen Sie Kontakt und Firma und speichern Sie den Eintrag.'
              : 'Ändern Sie Kontakt- und Firmendaten und speichern Sie die Änderungen.'}
          </p>
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="text-sm font-medium text-slate-700 md:col-span-2">
            Firmenname
            <input
              className="mt-1 w-full border border-slate-300 rounded-lg p-2.5"
              value={form.companyName || ''}
              onChange={e => setForm(prev => ({ ...prev, companyName: e.target.value }))}
            />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Vorname
            <input
              className="mt-1 w-full border border-slate-300 rounded-lg p-2.5"
              value={form.firstName || ''}
              onChange={e => setForm(prev => ({ ...prev, firstName: e.target.value }))}
            />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Nachname
            <input
              className="mt-1 w-full border border-slate-300 rounded-lg p-2.5"
              value={form.lastName || ''}
              onChange={e => setForm(prev => ({ ...prev, lastName: e.target.value }))}
            />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Telefon
            <input
              className="mt-1 w-full border border-slate-300 rounded-lg p-2.5"
              value={form.phone || ''}
              onChange={e => setForm(prev => ({ ...prev, phone: e.target.value }))}
            />
          </label>
          <label className="text-sm font-medium text-slate-700">
            E-Mail
            <input
              className="mt-1 w-full border border-slate-300 rounded-lg p-2.5"
              value={form.email || ''}
              onChange={e => setForm(prev => ({ ...prev, email: e.target.value }))}
            />
          </label>
          <label className="text-sm font-medium text-slate-700 md:col-span-2">
            Straße
            <input
              className="mt-1 w-full border border-slate-300 rounded-lg p-2.5"
              value={form.street || ''}
              onChange={e => setForm(prev => ({ ...prev, street: e.target.value }))}
            />
          </label>
          <label className="text-sm font-medium text-slate-700">
            PLZ
            <input
              className="mt-1 w-full border border-slate-300 rounded-lg p-2.5"
              value={form.postalCode || ''}
              onChange={e => setForm(prev => ({ ...prev, postalCode: e.target.value }))}
            />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Stadt
            <input
              className="mt-1 w-full border border-slate-300 rounded-lg p-2.5"
              value={form.city || ''}
              onChange={e => setForm(prev => ({ ...prev, city: e.target.value }))}
            />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Land
            <input
              className="mt-1 w-full border border-slate-300 rounded-lg p-2.5"
              value={form.country || ''}
              onChange={e => setForm(prev => ({ ...prev, country: e.target.value }))}
            />
          </label>
          <label className="text-sm font-medium text-slate-700 md:col-span-2">
            Notizen
            <textarea
              className="mt-1 w-full border border-slate-300 rounded-lg p-2.5 min-h-[90px]"
              value={form.notes || ''}
              onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))}
            />
          </label>
        </div>
        <div className="px-6 pb-6">
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50"
            >
              Abbrechen
            </button>
            <button
              type="button"
              disabled={isSaving}
              onClick={handleSubmit}
              className="px-4 py-2.5 rounded-lg bg-[#2663EB] hover:bg-[#1f54c7] text-white font-semibold disabled:opacity-70 inline-flex items-center gap-2"
            >
              {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
              Speichern
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomerEditDialog;
