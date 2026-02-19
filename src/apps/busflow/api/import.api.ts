import {
  CustomerImportConflictCandidate,
  CustomerImportPreview,
  CustomerImportResult,
  CustomerImportRow
} from '../types';
import { getErrorMessage, mapCustomerContactFromDb, requireActiveAccountId, supabase, type DbCustomerContact } from './shared';
import { upsertCustomerContact } from './contacts.api';

export async function importCustomersPreview(rows: CustomerImportRow[]): Promise<CustomerImportPreview> {
  const accountId = requireActiveAccountId();
  const errors: CustomerImportPreview['errors'] = [];
  const conflicts: CustomerImportConflictCandidate[] = [];
  const validRows = rows.filter(row => {
    if (!row.companyName?.trim()) {
      errors.push({ rowNumber: row.rowNumber, reason: 'Firma/Kunde fehlt.', name: row.fullName || undefined });
      return false;
    }
    return true;
  });

  if (validRows.length === 0) {
    return { rows: [], conflicts: [], errors };
  }

  const { data: companiesScoped, error: companiesError } = await supabase
    .from('busflow_customers')
    .select('id,name')
    .eq('account_id', accountId);
  if (companiesError) throw companiesError;

  const companyMap = new Map<string, { id: string; name: string }>();
  ((companiesScoped || []) as Array<{ id: string; name: string }>).forEach(company => {
    companyMap.set(company.name.trim().toLocaleLowerCase('de-DE'), company);
  });

  const existingCompanyIds = Array.from(
    new Set(
      validRows
        .map(r => companyMap.get(r.companyName.trim().toLocaleLowerCase('de-DE'))?.id)
        .filter((v): v is string => Boolean(v))
    )
  );

  const contactsByCompany = new Map<string, ReturnType<typeof mapCustomerContactFromDb>[]>();
  if (existingCompanyIds.length > 0) {
    const { data: contacts, error: contactsError } = await supabase
      .from('busflow_customer_contacts')
      .select('*')
      .eq('account_id', accountId)
      .in('customer_id', existingCompanyIds);
    if (contactsError) throw contactsError;

    for (const contact of ((contacts || []) as DbCustomerContact[]).map(mapCustomerContactFromDb)) {
      const arr = contactsByCompany.get(contact.customerId) || [];
      arr.push(contact);
      contactsByCompany.set(contact.customerId, arr);
    }
  }

  for (const row of validRows) {
    const company = companyMap.get(row.companyName.trim().toLocaleLowerCase('de-DE'));
    if (!company) continue;

    const contacts = contactsByCompany.get(company.id) || [];
    const email = (row.email || '').trim().toLocaleLowerCase('de-DE');
    const fullName = (row.fullName || '').trim().toLocaleLowerCase('de-DE');
    const phone = (row.phone || '').trim();

    const existing = contacts.find(contact => {
      const contactEmail = (contact.email || '').trim().toLocaleLowerCase('de-DE');
      if (email) return contactEmail && contactEmail === email;
      return (contact.fullName || '').trim().toLocaleLowerCase('de-DE') === fullName
        && (contact.phone || '').trim() === phone
        && Boolean(fullName || phone);
    });

    if (existing) {
      conflicts.push({
        rowNumber: row.rowNumber,
        companyName: row.companyName,
        incomingContact: {
          firstName: row.firstName,
          lastName: row.lastName,
          fullName: row.fullName,
          email: row.email,
          phone: row.phone,
          street: row.street,
          postalCode: row.postalCode,
          city: row.city,
          country: row.country,
          notes: row.notes,
          metadata: row.metadata
        },
        existingContact: existing
      });
    }
  }

  return { rows: validRows, conflicts, errors };
}

export async function commitCustomerImport(
  preview: CustomerImportPreview,
  resolutions: Record<number, 'import' | 'skip'>,
  onProgress?: (progress: { current: number; total: number }) => void
): Promise<CustomerImportResult> {
  const accountId = requireActiveAccountId();
  let insertedCompanies = 0;
  let insertedContacts = 0;
  let updatedContacts = 0;
  let skipped = 0;
  const errors: CustomerImportResult['errors'] = [...preview.errors];

  const { data: existingCompaniesScoped, error: companiesError } = await supabase
    .from('busflow_customers')
    .select('id,name')
    .eq('account_id', accountId);
  if (companiesError) throw companiesError;

  const companyMap = new Map<string, { id: string; name: string }>();
  ((existingCompaniesScoped || []) as Array<{ id: string; name: string }>).forEach(company => {
    companyMap.set(company.name.trim().toLocaleLowerCase('de-DE'), company);
  });

  const conflictByRow = new Map<number, CustomerImportConflictCandidate>();
  preview.conflicts.forEach(conflict => conflictByRow.set(conflict.rowNumber, conflict));
  let processed = 0;
  const total = preview.rows.length;
  onProgress?.({ current: 0, total });

  for (const row of preview.rows) {
    const companyKey = row.companyName.trim().toLocaleLowerCase('de-DE');
    let company = companyMap.get(companyKey);
    if (!company) {
      const { data: createdCompany, error: createCompanyError } = await supabase
        .from('busflow_customers')
        .insert({ account_id: accountId, name: row.companyName.trim() })
        .select('id,name')
        .single();
      if (createCompanyError) {
        errors.push({ rowNumber: row.rowNumber, name: row.companyName, reason: createCompanyError.message });
        skipped += 1;
        processed += 1;
        onProgress?.({ current: processed, total });
        continue;
      }
      company = createdCompany as { id: string; name: string };
      companyMap.set(companyKey, company);
      insertedCompanies += 1;
    }

    const conflict = conflictByRow.get(row.rowNumber);
    if (conflict) {
      const resolution = resolutions[row.rowNumber] || 'skip';
      if (resolution === 'skip') {
        skipped += 1;
        processed += 1;
        onProgress?.({ current: processed, total });
        continue;
      }
      try {
        await upsertCustomerContact({
          id: conflict.existingContact.id,
          customerId: company.id,
          firstName: row.firstName,
          lastName: row.lastName,
          fullName: row.fullName,
          email: row.email,
          phone: row.phone,
          street: row.street,
          postalCode: row.postalCode,
          city: row.city,
          country: row.country,
          notes: row.notes,
          metadata: row.metadata
        });
        updatedContacts += 1;
      } catch (error) {
        errors.push({
          rowNumber: row.rowNumber,
          name: row.companyName,
          reason: getErrorMessage(error, 'Kontakt konnte nicht aktualisiert werden.')
        });
        skipped += 1;
      }
      processed += 1;
      onProgress?.({ current: processed, total });
      continue;
    }

    try {
      await upsertCustomerContact({
        customerId: company.id,
        firstName: row.firstName,
        lastName: row.lastName,
        fullName: row.fullName,
        email: row.email,
        phone: row.phone,
        street: row.street,
        postalCode: row.postalCode,
        city: row.city,
        country: row.country,
        notes: row.notes,
        metadata: row.metadata
      });
      insertedContacts += 1;
    } catch (error) {
      errors.push({
        rowNumber: row.rowNumber,
        name: row.companyName,
        reason: getErrorMessage(error, 'Kontakt konnte nicht erstellt werden.')
      });
      skipped += 1;
    }
    processed += 1;
    onProgress?.({ current: processed, total });
  }

  return {
    insertedCompanies,
    insertedContacts,
    updatedContacts,
    skipped,
    conflicts: preview.conflicts.length,
    errors
  };
}
