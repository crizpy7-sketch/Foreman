import { useMemo } from 'react';
import { diffLists, enumerateVariants, parseCallout } from '../../engine';
import { Button, Footer, Page } from '../components/ui';
import { go, useRoute } from '../router';
import { useStore } from '../store';

export function Compare() {
  const { params } = useRoute();
  const data = useStore((s) => s.data);
  const text = params.get('c') ?? '';
  const more = params.get('more') === '1';
  const set = useMemo(() => {
    const r = parseCallout(text, data.settings.defaultType);
    return r.ok ? enumerateVariants(r.callout, data, { moreWays: more }) : null;
  }, [text, more, data]);
  const all = set ? [...set.variants, ...set.notPossible] : [];
  const a = all.find((v) => v.key === params.get('a'));
  const b = all.find((v) => v.key === params.get('b'));
  if (!a || !b) {
    return (
      <Page title="Compare">
        <p>Pick two builds to compare.</p>
        <Button onClick={() => go('/v', { c: text, more: more ? '1' : undefined })}>Back</Button>
      </Page>
    );
  }
  const rows = diffLists(a.bom.lines, b.bom.lines);
  return (
    <Page title="Compare">
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl border-4 border-black p-2 font-bold dark:border-neutral-500">
          A: {a.label}
          <div className="text-sm font-semibold">{a.bom.pieces} pcs</div>
        </div>
        <div className="rounded-xl border-4 border-yellow-400 p-2 font-bold">
          B: {b.label}
          <div className="text-sm font-semibold">{b.bom.pieces} pcs</div>
        </div>
      </div>
      <h2 className="mt-4 text-lg font-bold">Only the lines that differ ({rows.length})</h2>
      {rows.length === 0 && <p>These two builds use the same parts.</p>}
      <table className="mt-2 w-full text-left text-lg">
        <thead>
          <tr className="border-b-2 border-black dark:border-neutral-500">
            <th className="py-1">Part</th>
            <th className="w-14 text-right">A</th>
            <th className="w-14 text-right">B</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className="border-b border-neutral-300 dark:border-neutral-700">
              <td className="py-2 font-semibold">{r.label}</td>
              <td className="text-right font-bold">{r.a}</td>
              <td className="text-right font-bold">{r.b}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <Button className="mt-4" onClick={() => go('/v', { c: text, more: more ? '1' : undefined })}>
        Back to builds
      </Button>
      <Footer />
    </Page>
  );
}
