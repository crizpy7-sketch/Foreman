// M2 checkpoint: prints full lists, level breakdowns and actual heights for the checkpoint callouts.
// Usage: npm run report:m2 [-- --out docs/M2-REPORT.md]
import { writeFileSync } from 'node:fs';
import { loadSeed } from '../src/data/seed';
import {
  enumerateVariants,
  FOOTER,
  formatFtIn,
  formatM,
  formatWeight,
  parseCallout,
  type EngineData,
  type VariantResult,
} from '../src/engine';

interface Checkpoint {
  callout: string;
  moreWays?: boolean;
  expect: string;
  /** Extra what-if: activate these parts and show builds whose label starts with `layout`. */
  whatIf?: { activate: string; layout: string; why: string };
}

const CHECKPOINTS: Checkpoint[] = [
  { callout: '5x4x8 rolling', expect: 'every variant' },
  { callout: '5x4x8 stationary', expect: 'stationary base' },
  { callout: '5x4x16 rolling', expect: 'should trip the ratio warning' },
  { callout: '6x4x8 rolling', expect: "should explain there's no 6' and offer the closest builds" },
  {
    callout: '10x5x8 stationary',
    moreWays: true,
    expect: "More ways on: one 10' bay vs 2×5'",
    whatIf: { activate: 'deck-0.19x', layout: "2×5' × 5'", why: '0.19 decks switched ON (they are off in the seed catalog)' },
  },
];

function table(head: string[], rows: string[][]): string {
  const w = head.map((h, i) => Math.max(h.length, ...rows.map((r) => (r[i] ?? '').length)));
  const line = (c: string[]) => '│ ' + c.map((x, i) => x.padEnd(w[i]!)).join(' │ ') + ' │';
  const bar = (l: string, m: string, r: string) => l + w.map((x) => '─'.repeat(x + 2)).join(m) + r;
  return [bar('┌', '┬', '┐'), line(head), bar('├', '┼', '┤'), ...rows.map(line), bar('└', '┴', '┘')].join('\n');
}

function levelTable(v: VariantResult): string {
  const t = v.tower;
  const lv = t.levels;
  const rows: string[][] = [];
  for (let n = lv.topRail; n >= 0; n--) {
    const at = [
      ...new Set(v.members.filter((m) => m.level === n && m.qty > 0 && !m.levelName.startsWith('lift')).map((m) => m.ruleLabel)),
    ];
    const role = [
      n === 0 ? 'base' : '',
      lv.ledgerLevels.includes(n) && n > 0 ? 'ledger level' : '',
      n === lv.deck ? 'DECK' : '',
      n === lv.midRail ? 'mid-rail' : '',
      n === lv.topRail ? 'top-rail' : '',
    ]
      .filter(Boolean)
      .join(', ');
    if (!role && !at.length) continue;
    rows.push([String(n), formatFtIn(lv.heightOf(n)), formatM(lv.heightOf(n)), role, at.join(', ')]);
  }
  const lifts = lv.lifts.map((l) => {
    const name = `lift ${l.from}→${l.to}`;
    const inLift = [...new Set(v.members.filter((m) => m.levelName === name && m.qty > 0).map((m) => m.ruleLabel))];
    return `  ${name} (${formatM(l.height)} m${l.full ? '' : ', SHORT'}): ${inLift.join(', ') || 'no diagonals'}`;
  });
  return `${table(['Lvl', 'Height', 'm', 'Role', 'Members placed here'], rows)}\nLifts:\n${lifts.join('\n')}`;
}

function bomTable(v: VariantResult, d: EngineData): string {
  const rows = v.bom.lines.map((l) => [
    String(l.qty),
    l.label + (l.metric ? ` (${l.metric})` : ''),
    l.missing ? 'MISSING' : l.verify ? 'verify' : '',
    l.explanation.replace(/^.*? = /, ''),
  ]);
  const weight = v.bom.weightComplete ? formatWeight(v.bom.weightKg, d.settings.weightUnit) : 'weight incomplete';
  return `${table(['Qty', 'Part', 'Flag', 'Why'], rows)}\nTotal: ${v.bom.pieces} pieces · ${weight}`;
}

