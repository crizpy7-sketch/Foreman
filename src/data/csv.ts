// Catalog CSV import/export. Companions are written as "partId:qty;partId:qty".
import type { Part } from '../engine/types';
import { partSchema } from './schema';

export const CSV_COLUMNS = [
  'id', 'name', 'category', 'size', 'size2', 'nominal', 'articleNo', 'weightKg', 'yardLocation',
  'companions', 'replacesDecks', 'active', 'verify', 'source', 'notes',
] as const;

function cell(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function catalogToCsv(parts: Part[]): string {
  const rows = parts.map((p) =>
    CSV_COLUMNS.map((c) => {
      if (c === 'companions') return cell(p.companions.map((x) => `${x.partId}:${x.qty}`).join(';'));
      return cell(p[c]);
    }).join(','),
  );
  return [CSV_COLUMNS.join(','), ...rows].join('\n') + '\n';
}

/** RFC-4180-ish CSV parser (quotes, escaped quotes, CRLF). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (q) {
      if (c === '"' && text[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ',') {
      row.push(cur);
      cur = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cur);
      rows.push(row);
      row = [];
      cur = '';
    } else cur += c;
  }
  if (cur !== '' || row.length) {
    row.push(cur);
    rows.push(row);
  }
  return rows.filter((r) => r.some((x) => x.trim() !== ''));
}

export interface CsvImport {
  parts: Part[];
  errors: string[];
}

export function csvToCatalog(text: string): CsvImport {
  const rows = parseCsv(text);
  const errors: string[] = [];
  if (!rows.length) return { parts: [], errors: ['Empty file'] };
  const head = rows[0]!.map((h) => h.trim());
  const missing = ['id', 'name', 'category'].filter((c) => !head.includes(c));
  if (missing.length) return { parts: [], errors: [`Missing column(s): ${missing.join(', ')}`] };
  const num = (s: string | undefined) => (s === undefined || s.trim() === '' ? null : Number(s));
  const bool = (s: string | undefined, dflt: boolean) => (s === undefined || s.trim() === '' ? dflt : /^(true|1|yes|y)$/i.test(s.trim()));
  const str = (s: string | undefined) => (s === undefined || s.trim() === '' ? null : s);
  const parts: Part[] = [];
  rows.slice(1).forEach((r, n) => {
    const get = (c: string) => {
      const i = head.indexOf(c);
      return i < 0 ? undefined : r[i];
    };
    const companions = (get('companions') ?? '')
      .split(';')
      .map((x) => x.trim())
      .filter(Boolean)
      .map((x) => {
        const [partId, qty] = x.split(':');
        return { partId: (partId ?? '').trim(), qty: Number(qty ?? 1) };
      });
    const raw = {
      id: (get('id') ?? '').trim(),
      name: (get('name') ?? '').trim(),
      category: (get('category') ?? '').trim(),
      size: num(get('size')),
      size2: num(get('size2')),
      nominal: str(get('nominal')),
      articleNo: str(get('articleNo')),
      weightKg: num(get('weightKg')),
      yardLocation: get('yardLocation') ?? '',
      companions,
      replacesDecks: num(get('replacesDecks')),
      active: bool(get('active'), true),
      verify: bool(get('verify'), true),
      source: str(get('source')),
      notes: get('notes') ?? '',
    };
    const res = partSchema.safeParse(raw);
    if (res.success) parts.push(res.data);
    else errors.push(`Row ${n + 2} (${raw.id || '?'}): ${res.error.issues.map((i) => `${i.path.join('.')} ${i.message}`).join('; ')}`);
  });
  return { parts, errors };
}
