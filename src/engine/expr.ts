// Small, safe expression language for rule quantities, conditions and reaches.
// Hand-written tokenizer + recursive-descent parser. No eval / new Function.
//
// Grammar (lowest → highest precedence):
//   ternary  := or ('?' ternary ':' ternary)?
//   or       := and (('or' | '||') and)*
//   and      := not (('and' | '&&') not)*
//   not      := ('not' | '!') not | compare
//   compare  := sum (('==' | '!=' | '<' | '<=' | '>' | '>=') sum)?
//   sum      := product (('+' | '-') product)*
//   product  := unary (('*' | '/' | '%') unary)*
//   unary    := '-' unary | primary
//   primary  := number | string | 'true' | 'false' | ident | ident '(' args ')' | '(' ternary ')'

export type Value = number | string | boolean;
export type Vars = Record<string, Value>;

export type Node =
  | { t: 'num'; v: number }
  | { t: 'str'; v: string }
  | { t: 'bool'; v: boolean }
  | { t: 'var'; name: string; pos: number }
  | { t: 'call'; name: string; args: Node[]; pos: number }
  | { t: 'un'; op: '-' | 'not'; a: Node }
  | { t: 'bin'; op: string; a: Node; b: Node }
  | { t: 'tern'; c: Node; a: Node; b: Node };

export class ExprError extends Error {
  constructor(
    message: string,
    public readonly pos: number,
  ) {
    super(message);
  }
}

type Tok = { k: 'num' | 'str' | 'id' | 'op'; v: string; pos: number };

const FUNCS: Record<string, { min: number; max: number; fn: (a: number[]) => number }> = {
  min: { min: 1, max: 99, fn: (a) => Math.min(...a) },
  max: { min: 1, max: 99, fn: (a) => Math.max(...a) },
  ceil: { min: 1, max: 1, fn: (a) => Math.ceil(a[0]!) },
  floor: { min: 1, max: 1, fn: (a) => Math.floor(a[0]!) },
  round: { min: 1, max: 1, fn: (a) => Math.round(a[0]!) },
  abs: { min: 1, max: 1, fn: (a) => Math.abs(a[0]!) },
};

export const FUNCTION_NAMES = Object.keys(FUNCS);

const OPS = ['==', '!=', '<=', '>=', '&&', '||', '<', '>', '+', '-', '*', '/', '%', '(', ')', ',', '!', '?', ':'];

function tokenize(src: string): Tok[] {
  const toks: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i]!;
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    if (/[0-9.]/.test(c)) {
      const m = /^(\d+\.?\d*|\.\d+)/.exec(src.slice(i));
      if (!m) throw new ExprError(`Bad number`, i);
      toks.push({ k: 'num', v: m[0], pos: i });
      i += m[0].length;
      continue;
    }
    if (c === "'" || c === '"') {
      const end = src.indexOf(c, i + 1);
      if (end < 0) throw new ExprError('Unclosed string', i);
      toks.push({ k: 'str', v: src.slice(i + 1, end), pos: i });
      i = end + 1;
      continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      const m = /^[A-Za-z_][A-Za-z0-9_]*/.exec(src.slice(i))!;
      toks.push({ k: 'id', v: m[0], pos: i });
      i += m[0].length;
      continue;
    }
    const op = OPS.find((o) => src.startsWith(o, i));
    if (!op) throw new ExprError(`Unexpected character "${c}"`, i);
    toks.push({ k: 'op', v: op, pos: i });
    i += op.length;
  }
  return toks;
}

export function parseExpr(src: string): Node {
  const toks = tokenize(src);
  let p = 0;
  const peek = () => toks[p];
  const isOp = (...v: string[]) => {
    const t = toks[p];
    return !!t && t.k === 'op' && v.includes(t.v);
  };
  const isWord = (...v: string[]) => {
    const t = toks[p];
    return !!t && t.k === 'id' && v.includes(t.v);
  };
  const endPos = () => (toks.length ? toks[toks.length - 1]!.pos + toks[toks.length - 1]!.v.length : 0);
  const expectOp = (v: string) => {
    if (!isOp(v)) throw new ExprError(`Expected "${v}"`, peek()?.pos ?? endPos());
    p++;
  };

  const ternary = (): Node => {
    const c = or();
    if (isOp('?')) {
      p++;
      const a = ternary();
      expectOp(':');
      const b = ternary();
      return { t: 'tern', c, a, b };
    }
    return c;
  };
  const or = (): Node => {
    let a = and();
    while (isOp('||') || isWord('or')) {
      p++;
      a = { t: 'bin', op: 'or', a, b: and() };
    }
    return a;
  };
  const and = (): Node => {
    let a = not();
    while (isOp('&&') || isWord('and')) {
      p++;
      a = { t: 'bin', op: 'and', a, b: not() };
    }
    return a;
  };
  const not = (): Node => {
    if (isOp('!') || isWord('not')) {
      p++;
      return { t: 'un', op: 'not', a: not() };
    }
    return compare();
  };
  const compare = (): Node => {
    const a = sum();
    if (isOp('==', '!=', '<', '<=', '>', '>=')) {
      const op = toks[p++]!.v;
      return { t: 'bin', op, a, b: sum() };
    }
    return a;
  };
  const sum = (): Node => {
    let a = product();
    while (isOp('+', '-')) {
      const op = toks[p++]!.v;
      a = { t: 'bin', op, a, b: product() };
    }
    return a;
  };
  const product = (): Node => {
    let a = unary();
    while (isOp('*', '/', '%')) {
      const op = toks[p++]!.v;
      a = { t: 'bin', op, a, b: unary() };
    }
    return a;
  };
  const unary = (): Node => {
    if (isOp('-')) {
      p++;
      return { t: 'un', op: '-', a: unary() };
    }
    return primary();
  };
  const primary = (): Node => {
    const t = peek();
    if (!t) throw new ExprError('Unexpected end of expression', endPos());
    if (t.k === 'num') {
      p++;
      return { t: 'num', v: Number(t.v) };
    }
    if (t.k === 'str') {
      p++;
      return { t: 'str', v: t.v };
    }
    if (t.k === 'id') {
      p++;
      if (t.v === 'true' || t.v === 'false') return { t: 'bool', v: t.v === 'true' };
      if (isOp('(')) {
        p++;
        const args: Node[] = [];
        if (!isOp(')')) {
          args.push(ternary());
          while (isOp(',')) {
            p++;
            args.push(ternary());
          }
        }
        expectOp(')');
        const f = FUNCS[t.v];
        if (!f) throw new ExprError(`Unknown function "${t.v}"`, t.pos);
        if (args.length < f.min || args.length > f.max)
          throw new ExprError(`${t.v}() takes ${f.min === f.max ? f.min : `${f.min}+`} argument(s)`, t.pos);
        return { t: 'call', name: t.v, args, pos: t.pos };
      }
      return { t: 'var', name: t.v, pos: t.pos };
    }
    if (isOp('(')) {
      p++;
      const e = ternary();
      expectOp(')');
      return e;
    }
    throw new ExprError(`Unexpected "${t.v}"`, t.pos);
  };

  if (toks.length === 0) throw new ExprError('Empty expression', 0);
  const node = ternary();
  if (p < toks.length) throw new ExprError(`Unexpected "${toks[p]!.v}"`, toks[p]!.pos);
  return node;
}

