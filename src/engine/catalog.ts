import type { CategoryInfo, Part, SizeMapEntry, SizeSpec, StandardsCombo } from './types';
import { formatM, near, nominalFor, partLabel } from './units';

export interface PartMatch {
  part: Part | null;
  /** Human reason when no active part matches. */
  missing: string | null;
}

function matches(p: Part, category: string, size: SizeSpec, tol: number): boolean {
  if (size.kind === 'part') return p.id === size.partId;
  if (p.category !== category) return false;
  switch (size.kind) {
    case 'length':
    case 'piece':
      return p.size !== null && near(p.size, size.m, tol);
    case 'bay':
      return (
        p.size !== null &&
        p.size2 !== null &&
        ((near(p.size, size.l, tol) && near(p.size2, size.w, tol)) ||
          (near(p.size, size.w, tol) && near(p.size2, size.l, tol)))
      );
    case 'deck':
      return p.size !== null && p.size2 !== null && near(p.size, size.length, tol) && near(p.size2, size.width, tol);
    case 'none':
      return true;
  }
}

export function describeSize(category: string, size: SizeSpec, sizeMap: SizeMapEntry[], categories: CategoryInfo[], tol: number): string {
  const cat = categories.find((c) => c.id === category)?.label ?? category;
  const nom = (m: number) => `${nominalFor(m, sizeMap, tol)} (${formatM(m)})`;
  switch (size.kind) {
    case 'length':
    case 'piece':
      return `${cat} ${nom(size.m)}`;
    case 'bay':
      return `${cat} ${nominalFor(size.l, sizeMap, tol)}×${nominalFor(size.w, sizeMap, tol)} (${formatM(size.l)}×${formatM(size.w)})`;
    case 'deck':
      return `${cat} ${formatM(size.width)} × ${nom(size.length)}`;
    case 'part':
      return `part "${size.partId}"`;
    case 'none':
      return cat;
  }
}

/** Map a member to an active catalog part by category + size. Inactive parts are never chosen. */
export function matchPart(
  catalog: Part[],
  category: string,
  size: SizeSpec,
  sizeMap: SizeMapEntry[],
  categories: CategoryInfo[],
  tol: number,
): PartMatch {
  const candidates = catalog.filter((p) => matches(p, category, size, tol));
  const active = candidates.find((p) => p.active);
  if (active) return { part: active, missing: null };
  const inactive = candidates[0];
  if (inactive) {
    const { label, metric } = partLabel(inactive, sizeMap, tol);
    return { part: null, missing: `${label}${metric ? ` (${metric})` : ''} — inactive in catalog` };
  }
  return { part: null, missing: `${describeSize(category, size, sizeMap, categories, tol)} — not in catalog` };
}

/**
 * All multisets of lengths whose sum reaches `reach` with at most `maxOvershoot` extra,
 * ranked by fewest pieces, then least overshoot, then preferred-length order.
 */
export function findCombos(
  lengths: number[],
  reach: number,
  maxOvershoot: number,
  maxPieces: number,
  preferred: number[] = [],
): StandardsCombo[] {
  const eps = 1e-6;
  const uniq = [...new Set(lengths.map((l) => Math.round(l * 1000) / 1000))].sort((a, b) => b - a);
  const out: StandardsCombo[] = [];
  const walk = (start: number, picked: number[], sum: number) => {
    if (sum >= reach - eps) {
      if (sum - reach <= maxOvershoot + eps) {
        out.push({ pieces: [...picked], total: Math.round(sum * 1000) / 1000, overshoot: Math.round((sum - reach) * 1000) / 1000 });
      }
      return;
    }
    if (picked.length >= maxPieces) return;
    for (let i = start; i < uniq.length; i++) {
      picked.push(uniq[i]!);
      walk(i, picked, sum + uniq[i]!);
      picked.pop();
    }
  };
  if (reach <= eps) return [];
  walk(0, [], 0);
  const rank = (l: number) => {
    const i = preferred.findIndex((p) => Math.abs(p - l) < eps);
    return i < 0 ? preferred.length : i;
  };
  const prefScore = (c: StandardsCombo) => c.pieces.reduce((s, l) => s + rank(l), 0);
  out.sort(
    (a, b) =>
      a.pieces.length - b.pieces.length ||
      a.overshoot - b.overshoot ||
      prefScore(a) - prefScore(b) ||
      b.pieces[0]! - a.pieces[0]!,
  );
  return out;
}

export function activeLengths(catalog: Part[], category: string): number[] {
  return catalog.filter((p) => p.active && p.category === category && p.size !== null).map((p) => p.size!);
}
