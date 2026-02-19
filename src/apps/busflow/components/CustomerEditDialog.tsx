import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Customer } from '../types';

interface Props {
  isOpen: boolean;
  mode: 'create' | 'edit';
  customer?: Customer | null;
  onClose: () => void;
  onCreate?: (payload: Omit<Customer, 'id'>) => Promise<void>;
  onSave?: (id: string, patch: Partial<Omit<Customer, 'id'>>) => Promise<void>;
}

const CustomerEditDialog: React.FC<Props> = ({ isOpen, mode, customer = null, onClose, onCreate, onSave }) => {
  const [form, setForm] = useState<Partial<Omit<Customer, 'id'>>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    if (mode === 'edit' && customer) {
      setForm({
        name: customer.name || '',
        notes: customer.notes || '',
        phone: customer.phone || '',
        street: customer.street || '',
        postalCode: customer.postalCode || '',
        city: customer.city || '',
        country: customer.country || '',
        email: customer.email || '',
        contactPerson: customer.contactPerson || '',
        metadata: customer.metadata || {}
      });
    } else {
      setForm({
        name: '',
        notes: '',
        phone: '',
        street: '',
        postalCode: '',
        city: '',
        country: '',
        email: '',
        contactPerson: '',
        metadata: {}
      });
    }
    setError(null);
  }, [customer, mode, isOpen]);

  if (!isOpen) return null;
  if (mode === 'edit' && !customer) return null;

  const handleSubmit = async () => {
    const name = (form.name || '').trim();
    if (!name) {
      setError('Name ist erforderlich.');
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const payload = {
        ...form,
        name,
        notes: (form.notes || '').trim() || undefined,
        phone: (form.phone || '').trim() || undefined,
        street: (form.street || '').trim() || undefined,
        postalCode: (form.postalCode || '').trim() || undefined,
        city: (form.city || '').trim() || undefined,
        country: (form.country || '').trim() || undefined,
        email: (form.email || '').trim() || undefined,
        contactPerson: (form.contactPerson || '').trim() || undefined
      };
      if (mode === 'create') {
        if (!onCreate) throw new Error('Create handler fehlt.');
        await onCreate({
          name,
          notes: payload.notes,
          phone: payload.phone,
          street: payload.street,
          postalCode: payload.postalCode,
          city: payload.city,
          country: payload.country,
          email: payload.email,
          contactPerson: payload.contactPerson,
          metadata: payload.metadata
        });
      } else {
        if (!customer || !onSave) throw new Error('Edit handler fehlt.');
        await onSave(customer.id, payload);
      }
      onClose();
    } catch (e: any) {
      setError(e?.message || (mode === 'create' ? 'Kunde konnte nicht erstellt werden.' : 'Kunde konnte nicht gespeichert werden.'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[1600] px-4">
      <div className="w-full max-w-3xl bg-white rounded-xl shadow-2xl border border-slate-200">
        <div className="px-6 py-4 border-b border-slate-200">
          <h3 className="text-lg font-bold text-slate-900">{mode === 'create' ? 'Kunde hinzufügen' : 'Kunde bearbeiten'}</h3>
          <p className="text-sm text-slate-500">
            {mode === 'create'
              ? 'Erfassen Sie alle Kundendaten und speichern Sie den neuen Kunden.'
              : 'Ändern Sie Kundendaten und speichern Sie die Änderungen.'}
          </p>
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="text-sm font-medium text-slate-700">
            Name
            <input
              className="mt-1 w-full border border-slate-300 rounded-lg p-2.5"
              value={form.name || ''}
              onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
            />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Ansprechpartner
            <input
              className="mt-1 w-full border border-slate-300 rounded-lg p-2.5"
              value={form.contactPerson || ''}
              onChange={e => setForm(prev => ({ ...prev, contactPerson: e.target.value }))}
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
          {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
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
