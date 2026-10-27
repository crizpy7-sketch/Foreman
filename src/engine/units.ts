import type { DimRequest, Part, SizeMapEntry, WeightUnit } from './types';

export const M_PER_FT = 0.3048;
export const LB_PER_KG = 2.2046226218;

export const ftToM = (ft: number): number => ft * M_PER_FT;
export const mToFt = (m: number): number => m / M_PER_FT;

/** 2.45 → `8'-0"` (nearest inch). */
export function formatFtIn(m: number): string {
  const totalIn = Math.round(m / 0.0254);
  const sign = totalIn < 0 ? '-' : '';
  const abs = Math.abs(totalIn);
  return `${sign}${Math.floor(abs / 12)}'-${abs % 12}"`;
}

/** Metric display used in small print: 1.57, 0.32, 1.40, 3.00. */
export function formatM(m: number): string {
  return (Math.round(m * 100) / 100).toFixed(2);
}

/** Feet as the yard says them: 5 → `5'`, 8.5 → `8'6"`. */
export function formatFeetCall(ft: number): string {
  const whole = Math.floor(ft + 1e-9);
  const inches = Math.round((ft - whole) * 12);
  return inches ? `${whole}'${inches}"` : `${whole}'`;
}

export function near(a: number, b: number, tol: number): boolean {
  return Math.abs(a - b) <= tol;
}

/** Find the size-map entry for a called dimension: alias first, then feet, then exact metres. */
export function lookupSize(req: DimRequest, sizeMap: SizeMapEntry[], tol: number): SizeMapEntry | null {
  const raw = req.raw.replace(/['’]$/, '');
  const byAlias = sizeMap.find((e) => e.aliases.includes(raw) || e.aliases.includes(req.raw));
  if (byAlias) return byAlias;
  if (req.ft !== null) {
    const byFt = sizeMap.find((e) => near(e.ft, req.ft!, 1e-6));
    if (byFt) return byFt;
  }
  if (req.m !== null) {
    const byM = sizeMap.find((e) => near(e.m, req.m!, tol));
    if (byM) return byM;
  }
  return null;
}

/** Target length in metres for a dimension request (for ranking closest builds). */
export function requestMetres(req: DimRequest): number {
  if (req.m !== null) return req.m;
  return ftToM(req.ft ?? 0);
}

/** Yard label for a metric system length: 1.57 → `5'`, else ft-in. */
export function nominalFor(m: number, sizeMap: SizeMapEntry[], tol: number): string {
  const e = sizeMap.find((s) => near(s.m, m, tol));
  return e ? e.label : formatFtIn(m);
}

export function partLabel(part: Part, sizeMap: SizeMapEntry[], tol: number): { label: string; metric: string } {
  const nom = (m: number) => nominalFor(m, sizeMap, tol);
  if (part.size === null) return { label: part.name, metric: '' };
  if (part.category === 'deck' || part.category === 'accessDeck') {
    // Decks are called by length: "Deck 5'", metric small "(0.32 × 1.57)" = width × length.
    const w = part.size2 ?? 0;
    return {
      label: `${part.name} ${part.nominal ?? nom(part.size)}`,
      metric: `${formatM(w)} × ${formatM(part.size)}`,
    };
  }
  if (part.size2 !== null) {
    return {
      label: `${part.name} ${part.nominal ?? `${nom(part.size)}×${nom(part.size2)}`}`,
      metric: `${formatM(part.size)}×${formatM(part.size2)}`,
    };
  }
  return { label: `${part.name} ${part.nominal ?? nom(part.size)}`, metric: formatM(part.size) };
}

export function formatWeight(kg: number, unit: WeightUnit): string {
  return unit === 'lb' ? `${Math.round(kg * LB_PER_KG)} lb` : `${Math.round(kg)} kg`;
}
