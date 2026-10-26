import type {
  Axis,
  Bay,
  BaySplit,
  DimRequest,
  Edge,
  FaceId,
  Levels,
  Lift,
  Position,
  ScaffoldType,
  Settings,
  SizeMapEntry,
  Tower,
  TowerOptions,
} from './types';
import { lookupSize, requestMetres } from './units';

const round2 = (n: number) => Math.round(n * 1e6) / 1e6;

export interface SplitOptions {
  exact: SizeMapEntry | null;
  target: number;
  /** Ranked options; when not offered this holds just the exact single bay. */
  options: BaySplit[];
  offered: boolean;
}

function multisets(n: number, count: number, start = 0): number[][] {
  if (n === 0) return [[]];
  const out: number[][] = [];
  for (let i = start; i < count; i++) for (const rest of multisets(n - 1, count, i)) out.push([i, ...rest]);
  return out;
}

/**
 * Single- and multi-bay ways to build a called dimension, ranked by how close the
 * actual length is to the call. Offered when the size has no exact entry or "More ways" is on.
 */
export function baySplitOptions(req: DimRequest, sizeMap: SizeMapEntry[], settings: Settings, moreWays: boolean): SplitOptions {
  const exact = lookupSize(req, sizeMap, settings.sizeTolerance);
  const target = requestMetres(req);
  const offered = !exact || moreWays;
  const mk = (entries: SizeMapEntry[]): BaySplit => ({
    bays: entries.map((e) => e.m),
    labels: entries.map((e) => e.label),
    total: round2(entries.reduce((s, e) => s + e.m, 0)),
    target,
    exact: entries.length === 1 && entries[0] === exact,
  });
  if (!offered) return { exact, target, options: [mk([exact!])], offered };

  const sorted = [...sizeMap].sort((a, b) => a.m - b.m);
  const all: BaySplit[] = [];
  for (let n = 1; n <= settings.maxBaysPerDirection; n++) {
    if (settings.allowMixedBays) {
      for (const combo of multisets(n, sorted.length)) all.push(mk(combo.map((i) => sorted[i]!)));
    } else {
      for (const e of sorted) all.push(mk(Array.from({ length: n }, () => e)));
    }
  }
  // With an exact entry, "More ways" adds multi-bay splits; other single sizes are only offered when there is no exact size.
  const candidates = (exact ? all.filter((o) => o.exact || o.bays.length > 1) : all).filter(
    (o) => o.exact || Math.abs(o.total - target) <= settings.maxSplitDeviation + 1e-9,
  );
  candidates.sort(
    (a, b) =>
      Number(b.exact) - Number(a.exact) ||
      Math.abs(a.total - target) - Math.abs(b.total - target) ||
      a.bays.length - b.bays.length,
  );
  return { exact, target, options: candidates.slice(0, settings.bayOptionsShown), offered };
}

export function splitLabel(s: BaySplit): string {
  if (s.labels.length === 1) return s.labels[0]!;
  return s.labels.every((l) => l === s.labels[0]) ? `${s.labels.length}×${s.labels[0]}` : s.labels.join('+');
}

function roundBy(x: number, mode: Settings['rounding']): number {
  const eps = 1e-9;
  if (mode === 'up') return Math.ceil(x - eps);
  if (mode === 'down') return Math.floor(x + eps);
  return Math.round(x);
}

export function baseOffset(type: ScaffoldType, s: Settings): number {
  return type === 'rolling' ? s.baseOffsetRolling : s.baseOffsetStationary;
}

/** Levels are rosette indices above the base collar (level 0). */
export function computeLevels(askedHeight: number, type: ScaffoldType, s: Settings): Levels {
  const p = s.pitch;
  const o = baseOffset(type, s);
  let k: number;
  if (s.heightMeans === 'deck') k = roundBy((askedHeight - o) / p, s.rounding);
  else if (s.heightMeans === 'topRail') k = roundBy((askedHeight - o) / p, s.rounding) - s.topRailOffset;
  else k = roundBy((askedHeight - o - s.standardAboveTopRail) / p, s.rounding) - s.topRailOffset;
  k = Math.max(k, 1);

  const liftLevels = Math.max(1, Math.round(s.liftHeight / p));
  const intermediates: number[] = [];
  for (let n = k - liftLevels; n > 0; n -= liftLevels) intermediates.unshift(n);
  const bounds = [0, ...intermediates, k];
  const lifts: Lift[] = [];
  for (let i = 0; i + 1 < bounds.length; i++) {
    const from = bounds[i]!;
    const to = bounds[i + 1]!;
    lifts.push({ from, to, height: round2((to - from) * p), full: to - from === liftLevels });
  }
  return {
    pitch: p,
    baseOffset: o,
    deck: k,
    midRail: k + s.midRailOffset,
    topRail: k + s.topRailOffset,
    ledgerLevels: [0, ...intermediates],
    lifts,
    heightOf: (n: number) => round2(o + n * p),
  };
}

