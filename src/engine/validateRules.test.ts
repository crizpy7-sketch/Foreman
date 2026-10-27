import { describe, expect, it } from 'vitest';
import { seed } from './testkit';
import { validateRule } from './validateRules';

describe('rule validation', () => {
  const d = seed();
  it('seed rules are clean', () => {
    for (const r of d.rules) expect(validateRule(r, d), r.id).toEqual([]);
  });
  it('flags bad expressions, parts, scopes and replaces', () => {
    const r = d.rules.find((x) => x.id === 'castor')!;
    const msgs = (patch: object) => validateRule({ ...r, ...patch }, d).map((i) => `${i.field}: ${i.message}`);
    expect(msgs({ condition: "type = 'rolling'" })[0]).toMatch(/^condition:/);
    expect(msgs({ qtyPer: 'posts * wheels' })[0]).toMatch(/qtyPer: Unknown variable: wheels/);
    expect(msgs({ partId: 'nope' })[0]).toMatch(/partId/);
    expect(msgs({ sizeFrom: 'edge' })[0]).toMatch(/edge scope/);
    expect(msgs({ sizeFrom: 'combo', reach: null })[0]).toMatch(/reach/);
    expect(msgs({ replaces: ['ghost'] })[0]).toMatch(/unknown rule/);
    expect(msgs({ levels: [] })[0]).toMatch(/level/);
    expect(msgs({ category: 'zzz' })[0]).toMatch(/Unknown category/);
  });
});
