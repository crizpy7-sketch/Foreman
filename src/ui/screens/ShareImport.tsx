import { readShare } from '../shareLink';
import { Button, Page } from '../components/ui';
import { go } from '../router';
import { act, newJob } from '../store';

export function ShareImport(props: { encoded: string }) {
  const payload = readShare(props.encoded);
  if (!payload) {
    return (
      <Page title="Shared load">
        <p className="text-lg font-semibold">This share link is damaged or from a newer version.</p>
        <Button onClick={() => go('/')}>Home</Button>
      </Page>
    );
  }
  return (
    <Page title="Shared load">
      <p className="text-lg font-bold">{payload.job || 'Untitled job'}</p>
      <p>
        {payload.foreman && `Foreman: ${payload.foreman} · `}
        {payload.location}
      </p>
      <ul className="mt-2 list-disc pl-6">
        {payload.towers.map((t) => (
          <li key={t.id}>
            {t.qty} × {t.callout}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-sm">The list is recalculated with your catalog and rules; the sender’s edits are kept.</p>
      <Button
        kind="primary"
        className="mt-4 w-full"
        onClick={() => {
          act('Import shared load', () => ({
            job: { ...newJob(), job: payload.job, foreman: payload.foreman, location: payload.location, towers: payload.towers },
          }));
          go('/load');
        }}
      >
        Open as a new load
      </Button>
    </Page>
  );
}
