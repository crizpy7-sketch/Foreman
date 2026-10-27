import { describe, expect, it } from 'vitest';
import { callout, qtys, seed } from './testkit';
import { enumerateVariants } from './variants';

describe('variant enumeration', () => {
  it('5x4x8 rolling → two possible builds, ladder on 4\' or 5\' side, decks run 5\'', () => {
    const d = seed();
    const set = enumerateVariants(callout('5x4x8 rolling', d), d);
    expect(set.variants.map((v) => v.label).sort()).toEqual([
      "Ladder on 4' side · decks run 5'",
      "Ladder on 5' side · decks run 5'",
    ]);
    expect(set.notPossible.length).toBeGreaterThan(0);
    expect(set.notPossible.every((v) => v.missingParts.length > 0)).toBe(true);
    expect(set.sizeNotes).toEqual([]);
  });

  it('access side in the callout narrows the variants', () => {
    const d = seed();
    const set = enumerateVariants(callout('5x4x8 rolling a5', d), d);
    expect(set.variants.map((v) => v.label)).toEqual(["Ladder on 5' side · decks run 5'"]);
    const odd = enumerateVariants(callout('5x4x8 rolling a7', d), d);
    expect(odd.warnings.join()).toMatch(/No 7' side/);
    expect(odd.variants).toHaveLength(2);
  });

  it('6x4 explains there is no 6\' and offers the closest builds', () => {
    const d = seed();
    const set = enumerateVariants(callout('6x4x8 rolling', d), d);
    expect(set.sizeNotes[0]).toMatch(/^No 6' size in the size map \(length\) — closest builds: 7' \(6'-9"\), 5' \(5'-2"\), 2×3' \(7'-2"\)/);
    expect(set.variants[0]!.label.startsWith("7' × 4' · ")).toBe(true);
    expect(new Set(set.variants.map((v) => v.label.split(' · ')[0]))).toEqual(new Set(["7' × 4'", "5' × 4'", "2×3' × 4'"]));
  });

  it('10x5x8 stationary with More ways → one 10\' bay vs 2×5\'', () => {
    const d = seed();
    const set = enumerateVariants(callout('10x5x8 stationary', d), d, { moreWays: true });
    const layouts = new Set([...set.variants, ...set.notPossible].map((v) => v.label.split(' · ')[0]));
    expect(layouts.has("10' × 5'")).toBe(true);
    expect(layouts.has("2×5' × 5'")).toBe(true);
    // One 10' bay, decks running 5': 9 decks, but Layher lists no 3.07 lift-off preventer.
    const tenBay = [...set.variants, ...set.notPossible].find((v) => v.label === "10' × 5' · Ladder on 10' side · decks run 5'")!;
    expect(qtys(tenBay)['deck-0.32x1.57']).toBe(9);
    expect(tenBay.missingParts).toEqual(["Lift-off preventers 10' (3.07) — not in catalog"]);
  });

  it('caps at maxVariants and sorts by fewest pieces within a layout', () => {
    const d = seed();
    d.settings.maxVariants = 1;
    const set = enumerateVariants(callout('6x4x8 rolling', d), d);
    expect(set.variants).toHaveLength(1);
    const d2 = seed();
    const all = enumerateVariants(callout('5x4x8 rolling', d2), d2).variants;
    for (let i = 1; i < all.length; i++) expect(all[i]!.bom.pieces).toBeGreaterThanOrEqual(all[i - 1]!.bom.pieces);
  });

  it('square towers do not duplicate identical builds', () => {
    const d = seed();
    const set = enumerateVariants(callout('5x5x8 rolling', d), d);
    const labels = [...set.variants, ...set.notPossible].map((v) => v.label);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it('is deterministic', () => {
    const d = seed();
    const a = enumerateVariants(callout('5x4x16 rolling', d), d);
    const b = enumerateVariants(callout('5x4x16 rolling', d), d);
    expect(a.variants.map((v) => qtys(v))).toEqual(b.variants.map((v) => qtys(v)));
  });
});

describe('labels', () => {
  it('says which side decks run along when both directions have the same deck length', () => {
    const d = seed();
    d.settings.maxVariants = 50;
    const set = enumerateVariants(callout('10x5x8 stationary', d), d, { moreWays: true });
    const labels = [...set.variants, ...set.notPossible].map((v) => v.label);
    expect(labels).toContain("2×5' × 5' · Ladder on 5' side · decks run 5' along the 2×5' side");
    expect(labels).toContain("2×5' × 5' · Ladder on 5' side · decks run 5' along the 5' side");
    expect(new Set(labels).size).toBe(labels.length);
  });
});
