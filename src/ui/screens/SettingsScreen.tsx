import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { exportAll, getKV, importAll, setKV } from '../../db/db';
import { deckFillEntrySchema, settingsSchema, sizeMapEntrySchema } from '../../data/schema';
import type { DeckFillEntry, Settings, SizeMapEntry } from '../../engine';
import { Button, download, Field, inputCls, Page, pickFile } from '../components/ui';
import { act, getState, resetDataToSeed, toast, useStore } from '../store';

export function SettingsScreen() {
  const data = useStore((s) => s.data);
  const s = data.settings;
  const [error, setError] = useState<string | null>(null);
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const lastBackup = useLiveQuery(() => getKV<number>('lastBackup'), []);

  useEffect(() => {
    void navigator.storage?.persisted?.().then(setPersisted);
  }, []);

  const set = (patch: Partial<Settings>, label = 'Change setting') => {
    const r = settingsSchema.safeParse({ ...s, ...patch });
    if (!r.success) {
      setError(r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '));
      return;
    }
    setError(null);
    act(label, (st) => ({ data: { ...st.data, settings: r.data } }), { editsData: true });
  };

  const num = (k: keyof Settings, label: string, hint?: string, nullable = false) => (
    <Field label={label} hint={hint}>
      <input
        key={`${k}-${String(s[k])}`}
        className={inputCls}
        inputMode="decimal"
        defaultValue={s[k] === null ? '' : String(s[k])}
        onBlur={(e) => {
          const v = e.target.value.trim();
          if (v === (s[k] === null ? '' : String(s[k]))) return;
          set({ [k]: v === '' && nullable ? null : Number(v) } as Partial<Settings>, `Change ${label}`);
        }}
      />
    </Field>
  );
  const select = <K extends keyof Settings>(k: K, label: string, options: [Settings[K], string][], hint?: string) => (
    <Field label={label} hint={hint}>
      <select className={inputCls} value={String(s[k])} onChange={(e) => set({ [k]: options.find((o) => String(o[0]) === e.target.value)![0] } as Partial<Settings>, `Change ${label}`)}>
        {options.map(([v, l]) => (
          <option key={String(v)} value={String(v)}>
            {l}
          </option>
        ))}
      </select>
    </Field>
  );
  const check = (k: keyof Settings, label: string) => (
    <label className="flex min-h-12 items-center gap-3 font-semibold">
      <input type="checkbox" className="h-7 w-7 accent-yellow-400" checked={Boolean(s[k])} onChange={(e) => set({ [k]: e.target.checked } as Partial<Settings>, `Change ${label}`)} />
      {label}
    </label>
  );

  const doExport = async () => {
    const b = await exportAll(getState().data);
    download(`loadout-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(b, null, 2));
    await setKV('lastBackup', Date.now());
    toast('Backup downloaded');
  };
  const doImport = async () => {
    const text = await pickFile('.json,application/json');
    if (!text) return;
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      return setError('That file is not JSON');
    }
    if (!confirm('Replace ALL data on this phone with the backup?')) return;
    const r = await importAll(json);
    if (!r.ok) return setError(`Import failed: ${r.error}`);
    act('Import backup', () => ({ data: r.data }), { editsData: true });
    toast('Backup imported');
  };

  return (
    <Page title="Settings">
      {error && <p className="mb-3 rounded-xl bg-red-700 p-3 font-bold text-white">{error}</p>}

      <Section title="Heights">
        {select('heightMeans', 'H in a callout means', [
          ['legs', 'Leg length (10 ft scaffold = 10 ft legs)'],
          ['deck', 'Deck height above ground'],
          ['topRail', 'Top-rail height above ground'],
          ['topOfStandards', 'Ground to top of standards'],
        ])}
        {select('rounding', 'Rounding to the rosette', [
          ['nearest', 'Nearest'],
          ['up', 'Up'],
          ['down', 'Down'],
        ])}
        {num('baseOffsetRolling', 'Base offset — rolling (m)', 'Ground to base-collar rosette on castors')}
        {num('baseOffsetStationary', 'Base offset — stationary (m)', 'Ground to base-collar rosette on jacks')}
        {num('pitch', 'Rosette pitch (m)')}
        {num('midRailOffset', 'Mid-rail: levels above deck')}
        {num('topRailOffset', 'Top rail: levels above deck')}
        {num('liftHeight', 'Lift height (m)')}
        {num('standardAboveTopRail', 'Standard above top rail (m)')}
        {num('maxOvershoot', 'Max standards overshoot (m)')}
        {num('maxStandardPieces', 'Max standard pieces per leg')}
        <Field label="Preferred standard lengths (m, best first)">
          <input
            key={s.preferredStandardLengths.join(',')}
            className={inputCls}
            defaultValue={s.preferredStandardLengths.join(', ')}
            onBlur={(e) =>
              set({ preferredStandardLengths: e.target.value.split(/[,\s]+/).filter(Boolean).map(Number) }, 'Change preferred lengths')
            }
          />
        </Field>
        {num('standardsComboOptions', 'Standards combos to offer')}
      </Section>

      <Section title="Stability, access and rules">
        {num('ratioLimitRolling', 'Height ÷ base limit — rolling', 'Over this → red warning + stabilizers')}
        {num('ratioLimitStationary', 'Height ÷ base limit — stationary', 'Blank = no limit', true)}
        {select('gateType', 'At the ladder (default)', [
          ['railsStay', 'Rails stay'],
          ['gate', 'Gate'],
          ['chain', 'Chain'],
        ])}
        {select('diagonalAccess', 'Diagonal on the ladder face', [
          ['keep', 'Keep'],
          ['move', 'Move to opposite face'],
          ['omit', 'Leave out'],
        ])}
        {check('horizontalDiagonalStationary', 'Horizontal diagonals on stationary towers')}
        <Field label="Access types to offer">
          <div className="flex gap-2">
            {(['ladder', 'hatch'] as const).map((a) => (
              <label key={a} className="flex min-h-12 items-center gap-2 rounded-xl border-2 border-neutral-400 px-3 font-semibold">
                <input
                  type="checkbox"
                  className="h-6 w-6 accent-yellow-400"
                  checked={s.accessTypes.includes(a)}
                  onChange={(e) => set({ accessTypes: e.target.checked ? [...s.accessTypes, a] : s.accessTypes.filter((x) => x !== a) }, 'Change access types')}
                />
                {a}
              </label>
            ))}
          </div>
        </Field>
        {num('ladderAboveDeck', 'Ladder above deck (m)')}
        {num('ladderMaxOvershoot', 'Ladder max overshoot (m)')}
      </Section>

      <Section title="Bays and builds">
        {num('maxBaysPerDirection', 'Max bays per direction')}
        {check('allowMixedBays', 'Allow mixed bay sizes (e.g. 7\' + 3\')')}
        {num('bayOptionsShown', 'Bay options to offer')}
        {num('maxSplitDeviation', 'Max distance from the call (m)')}
        {num('maxVariants', 'Max builds to show')}
      </Section>

      <Section title="Display and defaults">
        {select('defaultType', 'Default type', [
          ['rolling', 'Rolling'],
          ['stationary', 'Stationary'],
        ])}
        {select('weightUnit', 'Weight units', [
          ['lb', 'lb'],
          ['kg', 'kg'],
        ])}
        {check('sparesEnabled', 'Spares (not applied yet)')}
        {num('sparesPercent', 'Spares %')}
        {num('sizeTolerance', 'Size match tolerance (m)')}
      </Section>

      <Section title="Yard order (pick list categories)">
        <CategoryOrder />
      </Section>
      <Section title="Size map">
        <SizeMapEditor />
      </Section>
      <Section title="Deck fill (decks across a bay)">
        <DeckFillEditor />
      </Section>

      <Section title="Your data">
        <p className="text-sm">
          Everything is stored on this phone only. {persisted === true ? 'Storage is protected from clean-up.' : persisted === false ? 'The browser may clear storage when space is low — keep backups.' : ''}
        </p>
        <p className="text-sm font-semibold">Last backup: {lastBackup ? new Date(lastBackup).toLocaleString() : 'never'}</p>
        <div className="flex flex-wrap gap-2">
          <Button kind="primary" onClick={() => void doExport()}>
            Export all (JSON)
          </Button>
          <Button onClick={() => void doImport()}>Import backup</Button>
          <Button
            onClick={() =>
              void navigator.storage?.persist?.().then((p) => {
                setPersisted(p);
                toast(p ? 'Storage protected' : 'Browser said no — keep backups');
              })
            }
          >
            Protect storage
          </Button>
          <Button kind="danger" onClick={() => confirm('Reset catalog, rules and settings to the seed data? Jobs are kept.') && resetDataToSeed()}>
            Reset to seed data
          </Button>
        </div>
        <p className="text-sm">
          The old time-charge page is still at{' '}
          <a className="underline" href="./time-charge.html">
            time-charge.html
          </a>
          .
        </p>
      </Section>
    </Page>
  );
}

function Section(props: { title: string; children: React.ReactNode }) {
  return (
    <details className="mb-3 rounded-2xl border-2 border-neutral-400 p-3" open={props.title === 'Heights'}>
      <summary className="min-h-12 cursor-pointer content-center text-lg font-extrabold">{props.title}</summary>
      <div className="mt-2 grid gap-3 sm:grid-cols-2">{props.children}</div>
    </details>
  );
}

function CategoryOrder() {
  const data = useStore((s) => s.data);
  const order = data.settings.categoryOrder;
  const label = (id: string) => data.categories.find((c) => c.id === id)?.label ?? id;
  const move = (i: number, d: -1 | 1) => {
    const next = [...order];
    const j = i + d;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j]!, next[i]!];
    act('Reorder categories', (s) => ({ data: { ...s.data, settings: { ...s.data.settings, categoryOrder: next } } }), { editsData: true });
  };
  return (
    <ol className="flex flex-col gap-1 sm:col-span-2">
      {order.map((id, i) => (
        <li key={id} className="flex items-center gap-2">
          <span className="w-6 text-right font-bold">{i + 1}</span>
          <span className="flex-1 font-semibold">{label(id)}</span>
          <Button onClick={() => move(i, -1)} className="w-12 px-0" title="Up">
            ↑
          </Button>
          <Button onClick={() => move(i, 1)} className="w-12 px-0" title="Down">
            ↓
          </Button>
        </li>
      ))}
    </ol>
  );
}

function SizeMapEditor() {
  const data = useStore((s) => s.data);
  const [err, setErr] = useState<string | null>(null);
  const save = (rows: SizeMapEntry[], label: string) => {
    for (const r of rows) {
      const p = sizeMapEntrySchema.safeParse(r);
      if (!p.success) return setErr(`${r.label || '?'}: ${p.error.issues[0]?.message}`);
    }
    setErr(null);
    act(label, (s) => ({ data: { ...s.data, sizeMap: rows } }), { editsData: true });
  };
  const rows = data.sizeMap;
  const patch = (i: number, p: Partial<SizeMapEntry>) => save(rows.map((r, j) => (j === i ? { ...r, ...p } : r)), 'Edit size map');
  return (
    <div className="sm:col-span-2">
      <p className="mb-2 text-sm">Called size (ft) → Layher length (m). Aliases are other ways the yard says it, e.g. 3.5 → 3'.</p>
      <div className="flex flex-col gap-2">
        {rows.map((r, i) => (
          <div key={`${r.label}-${i}`} className="grid grid-cols-[1fr_1fr_1fr_2fr_auto] items-center gap-1">
            <input aria-label="Label" className={inputCls} defaultValue={r.label} onBlur={(e) => e.target.value !== r.label && patch(i, { label: e.target.value })} />
            <input aria-label="Feet" className={inputCls} inputMode="decimal" defaultValue={r.ft} onBlur={(e) => Number(e.target.value) !== r.ft && patch(i, { ft: Number(e.target.value) })} />
            <input aria-label="Metres" className={inputCls} inputMode="decimal" defaultValue={r.m} onBlur={(e) => Number(e.target.value) !== r.m && patch(i, { m: Number(e.target.value) })} />
            <input
              aria-label="Aliases"
              className={inputCls}
              placeholder="aliases"
              defaultValue={r.aliases.join(', ')}
              onBlur={(e) => patch(i, { aliases: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) })}
            />
            <Button kind="ghost" className="px-2" onClick={() => save(rows.filter((_, j) => j !== i), `Remove ${r.label}`)}>
              ✕
            </Button>
          </div>
        ))}
      </div>
      {err && <p className="mt-1 font-bold text-red-700">{err}</p>}
      <Button className="mt-2" onClick={() => save([...rows, { label: "6'", ft: 6, m: 1.83, aliases: [], verify: true }], 'Add size')}>
        + Size
      </Button>
    </div>
  );
}

function fillText(e: DeckFillEntry): string {
  return e.pieces.map((p) => `${p.count}×${p.width}`).join(' + ');
}

function parseFill(t: string): DeckFillEntry['pieces'] | null {
  const parts = t.split('+').map((x) => x.trim()).filter(Boolean);
  const out = parts.map((p) => {
    const m = /^(\d+)\s*[x×*]\s*(\d*\.?\d+)$/i.exec(p);
    return m ? { count: Number(m[1]), width: Number(m[2]) } : null;
  });
  return out.every(Boolean) && out.length ? (out as DeckFillEntry['pieces']) : null;
}

function DeckFillEditor() {
  const data = useStore((s) => s.data);
  const [err, setErr] = useState<string | null>(null);
  const rows = data.deckFill;
  const save = (next: DeckFillEntry[], label: string) => {
    for (const r of next) {
      const p = deckFillEntrySchema.safeParse(r);
      if (!p.success) return setErr(`${r.bayWidth}: ${p.error.issues[0]?.message}`);
    }
    setErr(null);
    act(label, (s) => ({ data: { ...s.data, deckFill: next } }), { editsData: true });
  };
  return (
    <div className="sm:col-span-2">
      <p className="mb-2 text-sm">Bay width (m) → decks across it, written like 4×0.32 + 1×0.19.</p>
      <div className="flex flex-col gap-2">
        {rows.map((r, i) => (
          <div key={`${r.bayWidth}-${i}`} className="grid grid-cols-[1fr_2fr_auto] items-center gap-1">
            <input
              aria-label="Bay width"
              className={inputCls}
              inputMode="decimal"
              defaultValue={r.bayWidth}
              onBlur={(e) => Number(e.target.value) !== r.bayWidth && save(rows.map((x, j) => (j === i ? { ...x, bayWidth: Number(e.target.value) } : x)), 'Edit deck fill')}
            />
            <input
              aria-label="Fill"
              className={inputCls}
              defaultValue={fillText(r)}
              onBlur={(e) => {
                if (e.target.value === fillText(r)) return;
                const pieces = parseFill(e.target.value);
                if (!pieces) return setErr(`Write it like 4×0.32 + 1×0.19`);
                save(rows.map((x, j) => (j === i ? { ...x, pieces } : x)), 'Edit deck fill');
              }}
            />
            <Button kind="ghost" className="px-2" onClick={() => save(rows.filter((_, j) => j !== i), 'Remove deck fill row')}>
              ✕
            </Button>
          </div>
        ))}
      </div>
      {err && <p className="mt-1 font-bold text-red-700">{err}</p>}
      <Button className="mt-2" onClick={() => save([...rows, { bayWidth: 1.0, pieces: [{ width: 0.32, count: 3 }], verify: true }], 'Add deck fill row')}>
        + Row
      </Button>
    </div>
  );
}