export interface TowerInput {
  type: ScaffoldType;
  splitL: BaySplit;
  splitW: BaySplit;
  askedHeight: number;
  options: TowerOptions;
}

export function buildTower(input: TowerInput, s: Settings): Tower {
  const { splitL, splitW, type, options } = input;
  const nL = splitL.bays.length;
  const nW = splitW.bays.length;
  const xs = [0];
  splitL.bays.forEach((b) => xs.push(round2(xs[xs.length - 1]! + b)));
  const ys = [0];
  splitW.bays.forEach((b) => ys.push(round2(ys[ys.length - 1]! + b)));

  const positions: Position[] = [];
  for (let j = 0; j <= nW; j++)
    for (let i = 0; i <= nL; i++) positions.push({ id: `P${i}-${j}`, i, j, x: xs[i]!, y: ys[j]! });

  const edges: Edge[] = [];
  for (let j = 0; j <= nW; j++)
    for (let i = 0; i < nL; i++) {
      const face: FaceId | null = j === 0 ? 'L0' : j === nW ? 'L1' : null;
      edges.push({ id: `EL${i}-${j}`, axis: 'L', i, j, length: splitL.bays[i]!, perimeter: face !== null, face });
    }
  for (let i = 0; i <= nL; i++)
    for (let j = 0; j < nW; j++) {
      const face: FaceId | null = i === 0 ? 'W0' : i === nL ? 'W1' : null;
      edges.push({ id: `EW${i}-${j}`, axis: 'W', i, j, length: splitW.bays[j]!, perimeter: face !== null, face });
    }

  const bays: Bay[] = [];
  for (let j = 0; j < nW; j++)
    for (let i = 0; i < nL; i++) bays.push({ id: `B${i}-${j}`, i, j, lenL: splitL.bays[i]!, lenW: splitW.bays[j]! });

  const levels = computeLevels(input.askedHeight, type, s);
  const ladder = options.accessType === 'ladder';
  const accessFace: FaceId | null = ladder ? (options.accessAxis === 'L' ? 'L0' : 'W0') : null;
  const oppositeFace: FaceId | null = ladder ? (options.accessAxis === 'L' ? 'L1' : 'W1') : null;
  const accessEdgeId = ladder ? (options.accessAxis === 'L' ? 'EL0-0' : 'EW0-0') : null;

  const totalL = xs[nL]!;
  const totalW = ys[nW]!;
  const deckHeight = levels.heightOf(levels.deck);
  const ratio = round2(deckHeight / Math.min(totalL, totalW));
  const ratioLimit = type === 'rolling' ? s.ratioLimitRolling : s.ratioLimitStationary;

  return {
    type,
    splitL,
    splitW,
    nL,
    nW,
    totalL,
    totalW,
    positions,
    edges,
    bays,
    levels,
    options,
    accessFace,
    oppositeFace,
    accessEdgeId,
    accessBayId: 'B0-0',
    askedHeight: input.askedHeight,
    deckHeight,
    topRailHeight: levels.heightOf(levels.topRail),
    ratio,
    ratioLimit,
    overRatio: ratioLimit !== null && ratio > ratioLimit + 1e-9,
  };
}

/** The edge directly opposite the access edge, across the tower. */
export function oppositeEdgeId(t: Tower): string | null {
  if (!t.accessEdgeId) return null;
  return t.options.accessAxis === 'L' ? `EL0-${t.nW}` : `EW${t.nL}-0`;
}

export function spanOf(bay: Bay, spanAxis: Axis): number {
  return spanAxis === 'L' ? bay.lenL : bay.lenW;
}

export function crossOf(bay: Bay, spanAxis: Axis): number {
  return spanAxis === 'L' ? bay.lenW : bay.lenL;
}
