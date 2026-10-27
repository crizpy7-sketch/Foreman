import { useMemo } from 'react';
import { combineLoad, FOOTER } from '../../engine';
import { weightText } from '../../engine/share';
import { go } from '../router';
import { useStore } from '../store';

export function PrintView() {
  const job = useStore((s) => s.job);
  const data = useStore((s) => s.data);
  const totals = useMemo(() => combineLoad(job.towers, data), [job.towers, data]);
  return (
    <div className="mx-auto max-w-3xl bg-white p-6 text-black">
      <div className="no-print mb-4 flex gap-2">
        <button type="button" className="min-h-12 rounded-xl bg-yellow-400 px-4 font-bold" onClick={() => window.print()}>
          Print / Save as PDF
        </button>
        <button type="button" className="min-h-12 rounded-xl bg-neutral-200 px-4 font-bold" onClick={() => go('/load')}>
          Back
        </button>
      </div>
      <h1 className="text-2xl font-extrabold">Load{job.job ? ` — ${job.job}` : ''}</h1>
      <p>
        {[job.foreman && `Foreman: ${job.foreman}`, job.location && `Location: ${job.location}`, new Date().toLocaleDateString(), job.status].filter(Boolean).join(' · ')}
      </p>
      <ol className="mt-3 list-decimal pl-6">
        {totals.towers.map((t) => (
          <li key={t.entry.id}>
            <b>
              {t.entry.qty} × {t.entry.callout}
            </b>{' '}
            — {t.variant?.label} — {t.variant?.notes[0]}
          </li>
        ))}
      </ol>
      <table className="mt-4 w-full border-collapse text-left">
        <thead>
          <tr className="border-b-2 border-black">
            <th className="w-10">✓</th>
            <th className="w-14 text-right">Qty</th>
            <th className="pl-3">Part</th>
            {totals.towers.map((_, i) => (
              <th key={i} className="w-10 text-right">
                T{i + 1}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {totals.lines.map((l) => (
            <tr key={l.key} className="border-b border-neutral-400">
              <td>☐</td>
              <td className="py-1 text-right font-bold">{l.qty}</td>
              <td className="pl-3">
                {l.label} {l.metric && <span className="text-xs">({l.metric})</span>} {l.verify && <span className="text-xs font-bold">[verify]</span>}
              </td>
              {totals.towers.map((_, i) => (
                <td key={i} className="text-right">
                  {l.byTower[i] ?? ''}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-3 font-bold">
        {totals.pieces} pcs · {weightText(totals.weightKg, totals.weightComplete, data.settings.weightUnit)}
      </p>
      <p className="mt-6 border-t-2 border-black pt-2 font-semibold">{FOOTER}</p>
    </div>
  );
}
