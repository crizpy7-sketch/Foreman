import { describe, expect, it } from 'vitest';
import {
  addFreeText,
  addPart,
  applyOverrides,
  diffLists,
  emptyOverrides,
  isEmpty,
  removeLine,
  resetAll,
  resetLine,
  setAddedQty,
  setNote,
  setQty,
  swapPart,
} from './overrides';
import { callout, seed } from './testkit';
import { enumerateVariants } from './variants';

const d = seed();
const set = enumerateVariants(callout('5x4x8 rolling', d), d);
const v4 = set.variants.find((v) => v.label.startsWith("Ladder on 4'"))!;
const v5 = set.variants.find((v) => v.label.startsWith("Ladder on 5'"))!;
const base = v4.bom;

describe('overrides', () => {
  it('no edits → same as calculated', () => {
    const f = applyOverrides(base, emptyOverrides(), d);
    expect(f.pieces).toBe(base.pieces);
    expect(f.editedCount).toBe(0);
  });

  it('set qty, swap, remove, note, add part, add free text', () => {
    let ov = emptyOverrides();
    ov = setQty(ov, base, 'ledger-1.57', 10);
    ov = swapPart(ov, base, 'gate-1.40', 'chain');
    ov = removeLine(ov, base, 'ladder-hook');
    ov = setNote(ov, base, 'castor', 'use the new castors');
    ov = addPart(ov, 'a1', 'stabilizer', 2);
    ov = addFreeText(ov, 'a2', 'Tie-down straps', 4);
    ov = setAddedQty(ov, 'a2', 6);
    ov = setNote(ov, base, 'a2', 'ratchet type');
    const f = applyOverrides(base, ov, d);
    const line = (k: string) => f.lines.find((l) => l.key === k)!;
    expect(line('ledger-1.57').qty).toBe(10);
    expect(line('ledger-1.57').calcQty).toBe(8);
    expect(line('ledger-1.57').edited).toBe(true);
    expect(line('gate-1.40').partId).toBe('chain');
    expect(line('gate-1.40').swappedFrom).toBe("Gate 4'");
    expect(line('ladder-hook').removed).toBe(true);
    expect(line('castor').note).toBe('use the new castors');
    expect(line('a1').label).toBe('Stabilizer');
    expect(line('a2').label).toBe('Tie-down straps');
    expect(line('a2').qty).toBe(6);
    expect(line('a2').note).toBe('ratchet type');
    expect(f.pieces).toBe(base.pieces + 2 - 2 + 2 + 6);
    expect(f.conflicts).toBe(0);
  });

  it('reset line and reset all', () => {
    let ov = setQty(emptyOverrides(), base, 'ledger-1.57', 10);
    ov = addPart(ov, 'a1', 'stabilizer', 2);
    expect(isEmpty(resetLine(resetLine(ov, 'ledger-1.57'), 'a1'))).toBe(true);
    expect(isEmpty(resetAll())).toBe(true);
  });

  it('keeps user edits when the base moves and flags the conflict', () => {
    // Edit made on the 4'-side variant, then the access toggle moves to the 5' side.
    const ov = setQty(emptyOverrides(), base, 'ledger-1.40', 5);
    const f = applyOverrides(v5.bom, ov, d);
    const l = f.lines.find((x) => x.key === 'ledger-1.40')!;
    expect(l.qty).toBe(5);
    expect(l.calcQty).toBe(6);
    expect(l.conflict).toMatch(/changed 4 → 6/);
    expect(f.conflicts).toBe(1);
  });

  it('keeps edits for lines that are no longer calculated', () => {
    const ov = setQty(emptyOverrides(), base, 'gate-1.40', 2);
    const f = applyOverrides(v5.bom, ov, d);
    const l = f.lines.find((x) => x.key === 'gate-1.40')!;
    expect(l.qty).toBe(2);
    expect(l.conflict).toMatch(/No longer calculated/);
  });

  it('a note alone never conflicts', () => {
    const ov = setNote(emptyOverrides(), base, 'ledger-1.40', 'check');
    expect(applyOverrides(v5.bom, ov, d).conflicts).toBe(0);
  });

  it('diff shows only lines that differ', () => {
    const rows = diffLists(v4.bom.lines, v5.bom.lines);
    const keys = rows.map((r) => r.key).sort();
    expect(keys).toEqual(['gate-1.40', 'gate-1.57', 'ledger-1.40', 'ledger-1.57']);
    expect(rows.find((r) => r.key === 'ledger-1.57')).toMatchObject({ a: 8, b: 6 });
  });
});
