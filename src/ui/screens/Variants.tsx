import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useState } from 'react';
import { addRecent, db } from '../../db/db';
import { canonicalCallout, enumerateVariants, myVersionKey, parseCallout, type Callout, type VariantResult } from '../../engine';
import { weightText } from '../../engine/share';
import { Badge, Button, Footer, Page } from '../components/ui';
import { go, useRoute } from '../router';
import { startWork, useStore } from '../store';

export const versionKeyFor = (c: Callout, variantKey: string) => myVersionKey(canonicalCallout({ ...c, qty: 1 }), variantKey);

export function Variants() {
  const { params } = useRoute();
  const text = params.get('c') ?? '';
  const more = params.get('more') === '1';
  const data = useStore((s) => s.data);
  const [picked, setPicked] = useState<string[]>([]);
  const parsed = useMemo(() => parseCallout(text, data.settings.defaultType), [text, data.settings.defaultType]);
  const set = useMemo(() => (parsed.ok ? enumerateVariants(parsed.callout, data, { moreWays: more }) : null), [parsed, data, more]);
  const mine = useLiveQuery(() => db.myVersions.toArray(), []) ?? [];

  useEffect(() => {
    if (parsed.ok) void addRecent(text.trim());
  }, [parsed.ok, text]);

  if (!parsed.ok || !set) {
    return (
      <Page title="Hmm">
        <p className="text-lg font-semibold text-red-700 dark:text-red-400">{parsed.ok ? '' : parsed.error}</p>
        <Button kind="primary" className="mt-4" onClick={() => go('/')}>
          Back
        </Button>
      </Page>
    );
  }
  const c = parsed.callout;
  const mineKeys = new Set(mine.map((m) => m.key));
  const open = (v: VariantResult) => {
    const mv = mine.find((m) => m.key === versionKeyFor(c, v.key));
    startWork(text.trim(), v.spec, mv?.overrides, !!mv);
    go('/list');
  };
  const toggle = (k: string) => setPicked((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p.slice(-1), k]));

  return (
    <Page
      title={`${c.qty > 1 ? `${c.qty} × ` : ''}${canonicalCallout({ ...c, qty: 1 })}`}
      actions={
        <Button onClick={() => go('/v', { c: text, more: more ? undefined : '1' })} kind={more ? 'primary' : 'secondary'}>
          More ways
        </Button>
      }
    >
      {!c.typeExplicit && <p className="mb-2 font-semibold">Type not given — using {c.type}.</p>}
      {[...set.sizeNotes, ...set.warnings].map((n) => (
        <p key={n} className="mb-2 rounded-xl border-2 border-sky-600 bg-sky-50 p-3 font-semibold text-sky-950 dark:bg-sky-950 dark:text-sky-100">
          {n}
        </p>
      ))}
      {set.variants.length === 0 && <p className="text-lg font-semibold">No build is possible with the current catalog — see below.</p>}
      <div className="flex flex-col gap-3">
        {set.variants.map((v) => (
          <VariantCard
            key={v.key}
            v={v}
            unit={data.settings.weightUnit}
            mine={mineKeys.has(versionKeyFor(c, v.key))}
            picked={picked.includes(v.key)}
            onPick={() => toggle(v.key)}
            onOpen={() => open(v)}
          />
        ))}
      </div>
      {picked.length === 2 && (
        <Button kind="primary" className="mt-3 w-full" onClick={() => go('/compare', { c: text, more: more ? '1' : undefined, a: picked[0], b: picked[1] })}>
          Compare the 2 selected
        </Button>
      )}
      {set.notPossible.length > 0 && (
        <details className="mt-5 rounded-xl border-2 border-neutral-400 p-3">
          <summary className="min-h-12 cursor-pointer content-center text-lg font-bold">
            Not possible with current catalog ({set.notPossible.length})
          </summary>
          <ul className="mt-2 flex flex-col gap-3">
            {set.notPossible.map((v) => (
              <li key={v.key}>
                <div className="font-bold">{v.label}</div>
                <ul className="ml-4 list-disc text-sm">
                  {[...v.missingParts, ...v.warnings].map((m) => (
                    <li key={m}>{m}</li>
                  ))}
                </ul>
                <Button className="mt-1" onClick={() => open(v)}>
                  Open anyway
                </Button>
              </li>
            ))}
          </ul>
        </details>
      )}
      <Footer />
    </Page>
  );
}

function VariantCard(props: { v: VariantResult; unit: 'lb' | 'kg'; mine: boolean; picked: boolean; onPick: () => void; onOpen: () => void }) {
  const { v } = props;
  const verify = v.bom.lines.filter((l) => l.verify).length;
  return (
    <div className={`rounded-2xl border-4 p-3 ${props.picked ? 'border-yellow-400' : 'border-black dark:border-neutral-500'}`}>
      <button type="button" className="w-full text-left" onClick={props.onOpen}>
        <div className="text-xl font-extrabold leading-tight">{v.label}</div>
        <div className="mt-1 text-sm text-neutral-700 dark:text-neutral-300">{v.notes[0]}</div>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-lg font-bold">
          <span>{v.bom.pieces} pcs</span>
          <span>·</span>
          <span>{weightText(v.bom.weightKg, v.bom.weightComplete, props.unit)}</span>
          {props.mine && <Badge tone="mine">my version</Badge>}
          {verify > 0 && <Badge tone="verify">{verify} to verify</Badge>}
        </div>
        {v.warnings.map((w) => (
          <div key={w} className="mt-2 rounded-lg bg-red-700 p-2 font-bold text-white">
            {w}
          </div>
        ))}
      </button>
      <label className="mt-2 flex min-h-12 items-center gap-3 font-semibold">
        <input type="checkbox" className="h-6 w-6 accent-yellow-400" checked={props.picked} onChange={props.onPick} />
        Compare
      </label>
    </div>
  );
}
