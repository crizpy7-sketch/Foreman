import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import type { Job } from '../../engine';
import { Badge, Button, Page } from '../components/ui';
import { go } from '../router';
import { act, getState, toast, uid } from '../store';

export function Jobs() {
  const jobs = useLiveQuery(() => db.jobs.orderBy('updatedAt').reverse().toArray(), []) ?? [];

  const open = async (j: Job) => {
    const cur = getState().job;
    if (cur.towers.length && cur.id !== j.id) await db.jobs.put(cur);
    act('Open job', () => ({ job: j, work: null }));
    go('/load');
  };
  const duplicate = async (j: Job) => {
    const now = Date.now();
    const copy: Job = { ...structuredClone(j), id: uid(), createdAt: now, updatedAt: now, status: 'draft', job: `${j.job || 'Job'} (copy)` };
    await db.jobs.put(copy);
    toast('Job duplicated');
  };

  return (
    <Page title="Jobs">
      {jobs.length === 0 && <p>No saved jobs yet. Build a load and tap “Save job”.</p>}
      <ul className="flex flex-col gap-2">
        {jobs.map((j) => (
          <li key={j.id} className="rounded-xl border-2 border-neutral-400 p-3">
            <button type="button" className="min-h-12 w-full text-left" onClick={() => void open(j)}>
              <div className="flex items-center gap-2 text-lg font-extrabold">
                {j.job || 'Untitled job'} <Badge tone={j.status === 'loaded' ? 'ok' : 'info'}>{j.status}</Badge>
              </div>
              <div className="text-sm">
                {new Date(j.updatedAt).toLocaleString()} · {j.foreman || 'no foreman'} · {j.location || 'no location'}
              </div>
              <div className="text-sm font-semibold">
                {j.towers.reduce((n, t) => n + t.qty, 0)} towers: {j.towers.map((t) => `${t.qty}× ${t.callout}`).join(', ')}
              </div>
            </button>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button onClick={() => void duplicate(j)}>Duplicate</Button>
              <Button
                onClick={() => void db.jobs.update(j.id, { status: j.status === 'loaded' ? 'draft' : 'loaded', updatedAt: Date.now() })}
              >
                Mark {j.status === 'loaded' ? 'draft' : 'loaded'}
              </Button>
              <Button kind="danger" onClick={() => confirm(`Delete “${j.job || 'Untitled job'}”?`) && void db.jobs.delete(j.id)}>
                Delete
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </Page>
  );
}
