import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Customer, CustomerContact } from '../../types';
import { BusFlowApi } from '../../api';
import { DROPDOWN_ITEM, DROPDOWN_MENU, DROPDOWN_TRIGGER } from '../../../../shared/components/form/dropdownStyles';

interface CustomerPatch {
  customerName?: string;
  customerId?: string;
  customerContactId?: string | undefined;
  customerContactName?: string | undefined;
}

interface Props {
  customerName: string;
  customerId: string;
  customerContactId?: string;
  customerContactName?: string;
  customers: Customer[];
  customerRequiredForStatus: boolean;
  hasError?: boolean;
  onChange: (patch: CustomerPatch) => void;
}

const dropdownTriggerButtonClass = `${DROPDOWN_TRIGGER} text-left flex items-center justify-between`;
const dropdownMenuClass = `${DROPDOWN_MENU} overflow-hidden`;
const dropdownMenuScrollableClass = `${DROPDOWN_MENU} overflow-hidden max-h-60`;

const CustomerContactSelector: React.FC<Props> = ({
  customerName,
  customerId,
  customerContactId,
  customerContactName,
  customers,
  customerRequiredForStatus,
  hasError,
  onChange,
}) => {
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);
  const [isCustomerContactDropdownOpen, setIsCustomerContactDropdownOpen] = useState(false);
  const [customerContacts, setCustomerContacts] = useState<CustomerContact[]>([]);

  const filteredCustomers = useMemo(() => {
    const q = (customerName || '').trim().toLowerCase();
    if (!q) return customers.slice(0, 8);
    return customers
      .filter(customer => customer.name.toLowerCase().includes(q))
      .slice(0, 8);
  }, [customers, customerName]);

  const hasUnlinkedCustomerText =
    customerRequiredForStatus && Boolean((customerName || '').trim()) && customerId === '';

  useEffect(() => {
    let isMounted = true;
    const loadContacts = async () => {
      if (!customerId) {
        setCustomerContacts([]);
        return;
      }
      try {
        const contacts = await BusFlowApi.getCustomerContacts(customerId);
        if (isMounted) setCustomerContacts(contacts);
      } catch {
        if (isMounted) setCustomerContacts([]);
      }
    };
    loadContacts();
    return () => {
      isMounted = false;
    };
  }, [customerId]);

  return (
    <>
      <div className="col-span-1 md:col-span-2">
        <label className="block text-sm font-semibold text-slate-700 mb-1">Kunde / Auftraggeber</label>
        <div className="relative">
          <input
            type="text"
            value={customerName || ''}
            onChange={e => {
              onChange({
                customerName: e.target.value,
                customerId: '',
                customerContactId: undefined,
                customerContactName: undefined
              });
              setIsCustomerDropdownOpen(true);
            }}
            onFocus={() => setIsCustomerDropdownOpen(true)}
            onBlur={() => window.setTimeout(() => setIsCustomerDropdownOpen(false), 150)}
            className={`w-full rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2.5 bg-white border transition-all ${hasError ? 'border-red-400 ring-1 ring-red-300' : 'border-slate-300'}`}
            placeholder="z. B. Stadtwerke GmbH"
          />
          {isCustomerDropdownOpen && filteredCustomers.length > 0 && (
            <div className={dropdownMenuClass}>
              {filteredCustomers.map(customer => (
                <button
                  key={customer.id}
                  type="button"
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => {
                    onChange({
                      customerName: customer.name,
                      customerId: customer.id,
                      customerContactId: undefined,
                      customerContactName: undefined
                    });
                    setIsCustomerDropdownOpen(false);
                  }}
                  className={DROPDOWN_ITEM}
                >
                  {customer.name}
                </button>
              ))}
            </div>
          )}
        </div>
        {hasUnlinkedCustomerText && (
          <p className="text-xs text-amber-600 mt-1">Für Geplant/Aktiv/Archiviert muss ein Kunde aus der Liste gewählt werden.</p>
        )}
      </div>
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-1">Kontaktperson (optional)</label>
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsCustomerContactDropdownOpen(prev => !prev)}
            onBlur={() => window.setTimeout(() => setIsCustomerContactDropdownOpen(false), 150)}
            disabled={!customerId}
            className={dropdownTriggerButtonClass}
          >
            <span className={customerContactId ? 'text-slate-800' : 'text-slate-400'}>
              {customerContactName || 'Kontakt auswählen'}
            </span>
            <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${isCustomerContactDropdownOpen ? 'rotate-180' : ''}`} />
          </button>
          {isCustomerContactDropdownOpen && customerId && (
            <div className={dropdownMenuScrollableClass}>
              <button
                type="button"
                onMouseDown={e => e.preventDefault()}
                onClick={() => {
                  onChange({ customerContactId: undefined, customerContactName: undefined });
                  setIsCustomerContactDropdownOpen(false);
                }}
                className={`${DROPDOWN_ITEM} text-slate-600`}
              >
                Kein Kontakt
              </button>
              {customerContacts.map(contact => (
                <button
                  key={contact.id}
                  type="button"
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => {
                    onChange({
                      customerContactId: contact.id,
                      customerContactName: contact.fullName || contact.email || contact.phone || 'Kontakt'
                    });
                    setIsCustomerContactDropdownOpen(false);
                  }}
                  className={DROPDOWN_ITEM}
                >
                  {contact.fullName || 'Kontakt'}
                  {(contact.email || contact.phone) && (
                    <span className="text-slate-500"> ({contact.email || contact.phone})</span>
                  )}
                </button>
              ))}
              {customerContacts.length === 0 && (
                <div className={`${DROPDOWN_ITEM} text-slate-500 cursor-default`}>Keine Kontakte vorhanden</div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default CustomerContactSelector;
