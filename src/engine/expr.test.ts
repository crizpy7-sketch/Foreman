import { describe, expect, it } from 'vitest';
import { evalBool, evalNumber, evaluate, ExprError, parseExpr, referencedVars, validateExpr } from './expr';

const vars = { k: 4, lifts: 2, nL: 1, nW: 2, type: 'rolling', overRatio: false, liftFull: true };

describe('expression evaluator', () => {
  it('does arithmetic with precedence', () => {
    expect(evalNumber('1 + 2 * 3', {})).toBe(7);
    expect(evalNumber('(1 + 2) * 3', {})).toBe(9);
    expect(evalNumber('-2 * -3', {})).toBe(6);
    expect(evalNumber('10 % 4 + 7 / 2', {})).toBe(5.5);
    expect(evalNumber('.5 * 4', {})).toBe(2);
  });

  it('uses named variables', () => {
    expect(evalNumber('(nL + 1) * (nW + 1)', vars)).toBe(6);
    expect(evalNumber('k * 0.5', vars)).toBe(2);
  });

  it('supports comparisons, strings and and/or/not', () => {
    expect(evalBool("type == 'rolling'", vars)).toBe(true);
    expect(evalBool("type != 'rolling'", vars)).toBe(false);
    expect(evalBool("overRatio and type == 'rolling'", vars)).toBe(false);
    expect(evalBool("overRatio or type == 'rolling'", vars)).toBe(true);
    expect(evalBool('not overRatio && k >= 4', vars)).toBe(true);
    expect(evalBool('!(k < 4) || false', vars)).toBe(true);
    expect(evalBool('', vars)).toBe(true);
  });

  it('supports functions and ternary', () => {
    expect(evalNumber('min(3, k, 9)', vars)).toBe(3);
    expect(evalNumber('max(1, lifts)', vars)).toBe(2);
    expect(evalNumber('ceil(2.1) + floor(2.9) + round(2.5) + abs(-1)', {})).toBe(9);
    expect(evalNumber('liftFull ? 1 : 0', vars)).toBe(1);
    expect(evaluate("k > 9 ? 'tall' : 'short'", vars)).toBe('short');
  });

  it('treats booleans as 0/1 in arithmetic and division by zero as 0', () => {
    expect(evalNumber('liftFull * 2', vars)).toBe(2);
    expect(evalNumber('1 / 0', {})).toBe(0);
  });

  it('rejects bad syntax and unknown names with a position', () => {
    expect(() => parseExpr('1 +')).toThrow(ExprError);
    expect(() => parseExpr('(1 + 2')).toThrow(/Expected "\)"/);
    expect(() => parseExpr('foo(1)')).toThrow(/Unknown function/);
    expect(() => parseExpr('ceil(1, 2)')).toThrow(/argument/);
    expect(() => parseExpr('1 $ 2')).toThrow(/Unexpected character/);
    expect(() => evalNumber('nope + 1', vars)).toThrow(/Unknown variable "nope"/);
    expect(() => parseExpr('')).toThrow(/Empty/);
  });

  it('cannot reach JavaScript globals', () => {
    expect(() => evaluate('constructor', {})).toThrow(/Unknown variable/);
    expect(() => evaluate('__proto__', {})).toThrow(/Unknown variable/);
    expect(() => parseExpr('process.exit(1)')).toThrow();
  });

  it('lists referenced variables and validates', () => {
    expect(referencedVars("type == 'rolling' and k > lifts").sort()).toEqual(['k', 'lifts', 'type']);
    expect(validateExpr('k + 1', ['k'])).toBeNull();
    expect(validateExpr('k + q', ['k'])).toMatch(/Unknown variable: q/);
    expect(validateExpr('k +', ['k'])).toMatch(/at \d+/);
  });
});
