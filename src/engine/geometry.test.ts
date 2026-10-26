import { describe, expect, it } from 'vitest';
import { loadSeed } from '../data/seed';
import { baySplitOptions, buildTower, computeLevels, splitLabel } from './geometry';
import type { BaySplit, Settings, TowerOptions } from './types';
import { formatFtIn, ftToM } from './units';

const d = loadSeed();
const S = d.settings;
const opts: TowerOptions = { accessType: 'ladder', accessAxis: 'W', spanAxis: 'L', gateType: 'gate', diagonalAccess: 'keep', standardsComboIndex: 0 };
const one = (m: number, label: string): BaySplit => ({ bays: [m], labels: [label], total: m, target: m, exact: true });

describe('levels', () => {
  it('8\' rolling → deck level 4, top rail 6, one full lift', () => {
    const lv = computeLevels(ftToM(8), 'rolling', S);
    expect(lv.deck).toBe(4);
    expect(lv.midRail).toBe(5);
    expect(lv.topRail).toBe(6);
    expect(lv.ledgerLevels).toEqual([0]);
    expect(lv.lifts).toEqual([{ from: 0, to: 4, height: 2, full: true }]);
    expect(formatFtIn(lv.heightOf(lv.deck))).toBe(`8'-0"`);
    expect(formatFtIn(lv.heightOf(lv.topRail))).toBe(`11'-4"`);
  });

  it('16\' rolling → deck 9, intermediate ledger level 5 and 1, short bottom lift', () => {
    const lv = computeLevels(ftToM(16), 'rolling', S);
    expect(lv.deck).toBe(9);
    expect(lv.ledgerLevels).toEqual([0, 1, 5]);
    expect(lv.lifts.map((l) => [l.from, l.to, l.full])).toEqual([
      [0, 1, false],
      [1, 5, true],
      [5, 9, true],
    ]);
  });

  it('stationary uses its own base offset', () => {
    const lv = computeLevels(ftToM(8), 'stationary', S);
    expect(lv.deck).toBe(4);
    expect(lv.heightOf(4)).toBeCloseTo(2.3);
  });

  it('honours heightMeans and rounding settings', () => {
    const top: Settings = { ...S, heightMeans: 'topRail' };
    expect(computeLevels(ftToM(11.3), 'rolling', top).deck).toBe(4);
    const up: Settings = { ...S, rounding: 'up' };
    expect(computeLevels(2.2, 'rolling', up).deck).toBe(4); // (2.2-.45)/.5 = 3.5 → 4
    const down: Settings = { ...S, rounding: 'down' };
    expect(computeLevels(2.2, 'rolling', down).deck).toBe(3);
    const tos: Settings = { ...S, heightMeans: 'topOfStandards' };
    expect(computeLevels(3.45, 'rolling', tos).topRail).toBe(6);
  });

  it('never goes below level 1', () => {
    expect(computeLevels(0.3, 'rolling', S).deck).toBe(1);
  });
});

describe('bay splits', () => {
  it('exact size → single option, not offered', () => {
    const so = baySplitOptions({ raw: '5', ft: 5, m: null }, d.sizeMap, S, false);
    expect(so.offered).toBe(false);
    expect(so.options.map(splitLabel)).toEqual(["5'"]);
  });

  it('alias resolves: 3.5 → 1.09', () => {
    const so = baySplitOptions({ raw: '3.5', ft: 3.5, m: null }, d.sizeMap, S, false);
    expect(so.exact?.m).toBe(1.09);
  });

  it('6\' has no entry → offers closest builds ranked by closeness', () => {
    const so = baySplitOptions({ raw: '6', ft: 6, m: null }, d.sizeMap, S, false);
    expect(so.exact).toBeNull();
    expect(so.offered).toBe(true);
    expect(so.options.map(splitLabel)).toEqual(["7'", "5'", "2×3'"]);
  });

  it('10\' with More ways → 10\' first, then 2×5\'', () => {
    const so = baySplitOptions({ raw: '10', ft: 10, m: null }, d.sizeMap, S, true);
    expect(so.options.map(splitLabel).slice(0, 2)).toEqual(["10'", "2×5'"]);
    expect(so.options[1]!.total).toBeCloseTo(3.14);
  });

  it('mixed bays when allowed', () => {
    const so = baySplitOptions({ raw: '10', ft: 10, m: null }, d.sizeMap, { ...S, allowMixedBays: true, bayOptionsShown: 10 }, true);
    expect(so.options.some((o) => new Set(o.labels).size > 1)).toBe(true);
  });
});

describe('tower model', () => {
  it('1×1 has 4 positions, 4 edges, 1 bay', () => {
    const t = buildTower({ type: 'rolling', splitL: one(1.57, "5'"), splitW: one(1.4, "4'"), askedHeight: ftToM(8), options: opts }, S);
    expect(t.positions).toHaveLength(4);
    expect(t.edges).toHaveLength(4);
    expect(t.edges.every((e) => e.perimeter)).toBe(true);
    expect(t.bays).toHaveLength(1);
    expect(t.accessFace).toBe('W0');
    expect(t.accessEdgeId).toBe('EW0-0');
    expect(t.ratio).toBeCloseTo(2.45 / 1.4);
    expect(t.overRatio).toBe(false);
  });

  it('2×1 grid has 6 positions, 7 edges (1 interior), 2 bays', () => {
    const split: BaySplit = { bays: [1.57, 1.57], labels: ["5'", "5'"], total: 3.14, target: 3.048, exact: false };
    const t = buildTower({ type: 'stationary', splitL: split, splitW: one(1.57, "5'"), askedHeight: ftToM(8), options: opts }, S);
    expect(t.positions).toHaveLength(6);
    expect(t.edges).toHaveLength(7);
    expect(t.edges.filter((e) => !e.perimeter)).toHaveLength(1);
    expect(t.bays).toHaveLength(2);
    expect(t.totalL).toBeCloseTo(3.14);
  });

  it('flags over-ratio rolling towers only', () => {
    const tall = { splitL: one(1.57, "5'"), splitW: one(1.4, "4'"), askedHeight: ftToM(16), options: opts };
    expect(buildTower({ ...tall, type: 'rolling' }, S).overRatio).toBe(true);
    expect(buildTower({ ...tall, type: 'stationary' }, S).overRatio).toBe(false);
  });
});

describe('more ways on an exact size', () => {
  it('adds multi-bay splits, never a different single size', () => {
    const so = baySplitOptions({ raw: '5', ft: 5, m: null }, d.sizeMap, S, true);
    expect(so.options[0]!.labels).toEqual(["5'"]);
    expect(so.options.slice(1).every((o) => o.bays.length > 1)).toBe(true);
  });
});
