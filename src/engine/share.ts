// Plain-text formatting of lists and loads for text messages and print. Pure.
import { FOOTER } from './footer';
import type { Job, LoadTotals } from './load';
import type { FinalList } from './overrides';
import type { WeightUnit } from './types';
import { formatWeight } from './units';

export function weightText(kg: number, complete: boolean, unit: WeightUnit): string {
  return complete ? formatWeight(kg, unit) : `≥ ${formatWeight(kg, unit)} (weight incomplete)`;
}

export function listText(title: string, list: FinalList, unit: WeightUnit): string {
  const rows = list.lines
    .filter((l) => !l.removed && l.qty > 0)
    .map((l) => `${String(l.qty).padStart(3)}  ${l.label}${l.metric ? ` (${l.metric})` : ''}${l.note ? ` — ${l.note}` : ''}`);
  return [title, ...rows, `${list.pieces} pcs · ${weightText(list.weightKg, list.weightComplete, unit)}`, '', FOOTER].join('\n');
}

export function loadText(job: Pick<Job, 'job' | 'foreman' | 'location'>, totals: LoadTotals, unit: WeightUnit, date: Date): string {
  const head = [
    `LOAD${job.job ? ` — ${job.job}` : ''}`,
    [job.foreman && `Foreman: ${job.foreman}`, job.location && `At: ${job.location}`, date.toLocaleDateString()].filter(Boolean).join(' · '),
  ];
  const towers = totals.towers.map(
    (t, i) => `T${i + 1} ${t.entry.qty}× ${t.entry.callout}${t.variant ? ` · ${t.variant.label}` : ''}${t.error ? ` (error: ${t.error})` : ''}`,
  );
  const rows = totals.lines.map((l) => `${String(l.qty).padStart(3)}  ${l.label}${l.metric ? ` (${l.metric})` : ''}`);
  return [
    ...head,
    '',
    ...towers,
    '',
    'TOTAL',
    ...rows,
    `${totals.pieces} pcs · ${totals.towerCount} tower${totals.towerCount === 1 ? '' : 's'} · ${weightText(totals.weightKg, totals.weightComplete, unit)}`,
    '',
    FOOTER,
  ].join('\n');
}