function variantBlock(v: VariantResult, d: EngineData, i: number): string {
  const t = v.tower;
  const out: string[] = [];
  out.push(`\n### Variant ${i + 1}: ${v.label}`);
  out.push(
    `Footprint ${formatFtIn(t.totalL)} × ${formatFtIn(t.totalW)} (${formatM(t.totalL)} × ${formatM(t.totalW)} m) · ` +
      `bays ${t.nL}×${t.nW} · ratio ${t.ratio.toFixed(2)}:1${t.ratioLimit ? ` (limit ${t.ratioLimit}:1)` : ''}`,
  );
  for (const n of v.notes) out.push(`• ${n}`);
  for (const w of v.warnings) out.push(`🔴 ${w}`);
  out.push(
    `Standards combos (per position): ${v.standardsCombos
      .map((c, k) => `${k === 0 ? '[' : ''}${c.pieces.map((p) => formatM(p)).join('+')}${k === 0 ? ']' : ''} (+${formatM(c.overshoot)})`)
      .join(' · ')}`,
  );
  out.push(levelTable(v));
  out.push(bomTable(v, d));
  return out.join('\n');
}

function report(): string {
  const d = loadSeed();
  const out: string[] = [];
  out.push('# Scaffold LoadOut — M2 checkpoint report');
  out.push('All data is seed data (verify: true everywhere). Weights are unknown, so totals say "weight incomplete".');
  out.push(
    `Settings: H means ${d.settings.heightMeans}, pitch ${d.settings.pitch} m, base offsets rolling ${d.settings.baseOffsetRolling} / stationary ${d.settings.baseOffsetStationary} m, ` +
      `rounding ${d.settings.rounding}, gate "${d.settings.gateType}", diagonal at access face "${d.settings.diagonalAccess}".`,
  );
  for (const cp of CHECKPOINTS) {
    const r = parseCallout(cp.callout, d.settings.defaultType);
    if (!r.ok) {
      out.push(`\n## "${cp.callout}" — parse error: ${r.error}`);
      continue;
    }
    const set = enumerateVariants(r.callout, d, { moreWays: cp.moreWays });
    out.push(`\n\n## "${cp.callout}"${cp.moreWays ? ' (More ways on)' : ''} — ${cp.expect}`);
    out.push('═'.repeat(78));
    for (const n of set.sizeNotes) out.push(`ℹ ${n}`);
    for (const w of set.warnings) out.push(`⚠ ${w}`);
    out.push(`${set.variants.length} possible build(s), ${set.notPossible.length} not possible with current catalog.`);
    set.variants.forEach((v, i) => out.push(variantBlock(v, d, i)));
    if (cp.whatIf) {
      const wi = cp.whatIf;
      const d2 = structuredClone(d);
      d2.catalog.filter((p) => p.id.startsWith(wi.activate)).forEach((p) => (p.active = true));
      const set2 = enumerateVariants(r.callout, d2, { moreWays: cp.moreWays });
      const picks = set2.variants.filter((v) => v.label.startsWith(wi.layout));
      out.push(`\n### WHAT-IF — ${wi.layout} with ${wi.why}`);
      picks.forEach((v, i) => out.push(variantBlock(v, d2, i)));
      if (!picks.length) out.push('(still not possible)');
    }
    if (set.notPossible.length) {
      out.push('\n### Not possible with current catalog');
      out.push(
        table(
          ['Build', 'Missing part(s)'],
          set.notPossible.map((v) => [v.label, v.missingParts.join('; ')]),
        ),
      );
    }
  }
  out.push(`\n${FOOTER}`);
  return out.join('\n');
}

const text = report();
console.log(text);
const outIdx = process.argv.indexOf('--out');
if (outIdx > 0 && process.argv[outIdx + 1]) {
  writeFileSync(process.argv[outIdx + 1]!, '```text\n' + text + '\n```\n');
}
