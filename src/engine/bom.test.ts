import { describe, expect, it } from 'vitest';
import { explain } from './bom';
import { findCombos } from './catalog';
import { callout, qtys, seed } from './testkit';
import type { BaySplit, EngineData } from './types';
import { computeVariant, type VariantSpec } from './variants';

const one = (m: number, label: string): BaySplit => ({ bays: [m], labels: [label], total: m, target: m, exact: true });
const base: Omit<VariantSpec, 'splitL' | 'splitW'> = {
  accessType: 'ladder',
  accessAxis: 'W',
  spanAxis: 'L',
  gateType: 'railsStay',
  diagonalAccess: 'keep',
  standardsComboIndex: 0,
  splitRank: 0,
  showSplit: false,
};
const run = (s: string, spec: Partial<VariantSpec> = {}, d: EngineData = seed()) =>
  computeVariant(callout(s, d), d, { ...base, splitL: one(1.57, "5'"), splitW: one(1.4, "4'"), ...spec });

describe('5x4x8 rolling · ladder on 4\' side · decks run 5\'', () => {
  const v = run('5x4x8 rolling');
  const q = qtys(v);

  it('base hardware', () => {
    expect(q['castor']).toBe(4);
    expect(q['base-collar']).toBe(4);
    expect(q['base-jack']).toBeUndefined();
    expect(q['standard-3.0']).toBe(4);
  });

  it('ledgers, U-ledgers, decks', () => {
    expect(q['ledger-1.57']).toBe(8); // base, deck, mid, top on both long sides
    expect(q['ledger-1.40']).toBe(6); // base, mid, top on both short sides (rails stay at the ladder)
    expect(q['uledger-1.40']).toBe(2);
    expect(q['liftoff-1.40']).toBe(2); // one per deck U-ledger
    expect(q['deck-0.32x1.57']).toBe(4);
    expect(q['hdiag-1.57x1.40']).toBe(1);
  });

  it('toe boards, diagonals, ladder + fixing', () => {
    expect(q['toeboard-1.57']).toBe(2);
    expect(q['toeboard-1.40']).toBe(2);
    expect(q['vdiag-1.57']).toBe(2);
    expect(q['vdiag-1.40']).toBe(2);
    expect(q['ladder-2.0']).toBe(1);
    expect(q['ladder-fixing']).toBe(1);
    expect(q['stabilizer']).toBeUndefined();
  });

  it('totals and weight completeness', () => {
    expect(v.bom.pieces).toBe(45);
    // The 1.57×1.40 horizontal diagonal is not in the Layher catalogue, so it has no weight.
    expect(v.bom.weightComplete).toBe(false);
    const known = v.bom.lines.filter((l) => l.weightKg !== null).reduce((s, l) => s + l.weightKg! * l.qty, 0);
    expect(v.bom.weightKg).toBeCloseTo(known);
    expect(v.bom.lines.filter((l) => l.weightKg === null).map((l) => l.partId)).toEqual(['hdiag-1.57x1.40']);
    expect(v.possible).toBe(true);
    expect(v.notes[0]).toBe(`Deck 8'-0" (asked 8') · top rail 11'-4"`);
  });

  it('every line explains itself', () => {
    const ledger = v.bom.lines.find((l) => l.partId === 'ledger-1.57')!;
    expect(ledger.label).toBe("Ledger 5'");
    expect(ledger.metric).toBe('1.57');
    expect(ledger.explanation).toBe(
      "Ledger 5' × 8 = 2 edges × 4 levels: base, deck, mid-rail, top-rail (Ledgers, Deck ledgers, Guardrails)",
    );
    for (const l of v.bom.lines) {
      expect(l.explanation.startsWith(`${l.label} × ${l.qty} = `)).toBe(true);
      expect(l.contributions.reduce((s, c) => s + c.qty, 0)).toBe(l.qty);
      expect(l.verify).toBe(seed().catalog.find((p) => p.id === l.partId)!.verify);
    }
  });

  it('lines follow yard (category) order', () => {
    const order = seed().settings.categoryOrder;
    const idx = v.bom.lines.map((l) => order.indexOf(l.category));
    expect([...idx].sort((a, b) => a - b)).toEqual(idx);
  });

  it('members carry geometry for the SVG', () => {
    expect(v.members.every((m) => m.elementId && Number.isInteger(m.level))).toBe(true);
  });
});

