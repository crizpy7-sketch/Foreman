// User edits stored as a diff over the calculated list. The user always has the final word:
// edits are never dropped when the calculated base moves — they are kept and flagged as conflicts.
import type { Bom, BomLine, EngineData } from './types';
import { partLabel } from './units';

export interface LineEdit {
  /** Key of the calculated line this edit applies to. */
  key: string;
  qty?: number;
  swapTo?: string;
  removed?: boolean;
  note?: string;
  /** Calculated qty when the edit was made (null if the line was not in the list). */
  baseQty: number | null;
}

export interface AddedLine {
  id: string;
  partId: string | null;
  text: string | null;
  qty: number;
  note?: string;
}

export interface Overrides {
  edits: Record<string, LineEdit>;
  added: AddedLine[];
}

export const emptyOverrides = (): Overrides => ({ edits: {}, added: [] });

export interface FinalLine {
  key: string;
  source: 'calc' | 'added';
  partId: string | null;
  category: string;
  label: string;
  metric: string;
  qty: number;
  calcQty: number | null;
  weightKg: number | null;
  verify: boolean;
  missing: string | null;
  explanation: string;
  notes: string[];
  note: string | null;
  edited: boolean;
  removed: boolean;
  swappedFrom: string | null;
  conflict: string | null;
}

export interface FinalList {
  lines: FinalLine[];
  pieces: number;
  weightKg: number;
  weightComplete: boolean;
  editedCount: number;
  conflicts: number;
}

function withEdit(ov: Overrides, key: string, base: Bom, patch: Partial<LineEdit>): Overrides {
  const prev = ov.edits[key];
  const baseQty = prev ? prev.baseQty : (base.lines.find((l) => l.key === key)?.qty ?? null);
  return { ...ov, edits: { ...ov.edits, [key]: { ...prev, ...patch, key, baseQty } } };
}

export const setQty = (ov: Overrides, base: Bom, key: string, qty: number): Overrides =>
  withEdit(ov, key, base, { qty: Math.max(0, Math.round(qty)) });

export const swapPart = (ov: Overrides, base: Bom, key: string, partId: string): Overrides =>
  withEdit(ov, key, base, { swapTo: partId });

export const removeLine = (ov: Overrides, base: Bom, key: string): Overrides => withEdit(ov, key, base, { removed: true });

export const setNote = (ov: Overrides, base: Bom, key: string, note: string): Overrides => {
  const added = ov.added.find((a) => a.id === key);
  if (added) return { ...ov, added: ov.added.map((a) => (a.id === key ? { ...a, note } : a)) };
  return withEdit(ov, key, base, { note });
};

export function addPart(ov: Overrides, id: string, partId: string, qty: number): Overrides {
  return { ...ov, added: [...ov.added, { id, partId, text: null, qty }] };
}

export function addFreeText(ov: Overrides, id: string, text: string, qty: number): Overrides {
  return { ...ov, added: [...ov.added, { id, partId: null, text, qty }] };
}

export function setAddedQty(ov: Overrides, id: string, qty: number): Overrides {
  return { ...ov, added: ov.added.map((a) => (a.id === id ? { ...a, qty: Math.max(0, Math.round(qty)) } : a)) };
}

export function resetLine(ov: Overrides, key: string): Overrides {
  if (ov.added.some((a) => a.id === key)) return { ...ov, added: ov.added.filter((a) => a.id !== key) };
  const edits = { ...ov.edits };
  delete edits[key];
  return { ...ov, edits };
}

export const resetAll = (): Overrides => emptyOverrides();

export function isEmpty(ov: Overrides): boolean {
  return Object.keys(ov.edits).length === 0 && ov.added.length === 0;
}

