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
// Same build, taller: the calculated base moves under the user's edits.
const tall = enumerateVariants(callout('5x4x16 rolling', d), d).variants.find((v) => v.label.startsWith("Ladder on 4'"))!;
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
    ov = swapPart(ov, base, 'toeboard-1.40', 'toeboard-1.57');
    ov = removeLine(ov, base, 'ladder-fixing');
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
    expect(line('toeboard-1.40').partId).toBe('toeboard-1.57');
    expect(line('toeboard-1.40').swappedFrom).toBe("Toe board 4'");
    expect(line('ladder-fixing').removed).toBe(true);
    expect(line('castor').note).toBe('use the new castors');
    expect(line('a1').label).toBe('Stabilizer (generic)');
    expect(line('a2').label).toBe('Tie-down straps');
    expect(line('a2').qty).toBe(6);
    expect(line('a2').note).toBe('ratchet type');
    expect(f.pieces).toBe(base.pieces + 2 - 1 + 2 + 6);
    expect(f.conflicts).toBe(0);
  });

  it('reset line and reset all', () => {
    let ov = setQty(emptyOverrides(), base, 'ledger-1.57', 10);
    ov = addPart(ov, 'a1', 'stabilizer', 2);
    expect(isEmpty(resetLine(resetLine(ov, 'ledger-1.57'), 'a1'))).toBe(true);
    expect(isEmpty(resetAll())).toBe(true);
  });

  it('keeps user edits when the base moves and flags the conflict', () => {
    // Edit made on the 8' tower, then the height changes to 16'.
    const ov = setQty(emptyOverrides(), base, 'ledger-1.40', 5);
    const f = applyOverrides(tall.bom, ov, d);
    const l = f.lines.find((x) => x.key === 'ledger-1.40')!;
    expect(l.qty).toBe(5);
    expect(l.calcQty).toBe(10);
    expect(l.conflict).toMatch(/changed 6 → 10/);
    expect(f.conflicts).toBe(1);
  });

  it('keeps edits for lines that are no longer calculated', () => {
    const ov = setQty(emptyOverrides(), tall.bom, 'stabilizer', 2);
    const f = applyOverrides(base, ov, d);
    const l = f.lines.find((x) => x.key === 'stabilizer')!;
    expect(l.qty).toBe(2);
    expect(l.conflict).toMatch(/No longer calculated/);
  });

  it('a note alone never conflicts', () => {
    const ov = setNote(emptyOverrides(), base, 'ledger-1.40', 'check');
    expect(applyOverrides(tall.bom, ov, d).conflicts).toBe(0);
  });

  it('diff shows only lines that differ', () => {
    const rows = diffLists(v4.bom.lines, tall.bom.lines);
    const keys = rows.map((r) => r.key);
    expect(keys).toContain('stabilizer');
    expect(keys).not.toContain('castor');
    expect(rows.find((r) => r.key === 'ledger-1.40')).toMatchObject({ a: 6, b: 10 });
    expect(diffLists(v4.bom.lines, v4.bom.lines)).toEqual([]);
  });
});