function num(v: Value, what: string): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  throw new ExprError(`${what} needs a number, got '${v}'`, 0);
}

function truthy(v: Value): boolean {
  if (typeof v === 'string') return v.length > 0;
  return typeof v === 'number' ? v !== 0 : v;
}

export function evalNode(n: Node, vars: Vars): Value {
  switch (n.t) {
    case 'num':
    case 'str':
    case 'bool':
      return n.v;
    case 'var': {
      if (!Object.prototype.hasOwnProperty.call(vars, n.name))
        throw new ExprError(`Unknown variable "${n.name}"`, n.pos);
      return vars[n.name]!;
    }
    case 'call':
      return FUNCS[n.name]!.fn(n.args.map((a) => num(evalNode(a, vars), `${n.name}()`)));
    case 'un':
      return n.op === '-' ? -num(evalNode(n.a, vars), '-') : !truthy(evalNode(n.a, vars));
    case 'tern':
      return truthy(evalNode(n.c, vars)) ? evalNode(n.a, vars) : evalNode(n.b, vars);
    case 'bin': {
      if (n.op === 'and') return truthy(evalNode(n.a, vars)) && truthy(evalNode(n.b, vars));
      if (n.op === 'or') return truthy(evalNode(n.a, vars)) || truthy(evalNode(n.b, vars));
      const a = evalNode(n.a, vars);
      const b = evalNode(n.b, vars);
      if (n.op === '==') return a === b;
      if (n.op === '!=') return a !== b;
      const x = num(a, n.op);
      const y = num(b, n.op);
      switch (n.op) {
        case '+':
          return x + y;
        case '-':
          return x - y;
        case '*':
          return x * y;
        case '/':
          return y === 0 ? 0 : x / y;
        case '%':
          return y === 0 ? 0 : x % y;
        case '<':
          return x < y;
        case '<=':
          return x <= y;
        case '>':
          return x > y;
        case '>=':
          return x >= y;
      }
      throw new ExprError(`Unknown operator ${n.op}`, 0);
    }
  }
}

const cache = new Map<string, Node>();

function compiled(src: string): Node {
  let n = cache.get(src);
  if (!n) {
    n = parseExpr(src);
    cache.set(src, n);
  }
  return n;
}

export function evaluate(src: string | number, vars: Vars): Value {
  if (typeof src === 'number') return src;
  return evalNode(compiled(src), vars);
}

export function evalNumber(src: string | number, vars: Vars): number {
  const v = evaluate(src, vars);
  return num(v, 'Expression');
}

export function evalBool(src: string, vars: Vars): boolean {
  if (src.trim() === '') return true;
  return truthy(evaluate(src, vars));
}

/** Variable names referenced by an expression. */
export function referencedVars(src: string): string[] {
  const out = new Set<string>();
  const walk = (n: Node): void => {
    if (n.t === 'var') out.add(n.name);
    else if (n.t === 'call') n.args.forEach(walk);
    else if (n.t === 'un') walk(n.a);
    else if (n.t === 'bin') {
      walk(n.a);
      walk(n.b);
    } else if (n.t === 'tern') {
      walk(n.c);
      walk(n.a);
      walk(n.b);
    }
  };
  walk(parseExpr(src));
  return [...out];
}

/** Validate syntax and that all variables are known. Returns an error message or null. */
export function validateExpr(src: string, knownVars: readonly string[]): string | null {
  try {
    if (src.trim() === '') return null;
    const unknown = referencedVars(src).filter((v) => !knownVars.includes(v));
    if (unknown.length) return `Unknown variable${unknown.length > 1 ? 's' : ''}: ${unknown.join(', ')}`;
    return null;
  } catch (e) {
    if (e instanceof ExprError) return `${e.message} (at ${e.pos + 1})`;
    throw e;
  }
}
