import { CustomerImportError, CustomerImportRow } from '../types';

type CsvParseResult = {
  rows: CustomerImportRow[];
  errors: CustomerImportError[];
};

type ParsedHeaderField =
  | 'companyName'
  | 'firstName'
  | 'lastName'
  | 'email'
  | 'phone'
  | 'street'
  | 'postalCode'
  | 'city'
  | 'country'
  | 'notes'
  | 'metadata';

const HEADER_ALIASES: Record<string, ParsedHeaderField> = {
  company_name: 'companyName',
  company: 'companyName',
  customer: 'companyName',
  kundenname: 'companyName',
  kunde: 'companyName',

  name: 'firstName',
  first_name: 'firstName',
  vorname: 'firstName',

  surname: 'lastName',
  last_name: 'lastName',
  lastname: 'lastName',
  nachname: 'lastName',

  email: 'email',
  mail: 'email',
  email_address: 'email',
  'e-mail': 'email',

  phone: 'phone',
  mobile_number: 'phone',
  phone_number: 'phone',
  telephone_number: 'phone',
  telefon: 'phone',
  mobil: 'phone',
  mobile: 'phone',

  street: 'street',
  strasse: 'street',
  'straße': 'street',

  postal_code: 'postalCode',
  postcode: 'postalCode',
  zip_code: 'postalCode',
  plz: 'postalCode',
  zip: 'postalCode',

  city: 'city',
  ort: 'city',

  country: 'country',
  land: 'country',

  notes: 'notes',
  notizen: 'notes'
};

const normalizeHeader = (header: string) =>
  header.trim().toLocaleLowerCase('de-DE').replace(/\s+/g, '_');

const splitCsvLine = (line: string, delimiter: string): string[] => {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const nextChar = line[i + 1];
    if (char === '"' && inQuotes && nextChar === '"') {
      current += '"';
      i += 1;
      continue;
    }
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (char === delimiter && !inQuotes) {
      values.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }

  values.push(current.trim());
  return values;
};

const detectDelimiter = (headerLine: string) => {
  const candidates = [';', ',', '\t'];
  let best = ';';
  let bestCount = 0;
  for (const candidate of candidates) {
    const count = splitCsvLine(headerLine, candidate).length;
    if (count > bestCount) {
      bestCount = count;
      best = candidate;
    }
  }
  return best;
};

export const parseCustomerCsv = (fileContent: string): CsvParseResult => {
  const errors: CustomerImportError[] = [];
  const rows: CustomerImportRow[] = [];
  const normalized = fileContent.replace(/^\uFEFF/, '');
  const lines = normalized
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    return {
      rows: [],
      errors: [{ rowNumber: 0, reason: 'CSV enthält keine Datenzeilen.' }]
    };
  }

  const delimiter = detectDelimiter(lines[0]);
  const rawHeaders = splitCsvLine(lines[0], delimiter);
  const headerMap = rawHeaders.map(h => HEADER_ALIASES[normalizeHeader(h)] || null);

  for (let i = 1; i < lines.length; i += 1) {
    const cells = splitCsvLine(lines[i], delimiter);
    const row: CustomerImportRow = {
      rowNumber: i + 1,
      companyName: ''
    };
    const metadata: Record<string, string> = {};

    for (let c = 0; c < rawHeaders.length; c += 1) {
      const rawHeader = rawHeaders[c] || '';
      const mapped = headerMap[c];
      const value = (cells[c] || '').trim();
      if (!value) continue;

      if (mapped === 'companyName') row.companyName = value;
      else if (mapped === 'firstName') row.firstName = value;
      else if (mapped === 'lastName') row.lastName = value;
      else if (mapped === 'email') row.email = value;
      else if (mapped === 'phone') row.phone = value;
      else if (mapped === 'street') row.street = value;
      else if (mapped === 'postalCode') row.postalCode = value;
      else if (mapped === 'city') row.city = value;
      else if (mapped === 'country') row.country = value;
      else if (mapped === 'notes') row.notes = value;
      else metadata[rawHeader.trim() || `extra_${c + 1}`] = value;
    }

    row.companyName = (row.companyName || '').trim();
    row.firstName = row.firstName?.trim() || undefined;
    row.lastName = row.lastName?.trim() || undefined;
    row.fullName = [row.firstName, row.lastName].filter(Boolean).join(' ').trim() || undefined;

    if (!row.companyName) {
      const raw: Record<string, string> = {};
      rawHeaders.forEach((header, idx) => {
        if ((cells[idx] || '').trim()) raw[header] = (cells[idx] || '').trim();
      });
      errors.push({
        rowNumber: i + 1,
        name: row.fullName || undefined,
        reason: 'Firma/Kunde fehlt.',
        raw
      });
      continue;
    }

    if (Object.keys(metadata).length > 0) row.metadata = metadata;
    rows.push(row);
  }

  return { rows, errors };
};