describe('rule settings move the list', () => {
  it('gate replaces both rails at the ladder bay — Layher only makes a 0.73 gate', () => {
    const v = run('5x2x8 rolling', { splitW: one(0.73, "2'"), gateType: 'gate' });
    const q = qtys(v);
    expect(v.possible).toBe(true);
    expect(q['gate-0.73']).toBe(1);
    expect(q['ledger-0.73']).toBe(4); // base ×2 + rails on the non-access short side ×2
    const wide = run('5x4x8 rolling', { gateType: 'gate' });
    expect(wide.possible).toBe(false);
    expect(wide.missingParts.join()).toMatch(/Gates 4' \(1\.40\) — not in catalog/);
  });

  it('gate type: chain', () => {
    const chain = qtys(run('5x4x8 rolling', { gateType: 'chain' }));
    expect(chain['chain']).toBe(2);
    expect(chain['ledger-1.40']).toBe(4);
  });

  it('diagonal access: move keeps the count, omit drops one', () => {
    const move = run('5x4x8 rolling', { diagonalAccess: 'move' });
    expect(qtys(move)['vdiag-1.40']).toBe(2);
    expect(move.members.filter((m) => m.ruleId === 'vDiagonalsMoved').map((m) => m.elementId)).toEqual(['EW1-0']);
    expect(qtys(run('5x4x8 rolling', { diagonalAccess: 'omit' }))['vdiag-1.40']).toBe(1);
  });

  it('stationary: base jacks, no castors, horizontal diagonal per setting', () => {
    const q = qtys(run('5x4x8 stationary'));
    expect(q['base-jack']).toBe(4);
    expect(q['castor']).toBeUndefined();
    expect(q['hdiag-1.57x1.40']).toBe(1);
    const d = seed();
    d.settings.horizontalDiagonalStationary = false;
    expect(qtys(run('5x4x8 stationary', {}, d))['hdiag-1.57x1.40']).toBeUndefined();
  });

  it('16\' rolling: intermediate ledgers, short bottom lift has no diagonal, stabilizers', () => {
    const v = run('5x4x16 rolling');
    const q = qtys(v);
    expect(v.tower.levels.deck).toBe(9);
    expect(q['ledger-1.57']).toBe(2 * 3 + 2 + 4); // base+2 intermediate, deck, mid+top
    expect(q['vdiag-1.57']).toBe(4); // 2 faces × 2 full lifts
    expect(q['stabilizer']).toBe(4);
    expect(q['ladder-3.0']).toBe(1);
    expect(q['ladder-2.0']).toBe(1);
    expect(v.warnings.join()).toMatch(/over the 3:1 limit/);
    const vd = v.bom.lines.find((l) => l.partId === 'vdiag-1.57')!;
    expect(vd.notes).toEqual(["Short lift 0→1 (0.50 m) gets ledgers but no diagonal."]);
  });

  it('inactive parts are never chosen — variant becomes not possible', () => {
    const v = run('5x4x8 rolling', { spanAxis: 'W' });
    expect(v.possible).toBe(false);
    expect(v.missingParts.join()).toMatch(/0\.32 × 4' \(0\.32 × 1\.40\) — inactive/);
    expect(v.bom.lines.some((l) => l.partId === 'deck-0.32x1.40')).toBe(false);
  });

  it('activating a part makes it possible', () => {
    const d = seed();
    d.catalog.find((p) => p.id === 'deck-0.32x1.40')!.active = true;
    d.catalog.find((p) => p.id === 'deck-0.19x1.40')!.active = true;
    expect(run('5x4x8 rolling', { spanAxis: 'W' }, d).possible).toBe(true);
  });

  it('hatch: access deck replaces decks and adds a ladder per lift', () => {
    const d = seed();
    d.catalog.find((p) => p.id === 'accessdeck-1.57')!.active = true;
    const v = run('5x4x8 rolling', { accessType: 'hatch' }, d);
    const q = qtys(v);
    expect(v.possible).toBe(true);
    expect(q['accessdeck-1.57']).toBe(1);
    expect(q['deck-0.32x1.57']).toBe(2);
    expect(q['accessladder-2.00']).toBe(1);
    expect(q['ladder-2.0']).toBeUndefined();
    expect(q['ledger-1.40']).toBe(6); // rails stay on hatch towers
    expect(v.bom.lines.find((l) => l.partId === 'deck-0.32x1.57')!.explanation).toMatch(/− 2 \(Hatch deck \(replaces decks\)\)/);
  });

  it('hatch on a tower with a short bottom lift: ladders in full lifts only', () => {
    const d = seed();
    d.catalog.find((p) => p.id === 'accessdeck-1.57')!.active = true;
    const v = run('5x4x16 rolling', { accessType: 'hatch' }, d);
    expect(v.possible).toBe(true);
    expect(qtys(v)['accessladder-2.00']).toBe(2);
    expect(v.notes).toContain('Short lift 0→1 (0.50 m) gets ledgers but no hatch ladder.');
  });

  it('standards combo selector', () => {
    const v = run('5x4x8 rolling');
    expect(v.standardsCombos[0]!.pieces).toEqual([3]);
    expect(v.standardsCombos.length).toBeGreaterThan(1);
    const v2 = run('5x4x8 rolling', { standardsComboIndex: 1 });
    expect(v2.standardsCombos[1]!.pieces.length).toBe(2);
    expect(v2.bom.lines.filter((l) => l.category === 'standard').reduce((s, l) => s + l.qty, 0)).toBe(8);
  });

  it('rules are data: disabling or editing a rule changes the list', () => {
    const d = seed();
    d.rules.find((r) => r.id === 'toeBoards')!.enabled = false;
    d.rules.find((r) => r.id === 'castor')!.qtyPer = 'posts / posts * 2';
    const q = qtys(run('5x4x8 rolling', {}, d));
    expect(q['toeboard-1.57']).toBeUndefined();
    expect(q['castor']).toBe(8);
  });

  it('rule expression errors surface as warnings, not crashes', () => {
    const d = seed();
    d.rules.find((r) => r.id === 'castor')!.condition = 'nonsense ==';
    const v = run('5x4x8 rolling', {}, d);
    expect(v.possible).toBe(false);
    expect(v.warnings.join()).toMatch(/Castors/);
  });
});

describe('combos', () => {
  it('ranks by fewest pieces, then overshoot, then preference', () => {
    const c = findCombos([0.5, 1, 1.5, 2, 2.5, 3, 4], 3, 0.5, 4, [3, 2, 4]);
    expect(c[0]!.pieces).toEqual([3]);
    expect(c[1]!.pieces).toEqual([2, 1]);
    expect(c.every((x) => x.overshoot <= 0.5 + 1e-9)).toBe(true);
    expect(findCombos([2, 3], 0, 1, 4)).toEqual([]);
    expect(findCombos([4], 3, 0.5, 4)).toEqual([]);
  });
});

describe('explain', () => {
  it('formats non-mergeable contributions and per-element quantities', () => {
    const text = explain('Ladder hook', 2, [
      { ruleId: 'l', ruleLabel: 'Ladder companions', qty: 2, elements: 1, qtyPer: 2, levelNames: ['base'], scopeNoun: 'access bay-face' },
    ]);
    expect(text).toBe('Ladder hook × 2 = 1 access bay-face × base, 2 each (Ladder companions)');
  });
});
