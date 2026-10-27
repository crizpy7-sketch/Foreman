import type { AccessType, Callout, DimRequest, ParseResult, ScaffoldType } from './types';
import { formatFeetCall } from './units';

const UNITS: Record<string, number> = {
  zero: 0, oh: 0, one: 1, won: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
  eight: 8, ate: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14,
  fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
};
const TENS: Record<string, number> = {
  twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
};
const SEPARATOR_WORDS = new Set(['by', 'x']);
const isNum = (s: string | undefined) => s !== undefined && /^\d+(\.\d+)?$/.test(s);

/** Turn dictated text ("five by four by eight foot six rolling") into callout syntax ("5 x 4 x 8'6 rolling"). */
export function normalizeSpoken(input: string): string {
  let s = input
    .toLowerCase()
    .replace(/[’‘`´]/g, "'")
    .replace(/[”“″]/g, '"')
    .replace(/×/g, 'x')
    .replace(/([a-z])-([a-z])/g, '$1 $2');
  // Split "5by4" style and separate punctuation we don't care about.
  s = s.replace(/(\d)\s*by\s*(\d)/g, '$1 by $2').replace(/[,;!?]+/g, ' ');
  const words = s.split(/\s+/).filter(Boolean);

  // Common dictation mishears next to "by": "for" → four, "to/too" → two.
  for (let i = 0; i < words.length; i++) {
    const w = words[i]!;
    const nearBy = SEPARATOR_WORDS.has(words[i - 1] ?? '') || SEPARATOR_WORDS.has(words[i + 1] ?? '');
    if (nearBy && (w === 'for' || w === 'fore')) words[i] = 'four';
    if (nearBy && (w === 'to' || w === 'too')) words[i] = 'two';
  }

  const out: string[] = [];
  for (let i = 0; i < words.length; i++) {
    const w = words[i]!;
    if (w in TENS) {
      let v = TENS[w]!;
      const nx = words[i + 1];
      if (nx !== undefined && nx in UNITS && UNITS[nx]! < 10) {
        v += UNITS[nx]!;
        i++;
      }
      out.push(String(v));
    } else if (w in UNITS) {
      out.push(String(UNITS[w]));
    } else if (w === 'foot' || w === 'feet' || w === 'ft' || w === 'ft.') {
      out.push("'");
    } else if (w === 'inch' || w === 'inches') {
      out.push('"');
    } else if (w === 'meter' || w === 'meters' || w === 'metre' || w === 'metres') {
      out.push('m');
    } else if (w === 'by') {
      out.push('x');
    } else {
      out.push(w);
    }
  }

  // "2 point 5" → 2.5 ; "8 and a half" / "8 a half" → 8.5
  const merged: string[] = [];
  for (let i = 0; i < out.length; i++) {
    const w = out[i]!;
    const prev = merged[merged.length - 1];
    if (w === 'point' && isNum(prev) && isNum(out[i + 1])) {
      merged[merged.length - 1] = `${prev}.${out[i + 1]}`;
      i++;
    } else if (isNum(prev) && w === 'and' && out[i + 1] === 'a' && out[i + 2] === 'half') {
      merged[merged.length - 1] = String(Number(prev) + 0.5);
      i += 2;
    } else if (isNum(prev) && w === 'a' && out[i + 1] === 'half') {
      merged[merged.length - 1] = String(Number(prev) + 0.5);
      i += 1;
    } else {
      merged.push(w);
    }
  }

  return merged
    .join(' ')
    .replace(/(\d)\s+(['"])/g, '$1$2')
    .replace(/'\s+(\d)/g, "'$1")
    .replace(/(\d)\s+m\b/g, '$1m');
}

const DIM = String.raw`(\d+(?:\.\d+)?|\.\d+)\s*(?:(m)(?![a-z])|(')\s*(?:(\d+(?:\.\d+)?)\s*"?)?|(")|(?:ft|foot|feet)(?![a-z]))?`;
const DIMS_RE = new RegExp(String.raw`${DIM}\s*x\s*${DIM}\s*x\s*${DIM}`);

function dimFrom(g: (string | undefined)[], offset: number): DimRequest {
  const [n, m, ft, inch, inchOnly] = [g[offset], g[offset + 1], g[offset + 2], g[offset + 3], g[offset + 4]];
  const v = Number(n);
  if (m) return { raw: `${n}m`, ft: null, m: v };
  if (inchOnly) return { raw: `${n}"`, ft: v / 12, m: null };
  if (ft && inch) return { raw: `${n}'${inch}"`, ft: v + Number(inch) / 12, m: null };
  return { raw: n!, ft: v, m: null };
}

const TYPE_WORDS: Record<string, ScaffoldType> = {
  rolling: 'rolling', roll: 'rolling', rol: 'rolling', roller: 'rolling', mobile: 'rolling', r: 'rolling',
  castors: 'rolling', casters: 'rolling', wheels: 'rolling',
  stationary: 'stationary', stat: 'stationary', fixed: 'stationary', static: 'stationary', s: 'stationary',
};
const FILLER = new Set(['tower', 'scaffold', 'a', 'the', 'load', 'up', 'side', 'on', 'please', 'with', 'of', 'and', 'access']);

export function parseCallout(input: string, defaultType: ScaffoldType): ParseResult {
  const text = normalizeSpoken(input);
  let rest = text;
  let qty = 1;

  const q = /^\s*(\d+)\s*(?:@|at\b)\s*/.exec(rest);
  if (q) {
    qty = Number(q[1]);
    rest = rest.slice(q[0].length);
  }

  const d = DIMS_RE.exec(rest);
  if (!d) {
    return { ok: false, error: 'Say it as L x W x H, e.g. "5x4x8 rolling".' };
  }
  const L = dimFrom(d, 1);
  const W = dimFrom(d, 6);
  const H = dimFrom(d, 11);
  if (qty < 1) return { ok: false, error: 'Quantity must be at least 1.' };
  const zero = [L, W, H].find((x) => (x.ft ?? x.m ?? 0) <= 0);
  if (zero) return { ok: false, error: `Size "${zero.raw}" must be greater than zero.` };

  // Suffix glued to the height: "5x4x8r", "5x4x8s"
  let tail = rest.slice(0, d.index) + ' ' + rest.slice(d.index + d[0].length);
  tail = tail.replace(/^([rs])\b/, ' $1');

  let type: ScaffoldType | null = null;
  let accessSide: DimRequest | null = null;
  let accessType: AccessType | null = null;
  let moreWays = false;
  const warnings: string[] = [];

  // Access side: "access 5", "a5", "ladder on 5", "ladder on the 5' side", "access on 4"
  const acc = /\b(?:access(?:\s+on)?(?:\s+the)?|a|ladder(?:\s+on)?(?:\s+the)?)\s*(\d+(?:\.\d+)?)\s*('|ft\b|foot\b|feet\b)?(?:\s*side)?/.exec(tail);
  if (acc) {
    accessSide = { raw: acc[1]!, ft: Number(acc[1]), m: null };
    if (/ladder/.test(acc[0])) accessType = 'ladder';
    tail = tail.replace(acc[0], ' ');
  }
  if (/\bhatch\b/.test(tail)) {
    accessType = 'hatch';
    tail = tail.replace(/\bhatch(?:\s+access)?\b/, ' ');
  }
  if (/\bladder\b/.test(tail)) {
    accessType = accessType ?? 'ladder';
    tail = tail.replace(/\bladder\b/, ' ');
  }
  if (/\bmore(?:\s+ways)?\b/.test(tail)) {
    moreWays = true;
    tail = tail.replace(/\bmore(?:\s+ways)?\b/, ' ');
  }

  const ignored: string[] = [];
  for (const w of tail.split(/\s+/).filter(Boolean)) {
    const t = TYPE_WORDS[w];
    if (t) {
      if (type && type !== t) warnings.push(`Both "${type}" and "${t}" given — using ${t}.`);
      type = t;
    } else if (!FILLER.has(w)) {
      ignored.push(w);
    }
  }
  if (ignored.length) warnings.push(`Ignored: ${ignored.join(' ')}`);
  const typeExplicit = type !== null;
  if (!type) type = defaultType;

  const callout: Callout = {
    input,
    qty,
    L,
    W,
    H,
    type,
    typeExplicit,
    accessSide,
    accessType,
    moreWays,
    warnings,
  };
  return { ok: true, callout };
}

function dimText(d: DimRequest): string {
  if (d.m !== null) return `${d.m}m`;
  if (d.ft !== null && !Number.isInteger(d.ft)) return formatFeetCall(d.ft).replace(/'$/, '');
  return d.raw;
}

/** Canonical text for a callout, used as the key for "my version" and recents. */
export function canonicalCallout(c: Callout): string {
  const parts = [`${dimText(c.L)}x${dimText(c.W)}x${dimText(c.H)}`, c.type];
  if (c.accessType === 'hatch') parts.push('hatch');
  else if (c.accessSide) parts.push(`access ${c.accessSide.raw}`);
  const s = parts.join(' ');
  return c.qty > 1 ? `${c.qty}@${s}` : s;
}
