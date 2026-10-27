import { useMemo, useState } from 'react';
import { db } from '../../db/db';
import { combineLoad, loadText, type JobStatus } from '../../engine';
import { weightText } from '../../engine/share';
import { Badge, Button, Field, Footer, inputCls, Page, Segmented, Stepper, VerifyBadge } from '../components/ui';
import { go } from '../router';
import { shareUrl } from '../shareLink';
import { act, newJob, startWork, toast, useStore } from '../store';

export function LoadScreen() {
  const job = useStore((s) => s.job);
  const data = useStore((s) => s.data);
  const [breakdown, setBreakdown] = useState(false);
  const totals = useMemo(() => combineLoad(job.towers, data), [job.towers, data]);
  const unit = data.settings.weightUnit;
  const setMeta = (patch: Partial<typeof job>) => act('Edit job details', (s) => ({ job: { ...s.job, ...patch } }), { noUndo: true });

  const save = async () => {
    await db.jobs.put(job);
    toast('Job saved');
  };
  const text = () => loadText(job, totals, unit, new Date());
  const copy = async () => {
    await navigator.clipboard?.writeText(text());
    toast('Copied — paste it into a text');
  };
  const webShare = async () => {
    if (navigator.share) await navigator.share({ title: job.job || 'Load', text: text() }).catch(() => {});
    else void copy();
  };
  const link = async () => {
    const url = shareUrl(job);
    if (navigator.share) await navigator.share({ title: job.job || 'Load', url }).catch(() => {});
    else {
      await navigator.clipboard?.writeText(url);
      toast('Share link copied');
    }
  };

  return (
    <Page title="Load">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Job / name">
          <input className={inputCls} defaultValue={job.job} key={`j${job.id}`} onBlur={(e) => setMeta({ job: e.target.value })} />
        </Field>
        <Field label="Foreman">
          <input className={inputCls} defaultValue={job.foreman} key={`f${job.id}`} onBlur={(e) => setMeta({ foreman: e.target.value })} />
        </Field>
        <Field label="Location">
          <input className={inputCls} defaultValue={job.location} key={`l${job.id}`} onBlur={(e) => setMeta({ location: e.target.value })} />
        </Field>
        <Segmented<JobStatus>
          label="Status"
          value={job.status}
          options={[
            { value: 'draft', label: 'Draft' },
            { value: 'loaded', label: 'Loaded' },
          ]}
          onChange={(v) => act('Change status', (s) => ({ job: { ...s.job, status: v } }))}
        />
      </div>

      <h2 className="mt-5 text-lg font-bold">Towers</h2>
      {job.towers.length === 0 && (
        <p className="mt-2">
          No towers yet.{' '}
          <button type="button" className="font-bold underline" onClick={() => go('/')}>
            Add one
          </button>
        </p>
      )}
      <ul className="mt-2 flex flex-col gap-2">
        {totals.towers.map((t, i) => (
          <li key={t.entry.id} className="rounded-xl border-2 border-neutral-400 p-2">
            <div className="flex items-start justify-between gap-2">
              <button
                type="button"
                className="min-h-12 flex-1 text-left"
                onClick={() => {
                  startWork(t.entry.callout, t.entry.spec, t.entry.overrides, false, t.entry.id);
                  go('/list');
                }}
              >
                <div className="text-lg font-extrabold">
                  T{i + 1} · {t.entry.callout}
                </div>
                <div className="text-sm">{t.variant?.label ?? t.error}</div>
                <div className="text-sm font-semibold">
                  {t.list?.pieces ?? 0} pcs each
                  {t.list && t.list.editedCount > 0 && (
                    <>
                      {' '}
                      <Badge tone="info">edited</Badge>
                    </>
                  )}
                  {t.list && t.list.conflicts > 0 && (
                    <>
                      {' '}
                      <Badge tone="warn">conflict</Badge>
                    </>
                  )}
                </div>
              </button>
              <Stepper
                value={t.entry.qty}
                label="Tower qty"
                onChange={(n) =>
                  act('Change tower qty', (s) => ({
                    job: { ...s.job, towers: s.job.towers.map((x) => (x.id === t.entry.id ? { ...x, qty: Math.max(1, n) } : x)) },
                  }))
                }
              />
            </div>
            <Button
              kind="ghost"
              onClick={() => act('Remove tower', (s) => ({ job: { ...s.job, towers: s.job.towers.filter((x) => x.id !== t.entry.id) } }))}
            >
              Remove tower
            </Button>
          </li>
        ))}
      </ul>

      {job.towers.length > 0 && (
        <>
          <div className="mt-5 flex items-center justify-between">
            <h2 className="text-lg font-bold">Combined totals</h2>
            <Button onClick={() => setBreakdown(!breakdown)}>{breakdown ? 'Hide per tower' : 'Per tower'}</Button>
          </div>
          <table className="mt-2 w-full text-left">
            <thead>
              <tr className="border-b-2 border-black text-sm dark:border-neutral-500">
                <th className="w-14 py-1 text-right">Qty</th>
                <th className="pl-3">Part</th>
                {breakdown && totals.towers.map((_, i) => <th key={i} className="w-10 text-right">T{i + 1}</th>)}
              </tr>
            </thead>
            <tbody>
              {totals.lines.map((l) => (
                <tr key={l.key} className="border-b border-neutral-300 dark:border-neutral-800">
                  <td className="py-2 text-right text-xl font-extrabold">{l.qty}</td>
                  <td className="pl-3">
                    <span className="font-bold">{l.label}</span> {l.metric && <span className="text-xs">({l.metric})</span>} {l.verify && <VerifyBadge />}
                  </td>
                  {breakdown && totals.towers.map((_, i) => <td key={i} className="text-right">{l.byTower[i] ?? '–'}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-lg font-extrabold">
            {totals.pieces} pcs · {totals.towerCount} tower{totals.towerCount === 1 ? '' : 's'} · {weightText(totals.weightKg, totals.weightComplete, unit)}
          </p>
        </>
      )}

      <div className="mt-5 grid grid-cols-2 gap-2">
        <Button kind="primary" onClick={() => void save()}>
          Save job
        </Button>
        <Button onClick={() => void copy()} disabled={!job.towers.length}>
          Copy as text
        </Button>
        <Button onClick={() => void webShare()} disabled={!job.towers.length}>
          Share…
        </Button>
        <Button onClick={() => void link()} disabled={!job.towers.length}>
          Share link
        </Button>
        <Button onClick={() => go('/print')} disabled={!job.towers.length}>
          Print / PDF
        </Button>
        <Button
          kind="danger"
          onClick={() => {
            if (job.towers.length && !confirm('Start a new load? Save this one first if you need it.')) return;
            act('New load', () => ({ job: newJob(), work: null }));
          }}
        >
          New load
        </Button>
      </div>
      <Footer />
    </Page>
  );
}
