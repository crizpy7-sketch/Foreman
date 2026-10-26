import { describe, expect, it } from 'vitest';
import { RULE_VARIABLE_NAMES } from '../engine/rules';
import { validateExpr } from '../engine/expr';
import { engineDataSchema } from './schema';
import { loadSeed } from './seed';

describe('seed data', () => {
  const d = loadSeed();

  it('validates against the schema', () => {
    expect(() => engineDataSchema.parse(d)).not.toThrow();
  });

  it('never invents Layher data: no article numbers or weights without a source', () => {
    for (const p of d.catalog) {
      if (p.articleNo !== null || p.weightKg !== null) expect(p.source).toMatch(/^https?:\/\//);
      expect(p.verify).toBe(true);
    }
    expect(d.sizeMap.every((s) => s.verify)).toBe(true);
    expect(d.deckFill.every((s) => s.verify)).toBe(true);
    expect(d.rules.every((r) => r.verify)).toBe(true);
  });

  it('seeds inactive parts as specified', () => {
    const off = d.catalog.filter((p) => !p.active).map((p) => p.id);
    expect(off).toContain('deck-0.32x1.40');
    expect(off.filter((id) => id.startsWith('deck-0.19'))).toHaveLength(7);
    expect(off.filter((id) => id.startsWith('accessdeck-'))).toHaveLength(7);
  });

  it('every rule expression is valid', () => {
    for (const r of d.rules) {
      expect(validateExpr(r.condition, RULE_VARIABLE_NAMES), r.id).toBeNull();
      if (typeof r.qtyPer === 'string') expect(validateExpr(r.qtyPer, RULE_VARIABLE_NAMES), r.id).toBeNull();
      if (r.reach) expect(validateExpr(r.reach, RULE_VARIABLE_NAMES), r.id).toBeNull();
    }
  });

  it('rejects bad data', () => {
    const bad = loadSeed();
    bad.catalog.push({ ...bad.catalog[0]! });
    expect(() => engineDataSchema.parse(bad)).toThrow(/Duplicate part/);
    const bad2 = loadSeed();
    bad2.rules[0]!.partId = 'nope';
    expect(() => engineDataSchema.parse(bad2)).toThrow(/valid partId/);
  });

  it('every category used is in the yard order', () => {
    const cats = new Set([...d.catalog.map((p) => p.category), ...d.rules.map((r) => r.category)]);
    for (const c of cats) expect(d.settings.categoryOrder).toContain(c);
  });
});
