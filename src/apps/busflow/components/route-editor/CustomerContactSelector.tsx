import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Customer, CustomerContact } from '../../types';
import { DizpoApi } from '../../api';
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
  onChange,
}) => {
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);
  const [isCustomerContactDropdownOpen, setIsCustomerContactDropdownOpen] = useState(false);
  const [customerContacts, setCustomerContacts] = useState<CustomerContact[]>([]);
  // Track the name of the explicitly selected customer to avoid clearing the
  // selection when the user makes minor edits in the input field.
  const [committedName, setCommittedName] = useState<string>(
    customerId ? customerName : ''
  );

  const filteredCustomers = useMemo(() => {
    const q = (customerName || '').trim().toLowerCase();
    if (!q) return customers.slice(0, 8);
    return customers
      .filter(customer => customer.name.toLowerCase().includes(q))
      .slice(0, 8);
  }, [customers, customerName]);

  useEffect(() => {
    let isMounted = true;
    const loadContacts = async () => {
      if (!customerId) {
        setCustomerContacts([]);
        return;
      }
      try {
        const contacts = await DizpoApi.getCustomerContacts(customerId);
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

  const handleTextChange = (newName: string) => {
    // Keep the linked customer as long as the text still matches the committed
    // selection. This prevents accidentally unlinking a customer by a stray
    // keypress. If the text diverges, clear the link so the user must pick
    // from the dropdown again.
    const stillMatches = Boolean(committedName) && newName === committedName;
    if (!stillMatches && committedName) {
      setCommittedName('');
    }
    onChange({
      customerName: newName,
      customerId: stillMatches ? customerId : '',
      customerContactId: stillMatches ? customerContactId : undefined,
      customerContactName: stillMatches ? customerContactName : undefined,
    });
    setIsCustomerDropdownOpen(true);
  };

  const handleCustomerSelect = (customer: Customer) => {
    setCommittedName(customer.name);
    onChange({
      customerName: customer.name,
      customerId: customer.id,
      customerContactId: undefined,
      customerContactName: undefined,
    });
    setIsCustomerDropdownOpen(false);
  };

  return (
    <>
      <div className="col-span-1 md:col-span-2">
        <label className="block text-sm font-semibold text-slate-700 mb-1">Kunde / Auftraggeber</label>
        <div className="relative">
          <input
            type="text"
            value={customerName || ''}
            onChange={e => handleTextChange(e.target.value)}
            onFocus={() => setIsCustomerDropdownOpen(true)}
            onBlur={() => window.setTimeout(() => setIsCustomerDropdownOpen(false), 150)}
            className="w-full rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2.5 bg-white border border-slate-300 transition-all"
            placeholder="z. B. Stadtwerke GmbH (optional)"
          />
          {isCustomerDropdownOpen && (
            <>
              {filteredCustomers.length > 0 && (
                <div className={dropdownMenuClass}>
                  {filteredCustomers.map(customer => (
                    <button
                      key={customer.id}
                      type="button"
                      onMouseDown={e => e.preventDefault()}
                      onClick={() => handleCustomerSelect(customer)}
                      className={DROPDOWN_ITEM}
                    >
                      {customer.name}
                    </button>
                  ))}
                </div>
              )}
              {customers.length === 0 && (
                <div className={dropdownMenuClass}>
                  <p className="px-3 py-2 text-sm text-slate-500">
                    Noch keine Kunden angelegt. Kunden können unter <strong>Kunden</strong> erstellt werden.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
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
