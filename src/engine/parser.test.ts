import { describe, expect, it } from 'vitest';
import { canonicalCallout, normalizeSpoken, parseCallout } from './parser';
import type { Callout } from './types';

function p(s: string, def: 'rolling' | 'stationary' = 'rolling'): Callout {
  const r = parseCallout(s, def);
  if (!r.ok) throw new Error(r.error);
  return r.callout;
}

describe('callout parser', () => {
  it.each(['5x4x8 rolling', '5 x 4 x 8 roll', '5x4x8r', '5X4X8 Rolling', '5×4×8 rolling'])('parses %s', (s) => {
    const c = p(s, 'stationary');
    expect([c.L.ft, c.W.ft, c.H.ft]).toEqual([5, 4, 8]);
    expect(c.type).toBe('rolling');
    expect(c.typeExplicit).toBe(true);
    expect(c.qty).toBe(1);
  });

  it('reads quantity', () => {
    expect(p('2@5x4x8 rolling').qty).toBe(2);
    expect(p('3 @ 5x4x8').qty).toBe(3);
    expect(p('2 at 5x4x8').qty).toBe(2);
  });

  it.each([
    ['5x4x8 stat', 'stationary'],
    ['5x4x8 stationary', 'stationary'],
    ['5x4x8 fixed', 'stationary'],
    ['5x4x8s', 'stationary'],
  ])('type %s', (s, t) => expect(p(s).type).toBe(t));

  it('uses the default type when missing', () => {
    const c = p('5x4x8', 'rolling');
    expect(c.type).toBe('rolling');
    expect(c.typeExplicit).toBe(false);
    expect(p('5x4x8', 'stationary').type).toBe('stationary');
  });

  it.each(['5x4x8 rolling access 5', '5x4x8 a5', '5x4x8 rolling ladder on 5', "5x4x8 ladder on the 5' side"])(
    'access side %s',
    (s) => {
      const c = p(s);
      expect(c.accessSide?.ft).toBe(5);
      expect(c.type).toBe('rolling');
    },
  );

  it('reads hatch', () => {
    const c = p('5x4x8 rolling hatch');
    expect(c.accessType).toBe('hatch');
    expect(c.accessSide).toBeNull();
  });

  it('reads heights in ft-in and metres', () => {
    expect(p(`5x4x8'6" rolling`).H.ft).toBeCloseTo(8.5);
    expect(p(`5x4x8' 6" rolling`).H.ft).toBeCloseTo(8.5);
    const m = p('5x4x2.5m');
    expect(m.H.m).toBe(2.5);
    expect(m.H.ft).toBeNull();
    expect(p('5x4x8ft').H.ft).toBe(8);
  });

  it('keeps aliases raw for size-map lookup', () => {
    expect(p('3.5x4x8').L.raw).toBe('3.5');
  });

  it('reads spoken callouts', () => {
    const c = p('five by four by eight rolling');
    expect([c.L.ft, c.W.ft, c.H.ft, c.type]).toEqual([5, 4, 8, 'rolling']);
    expect(p('two at five by four by eight').qty).toBe(2);
    expect(p('five by four by eight foot six stationary').H.ft).toBeCloseTo(8.5);
    expect(p('five by four by two point five meters').H.m).toBe(2.5);
    expect(p('five by four by sixteen rolling').H.ft).toBe(16);
    expect(p('five by four by twenty four').H.ft).toBe(24);
    expect(p('five by for by eight').W.ft).toBe(4);
    expect(p('five by four by eight and a half').H.ft).toBe(8.5);
    expect(p('5 by 4 by 8 rolling access five').accessSide?.ft).toBe(5);
  });

  it('normalises spoken text', () => {
    expect(normalizeSpoken('Five by Four by Eight foot six')).toBe("5 x 4 x 8'6");
  });

  it('reports errors and ignored words', () => {
    const bad = parseCallout('5x4 rolling', 'rolling');
    expect(bad.ok).toBe(false);
    expect(parseCallout('0x4x8', 'rolling').ok).toBe(false);
    expect(p('5x4x8 rolling banana').warnings.join()).toMatch(/Ignored: banana/);
    expect(p('5x4x8 more ways').moreWays).toBe(true);
  });

  it('canonicalises', () => {
    expect(canonicalCallout(p('5 x 4 x 8 roll'))).toBe('5x4x8 rolling');
    expect(canonicalCallout(p('2@5x4x8 a4 stat'))).toBe('2@5x4x8 stationary access 4');
    expect(canonicalCallout(p(`5x4x8'6"`))).toBe(`5x4x8'6" rolling`);
  });
});