/** Apply user edits over the calculated BOM. */
export function applyOverrides(base: Bom, ov: Overrides, d: EngineData): FinalList {
  const tol = d.settings.sizeTolerance;
  const partInfo = (partId: string) => {
    const p = d.catalog.find((x) => x.id === partId);
    if (!p) return null;
    return { part: p, ...partLabel(p, d.sizeMap, tol) };
  };
  const lines: FinalLine[] = [];
  const fromCalc = (l: BomLine): FinalLine => {
    const e = ov.edits[l.key];
    let out: FinalLine = {
      key: l.key,
      source: 'calc',
      partId: l.partId,
      category: l.category,
      label: l.label,
      metric: l.metric,
      qty: l.qty,
      calcQty: l.qty,
      weightKg: l.weightKg,
      verify: l.verify,
      missing: l.missing,
      explanation: l.explanation,
      notes: l.notes,
      note: null,
      edited: false,
      removed: false,
      swappedFrom: null,
      conflict: null,
    };
    if (!e) return out;
    out = { ...out, edited: true, note: e.note ?? null };
    if (e.qty !== undefined) out.qty = e.qty;
    if (e.removed) out.removed = true;
    if (e.swapTo) {
      const info = partInfo(e.swapTo);
      if (info) {
        out = {
          ...out,
          swappedFrom: l.label,
          partId: info.part.id,
          category: info.part.category,
          label: info.label,
          metric: info.metric,
          weightKg: info.part.weightKg,
          verify: info.part.verify,
          missing: info.part.active ? null : `${info.label} — inactive in catalog`,
        };
      } else {
        out.conflict = `Swapped-to part "${e.swapTo}" is no longer in the catalog`;
      }
    }
    if (e.baseQty !== l.qty && (e.qty !== undefined || e.removed || e.swapTo)) {
      out.conflict = `Calculated qty changed ${e.baseQty ?? 0} → ${l.qty} since your edit — kept yours`;
    }
    return out;
  };

  const baseKeys = new Set(base.lines.map((l) => l.key));
  for (const l of base.lines) lines.push(fromCalc(l));

  // Edits whose calculated line has disappeared are kept, never silently dropped.
  for (const e of Object.values(ov.edits)) {
    if (baseKeys.has(e.key)) continue;
    const swap = e.swapTo ? partInfo(e.swapTo) : null;
    const orig = d.catalog.find((p) => p.id === e.key);
    const info = swap ?? (orig ? partInfo(orig.id) : null);
    lines.push({
      key: e.key,
      source: 'calc',
      partId: info?.part.id ?? null,
      category: info?.part.category ?? 'other',
      label: info?.label ?? e.key,
      metric: info?.metric ?? '',
      qty: e.qty ?? e.baseQty ?? 0,
      calcQty: 0,
      weightKg: info?.part.weightKg ?? null,
      verify: info?.part.verify ?? true,
      missing: null,
      explanation: 'No longer in the calculated list',
      notes: [],
      note: e.note ?? null,
      edited: true,
      removed: !!e.removed,
      swappedFrom: null,
      conflict: `No longer calculated (was ${e.baseQty ?? 0}) — kept your edit`,
    });
  }

  for (const a of ov.added) {
    const info = a.partId ? partInfo(a.partId) : null;
    lines.push({
      key: a.id,
      source: 'added',
      partId: info?.part.id ?? null,
      category: info?.part.category ?? 'other',
      label: info?.label ?? a.text ?? '(item)',
      metric: info?.metric ?? '',
      qty: a.qty,
      calcQty: null,
      weightKg: info?.part.weightKg ?? null,
      verify: info ? info.part.verify : false,
      missing: null,
      explanation: 'Added by you',
      notes: [],
      note: a.note ?? null,
      edited: true,
      removed: false,
      swappedFrom: null,
      conflict: a.partId && !info ? `Part "${a.partId}" is no longer in the catalog` : null,
    });
  }

  const order = d.settings.categoryOrder;
  const idx = (c: string) => (order.indexOf(c) < 0 ? order.length : order.indexOf(c));
  const pos = new Map(lines.map((l, i) => [l, i]));
  lines.sort((a, b) => idx(a.category) - idx(b.category) || pos.get(a)! - pos.get(b)!);

  let pieces = 0;
  let weightKg = 0;
  let weightComplete = true;
  for (const l of lines) {
    if (l.removed) continue;
    pieces += l.qty;
    if (l.weightKg === null) weightComplete = false;
    else weightKg += l.weightKg * l.qty;
  }
  return {
    lines,
    pieces,
    weightKg: Math.round(weightKg * 100) / 100,
    weightComplete,
    editedCount: lines.filter((l) => l.edited).length,
    conflicts: lines.filter((l) => l.conflict).length,
  };
}

export interface DiffRow {
  key: string;
  label: string;
  a: number;
  b: number;
}

/** Lines that differ between two lists (by part, or label for free-text). */
export function diffLists(
  a: { partId: string | null; label: string; qty: number; removed?: boolean }[],
  b: { partId: string | null; label: string; qty: number; removed?: boolean }[],
): DiffRow[] {
  const rows = new Map<string, DiffRow>();
  const keyOf = (l: { partId: string | null; label: string }) => l.partId ?? `text:${l.label}`;
  for (const l of a) {
    if (l.removed) continue;
    const r = rows.get(keyOf(l)) ?? { key: keyOf(l), label: l.label, a: 0, b: 0 };
    r.a += l.qty;
    rows.set(r.key, r);
  }
  for (const l of b) {
    if (l.removed) continue;
    const r = rows.get(keyOf(l)) ?? { key: keyOf(l), label: l.label, a: 0, b: 0 };
    r.b += l.qty;
    rows.set(r.key, r);
  }
  return [...rows.values()].filter((r) => r.a !== r.b);
}
