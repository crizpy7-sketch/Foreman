import { describeSize } from './catalog';
import type { Bom, BomLine, Contribution, EngineData, Member } from './types';
import { partLabel } from './units';

const plural = (n: number, noun: string) => `${n} ${noun}${n === 1 ? '' : noun.endsWith('s') ? '' : 's'}`;

export function contributionText(c: Contribution): string {
  const per = c.qtyPer !== 1 ? `, ${c.qtyPer} each` : '';
  const levels = c.levelNames.length === 1 ? c.levelNames[0]! : `${c.levelNames.length} levels: ${c.levelNames.join(', ')}`;
  return `${plural(c.elements, c.scopeNoun)} × ${levels}${per}`;
}

/** "Ledger 5' × 8 = 2 edges × 4 levels: base, deck, mid-rail, top-rail". */
export function explain(label: string, qty: number, contributions: Contribution[]): string {
  const positive = contributions.filter((c) => c.qty > 0);
  const negative = contributions.filter((c) => c.qty < 0);
  let body: string;
  const first = positive[0];
  const mergeable =
    first !== undefined &&
    positive.every((c) => c.elements === first.elements && c.qtyPer === first.qtyPer && c.scopeNoun === first.scopeNoun);
  if (mergeable && positive.length > 1) {
    const merged: Contribution = { ...first, levelNames: positive.flatMap((c) => c.levelNames), qty: 0 };
    body = `${contributionText(merged)} (${positive.map((c) => c.ruleLabel).join(', ')})`;
  } else {
    body = positive.map((c) => `${contributionText(c)} (${c.ruleLabel})`).join(' + ');
  }
  for (const n of negative) body += ` − ${-n.qty} (${n.ruleLabel})`;
  return `${label} × ${qty} = ${body}`;
}

/** Step 4: aggregate members into BOM lines in yard order, each with its explanation. */
export function aggregate(members: Member[], d: EngineData, ruleNotes: Record<string, string[]> = {}): Bom {
  const tol = d.settings.sizeTolerance;
  const groups = new Map<string, Member[]>();
  for (const m of members) {
    const key = m.partId ?? `missing:${m.missing}`;
    const g = groups.get(key);
    if (g) g.push(m);
    else groups.set(key, [m]);
  }

  const lines: BomLine[] = [];
  for (const [key, ms] of groups) {
    const qty = ms.reduce((s, m) => s + m.qty, 0);
    const first = ms[0]!;
    const part = first.partId ? d.catalog.find((p) => p.id === first.partId) : undefined;

    const byRule = new Map<string, Member[]>();
    for (const m of ms) {
      const rk = `${m.ruleLabel}|${m.qty < 0 ? 'neg' : 'pos'}`;
      const g = byRule.get(rk);
      if (g) g.push(m);
      else byRule.set(rk, [m]);
    }
    const contributions: Contribution[] = [...byRule.values()].map((rm) => {
      const elements = new Set(rm.map((m) => m.elementId)).size;
      const levelNames = [...new Set(rm.map((m) => m.levelName))];
      const q = rm.reduce((s, m) => s + m.qty, 0);
      const slots = elements * levelNames.length;
      return {
        ruleId: rm[0]!.ruleId,
        ruleLabel: rm[0]!.ruleLabel,
        qty: q,
        elements,
        qtyPer: slots ? Math.round((q / slots) * 100) / 100 : q,
        levelNames,
        scopeNoun: rm[0]!.scopeNoun,
      };
    });

    let label: string;
    let metric = '';
    if (part) ({ label, metric } = partLabel(part, d.sizeMap, tol));
    else label = describeSize(first.category, first.size, d.sizeMap, d.categories, tol);

    const ruleIds = new Set(ms.map((m) => m.ruleId));
    const notes = [...new Set([...ruleIds].flatMap((id) => ruleNotes[id] ?? []))];
    lines.push({
      key,
      partId: part?.id ?? null,
      category: part?.category ?? first.category,
      label,
      metric,
      qty,
      weightKg: part?.weightKg ?? null,
      verify: part ? part.verify : true,
      missing: part ? null : first.missing,
      contributions,
      explanation: explain(label, qty, contributions),
      notes,
    });
  }

  const order = d.settings.categoryOrder;
  const catIdx = (c: string) => {
    const i = order.indexOf(c);
    return i < 0 ? order.length : i;
  };
  const sizeOf = (l: BomLine) => {
    const p = l.partId ? d.catalog.find((x) => x.id === l.partId) : undefined;
    return [p?.size ?? 0, p?.size2 ?? 0] as const;
  };
  const kept = lines.filter((l) => l.qty !== 0);
  kept.sort((a, b) => {
    const c = catIdx(a.category) - catIdx(b.category);
    if (c) return c;
    const [a1, a2] = sizeOf(a);
    const [b1, b2] = sizeOf(b);
    return b1 - a1 || b2 - a2 || a.label.localeCompare(b.label);
  });

  return summarize(kept);
}

export function summarize(lines: BomLine[]): Bom {
  let pieces = 0;
  let weightKg = 0;
  let weightComplete = true;
  for (const l of lines) {
    pieces += l.qty;
    if (l.weightKg === null) weightComplete = false;
    else weightKg += l.weightKg * l.qty;
  }
  return { lines, pieces, weightKg: Math.round(weightKg * 100) / 100, weightComplete };
}
