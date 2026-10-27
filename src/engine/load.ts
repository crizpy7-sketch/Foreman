// Loads: several towers, each with a qty and the user's edits → combined totals + per-tower breakdown.
import { applyOverrides, type FinalLine, type FinalList, type Overrides } from './overrides';
import { parseCallout } from './parser';
import type { EngineData, VariantResult } from './types';
import { computeVariant, type VariantSpec } from './variants';

export interface TowerEntry {
  id: string;
  /** Callout as typed, e.g. "5x4x8 rolling". */
  callout: string;
  spec: VariantSpec;
  qty: number;
  overrides: Overrides;
}

export type JobStatus = 'draft' | 'loaded';

export interface Job {
  id: string;
  createdAt: number;
  updatedAt: number;
  foreman: string;
  job: string;
  location: string;
  status: JobStatus;
  notes: string;
  towers: TowerEntry[];
}

export interface ComputedTower {
  entry: TowerEntry;
  variant: VariantResult | null;
  list: FinalList | null;
  error: string | null;
}

export function computeTower(entry: TowerEntry, d: EngineData): ComputedTower {
  const r = parseCallout(entry.callout, d.settings.defaultType);
  if (!r.ok) return { entry, variant: null, list: null, error: r.error };
  const variant = computeVariant(r.callout, d, entry.spec);
  return { entry, variant, list: applyOverrides(variant.bom, entry.overrides, d), error: null };
}

export interface LoadLine {
  key: string;
  partId: string | null;
  category: string;
  label: string;
  metric: string;
  qty: number;
  weightKg: number | null;
  verify: boolean;
  /** Per-tower contribution: tower index → qty (already × tower qty). */
  byTower: Record<number, number>;
}

export interface LoadTotals {
  towers: ComputedTower[];
  lines: LoadLine[];
  pieces: number;
  weightKg: number;
  weightComplete: boolean;
  towerCount: number;
}

const lineKey = (l: FinalLine) => l.partId ?? `text:${l.label}`;

export function combineLoad(towers: TowerEntry[], d: EngineData): LoadTotals {
  const computed = towers.map((t) => computeTower(t, d));
  const map = new Map<string, LoadLine>();
  computed.forEach((ct, i) => {
    if (!ct.list) return;
    for (const l of ct.list.lines) {
      if (l.removed || l.qty === 0) continue;
      const k = lineKey(l);
      const q = l.qty * ct.entry.qty;
      const cur = map.get(k) ?? {
        key: k,
        partId: l.partId,
        category: l.category,
        label: l.label,
        metric: l.metric,
        qty: 0,
        weightKg: l.weightKg,
        verify: l.verify,
        byTower: {},
      };
      cur.qty += q;
      cur.byTower[i] = (cur.byTower[i] ?? 0) + q;
      map.set(k, cur);
    }
  });
  const order = d.settings.categoryOrder;
  const idx = (c: string) => (order.indexOf(c) < 0 ? order.length : order.indexOf(c));
  const lines = [...map.values()].sort((a, b) => idx(a.category) - idx(b.category) || a.label.localeCompare(b.label));
  let pieces = 0;
  let weightKg = 0;
  let weightComplete = true;
  for (const l of lines) {
    pieces += l.qty;
    if (l.weightKg === null) weightComplete = false;
    else weightKg += l.weightKg * l.qty;
  }
  return {
    towers: computed,
    lines,
    pieces,
    weightKg: Math.round(weightKg * 100) / 100,
    weightComplete,
    towerCount: towers.reduce((s, t) => s + t.qty, 0),
  };
}
