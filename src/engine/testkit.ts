// Shared helpers for engine tests.
import { loadSeed } from '../data/seed';
import { parseCallout } from './parser';
import type { Callout, EngineData, VariantResult } from './types';

export const seed = (): EngineData => loadSeed();

/** Seed with H read as deck height — rule-mechanics tests are written against deck levels. */
export function deckSeed(): EngineData {
  const d = loadSeed();
  d.settings.heightMeans = 'deck';
  return d;
}

export function callout(s: string, d: EngineData = seed()): Callout {
  const r = parseCallout(s, d.settings.defaultType);
  if (!r.ok) throw new Error(r.error);
  return r.callout;
}

/** BOM as { partId: qty } for compact assertions. */
export function qtys(v: VariantResult): Record<string, number> {
  return Object.fromEntries(v.bom.lines.map((l) => [l.partId ?? l.key, l.qty]));
}
