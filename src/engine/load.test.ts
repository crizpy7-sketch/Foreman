import { describe, expect, it } from 'vitest';
import { combineLoad, type TowerEntry } from './load';
import { emptyOverrides, setQty } from './overrides';
import { listText, loadText } from './share';
import { callout, seed } from './testkit';
import { enumerateVariants, type VariantSpec } from './variants';

const d = seed();

function entry(c: string, qty: number, i = 0): TowerEntry {
  const v = enumerateVariants(callout(c, d), d).variants[i]!;
  const t = v.tower;
  const spec: VariantSpec = {
    splitL: t.splitL,
    splitW: t.splitW,
    accessType: t.options.accessType,
    accessAxis: t.options.accessAxis,
    spanAxis: t.options.spanAxis,
    gateType: t.options.gateType,
    diagonalAccess: t.options.diagonalAccess,
    standardsComboIndex: 0,
    splitRank: v.splitRank,
    showSplit: false,
  };
  return { id: c, callout: c, spec, qty, overrides: emptyOverrides() };
}

describe('loads', () => {
  it('combines towers × qty with a per-tower breakdown', () => {
    const a = entry('5x4x8 rolling', 2);
    const b = entry('5x4x16 rolling', 1);
    const tot = combineLoad([a, b], d);
    const single = combineLoad([{ ...a, qty: 1 }], d);
    expect(tot.towerCount).toBe(3);
    const castor = tot.lines.find((l) => l.partId === 'castor')!;
    expect(castor.qty).toBe(12);
    expect(castor.byTower).toEqual({ 0: 8, 1: 4 });
    expect(tot.lines.find((l) => l.partId === 'stabilizer')!.byTower).toEqual({ 1: 4 });
    expect(tot.towers[0]!.list!.pieces).toBe(single.towers[0]!.list!.pieces);
    expect(single.pieces).toBe(single.towers[0]!.list!.pieces);
  });

  it('applies each tower’s own edits', () => {
    const a = entry('5x4x8 rolling', 2);
    const base = combineLoad([a], d).towers[0]!.variant!.bom;
    a.overrides = setQty(emptyOverrides(), base, 'castor', 6);
    expect(combineLoad([a], d).lines.find((l) => l.partId === 'castor')!.qty).toBe(12);
  });

  it('formats share text with the footer', () => {
    const tot = combineLoad([entry('5x4x8 rolling', 2)], d);
    const txt = loadText({ job: 'Plant 4', foreman: 'Sam', location: 'Bay 2' }, tot, 'lb', new Date(2026, 9, 27));
    expect(txt).toMatch(/^LOAD — Plant 4\nForeman: Sam · At: Bay 2/);
    expect(txt).toMatch(/T1 2× 5x4x8 rolling/);
    expect(txt).toMatch(/ {2}8 {2}Swivel castor/);
    expect(txt.trim().endsWith('your competent person.')).toBe(true);
    expect(listText('X', tot.towers[0]!.list!, 'kg')).toMatch(/pcs · ≥ \d+ kg \(weight incomplete\)/);
  });

  it('reports a bad callout instead of crashing', () => {
    const bad = { ...entry('5x4x8 rolling', 1), callout: 'nonsense' };
    const tot = combineLoad([bad], d);
    expect(tot.towers[0]!.error).toMatch(/L x W x H/);
    expect(tot.lines).toEqual([]);
  });
});
