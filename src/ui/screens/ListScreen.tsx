import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { db } from '../../db/db';
import {
  addFreeText,
  addPart,
  applyOverrides,
  canonicalCallout,
  computeVariant,
  diffLists,
  isEmpty,
  parseCallout,
  partLabel,
  removeLine,
  resetLine,
  setAddedQty,
  setNote,
  setQty,
  splitLabel,
  swapPart,
  type FinalLine,
  type GateType,
  type DiagonalAccess,
} from '../../engine';
import { formatM } from '../../engine/units';
import { listText, weightText } from '../../engine/share';
import { Badge, Button, Field, Footer, inputCls, Page, Segmented, Sheet, Stepper, VerifyBadge } from '../components/ui';
import { TowerSvg } from '../components/TowerSvg';
import { go } from '../router';
import { act, toast, uid, useStore, type Work } from '../store';
import { versionKeyFor } from './Variants';

export function ListScreen() {
  const work = useStore((s) => s.work);
  const data = useStore((s) => s.data);
  const [lineKey, setLineKey] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [showCalc, setShowCalc] = useState(false);
  const [showDrawing, setShowDrawing] = useState(true);
  const [checked, setChecked] = useState<Set<string>>(new Set());

  const parsed = useMemo(() => (work ? parseCallout(work.callout, data.settings.defaultType) : null), [work, data.settings.defaultType]);
  const variant = useMemo(() => (work && parsed?.ok ? computeVariant(parsed.callout, data, work.spec) : null), [work, parsed, data]);
  const final = useMemo(() => (variant && work ? applyOverrides(variant.bom, work.overrides, data) : null), [variant, work, data]);
  const mvKey = parsed?.ok && variant ? versionKeyFor(parsed.callout, variant.key) : '';
  const myVersion = useLiveQuery(() => (mvKey ? db.myVersions.get(mvKey) : undefined), [mvKey]);

  if (!work || !parsed?.ok || !variant || !final) {
    return (
      <Page title="No list open">
        <Button kind="primary" onClick={() => go('/')}>
          Start a callout
        </Button>
      </Page>
    );
  }
  const c = parsed.callout;
  const spec = work.spec;
  // The callout without its "2@" qty — the qty lives on the tower.
  const name = canonicalCallout({ ...c, qty: 1 });
  const unit = data.settings.weightUnit;
  const setWork = (label: string, patch: Partial<Work>) => act(label, (s) => ({ work: s.work ? { ...s.work, ...patch } : s.work }));
  const setSpec = (label: string, patch: Partial<Work['spec']>) => setWork(label, { spec: { ...spec, ...patch } });
  const edit = (label: string, fn: (o: Work['overrides']) => Work['overrides']) => setWork(label, { overrides: fn(work.overrides) });

  const cats = data.categories;
  const catLabel = (id: string) => cats.find((x) => x.id === id)?.label ?? id;
  const groups: { cat: string; lines: FinalLine[] }[] = [];
  for (const l of final.lines) {
    const g = groups[groups.length - 1];
    if (g && g.cat === l.category) g.lines.push(l);
    else groups.push({ cat: l.category, lines: [l] });
  }
  const active = final.lines.filter((l) => !l.removed && l.qty > 0);
  const loadedCount = active.filter((l) => checked.has(l.key)).length;
  const diff = diffLists(variant.bom.lines, final.lines);
  const edited = !isEmpty(work.overrides);
  const line = final.lines.find((l) => l.key === lineKey) ?? null;

  const addToLoad = () => {
    act(work.towerId ? 'Update tower in load' : 'Add tower to load', (s) => {
      const towers = work.towerId
        ? s.job.towers.map((t) => (t.id === work.towerId ? { ...t, callout: name, spec, overrides: work.overrides } : t))
        : [...s.job.towers, { id: uid(), callout: name, spec, qty: c.qty, overrides: work.overrides }];
      return { job: { ...s.job, towers }, work: s.work && !s.work.towerId ? { ...s.work, towerId: towers[towers.length - 1]!.id } : s.work };
    });
    toast(work.towerId ? 'Tower updated in the load' : `Added ${c.qty} × tower to the load`);
  };

  const saveMine = async () => {
    await db.myVersions.put({ key: mvKey, callout: name, variantLabel: variant.label, savedAt: Date.now(), overrides: work.overrides });
    toast('Saved as your version');
  };

  const share = async () => {
    const text = listText(`${c.qty > 1 ? `${c.qty} × ` : ''}${name} · ${variant.label}`, final, unit);
    if (navigator.share) await navigator.share({ text }).catch(() => {});
    else {
      await navigator.clipboard?.writeText(text);
      toast('List copied');
    }
  };

  const sideL = splitLabel(spec.splitL);
  const sideW = splitLabel(spec.splitW);
  const accessValue = spec.accessType === 'hatch' ? 'hatch' : spec.accessAxis;

  return (
    <Page title={`${c.qty > 1 ? `${c.qty} × ` : ''}${name}`}>
      <div className="mb-2 text-xl font-extrabold leading-tight">{variant.label}</div>
      <div className="mb-2 flex flex-wrap gap-2">
        {work.fromMyVersion && <Badge tone="mine">my version</Badge>}
        {edited && <Badge tone="info">{final.editedCount} edited</Badge>}
        {final.conflicts > 0 && <Badge tone="warn">{final.conflicts} conflict{final.conflicts > 1 ? 's' : ''}</Badge>}
        {!variant.possible && <Badge tone="warn">not possible with current catalog</Badge>}
      </div>
      {variant.notes.map((n, i) => (
        <p key={n} className={i === 0 ? 'text-lg font-bold' : 'text-sm text-neutral-700 dark:text-neutral-300'}>
          {n}
        </p>
      ))}
      {[...variant.warnings, ...variant.missingParts].map((w) => (
        <p key={w} className="mt-2 rounded-lg bg-red-700 p-2 font-bold text-white">
          {w}
        </p>
      ))}

      <div className="no-print mt-4 flex flex-col gap-3 rounded-2xl border-2 border-neutral-400 p-3">
        <Segmented
          label="Access"
          value={accessValue}
          options={[
            { value: 'W', label: `Ladder ${sideW} side` },
            { value: 'L', label: `Ladder ${sideL} side` },
            { value: 'hatch', label: 'Hatch' },
          ]}
          onChange={(v) => setSpec('Change access', v === 'hatch' ? { accessType: 'hatch' } : { accessType: 'ladder', accessAxis: v })}
        />
        <Segmented
          label="Decks run"
          value={spec.spanAxis}
          options={[
            { value: 'L', label: `along ${sideL} side` },
            { value: 'W', label: `along ${sideW} side` },
          ]}
          onChange={(v) => setSpec('Change deck direction', { spanAxis: v })}
        />
        {variant.standardsCombos.length > 0 && (
          <Field label="Legs (standards per position)">
            <select
              className={inputCls}
              value={Math.min(spec.standardsComboIndex, variant.standardsCombos.length - 1)}
              onChange={(e) => setSpec('Change standards', { standardsComboIndex: Number(e.target.value) })}
            >
              {variant.standardsCombos.map((cb, i) => (
                <option key={i} value={i}>
                  {cb.pieces.map((p) => formatM(p)).join(' + ')} m{cb.overshoot ? ` (+${formatM(cb.overshoot)} over)` : ''} · {cb.pieces.length} pc
                </option>
              ))}
            </select>
          </Field>
        )}
        <Segmented<GateType>
          label="At the ladder"
          value={spec.gateType}
          options={[
            { value: 'railsStay', label: 'Rails stay' },
            { value: 'gate', label: 'Gate' },
            { value: 'chain', label: 'Chain' },
          ]}
          onChange={(v) => setSpec('Change gate', { gateType: v })}
        />
        <Segmented<DiagonalAccess>
          label="Diagonal on ladder face"
          value={spec.diagonalAccess}
          options={[
            { value: 'keep', label: 'Keep' },
            { value: 'move', label: 'Move opposite' },
            { value: 'omit', label: 'Leave out' },
          ]}
          onChange={(v) => setSpec('Change diagonal', { diagonalAccess: v })}
        />
      </div>

      <div className="no-print mt-3">
        <Button onClick={() => setShowDrawing(!showDrawing)}>{showDrawing ? 'Hide drawing' : 'Show drawing'}</Button>
      </div>
      {showDrawing && <TowerSvg variant={variant} sizeMap={data.sizeMap} tol={data.settings.sizeTolerance} />}

      {(work.fromMyVersion || edited) && (
        <div className="no-print mt-3">
          <Button onClick={() => setShowCalc(!showCalc)}>{showCalc ? 'Hide calculated' : 'Show calculated + diff'}</Button>
          {showCalc && (
            <div className="mt-2 rounded-xl border-2 border-violet-500 p-3">
              <h3 className="font-bold">Your list vs calculated</h3>
              {diff.length === 0 && <p>No differences.</p>}
              <table className="mt-1 w-full text-left">
                <tbody>
                  {diff.map((r) => (
                    <tr key={r.key} className="border-t border-neutral-300 dark:border-neutral-700">
                      <td className="py-1">{r.label}</td>
                      <td className="text-right">calc {r.a}</td>
                      <td className="text-right font-bold">yours {r.b}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <div className="mt-4 flex flex-col gap-4">
        {groups.map((g) => (
          <div key={g.cat}>
            <h3 className="mb-1 border-b-2 border-black text-sm font-extrabold uppercase tracking-wide dark:border-neutral-500">{catLabel(g.cat)}</h3>
            <ul className="flex flex-col">
              {g.lines.map((l) => (
                <li
                  key={l.key}
                  className={`flex items-center gap-2 border-b border-neutral-300 py-1 dark:border-neutral-800 ${l.edited ? 'bg-sky-100 dark:bg-sky-950' : ''} ${l.removed ? 'opacity-50' : ''}`}
                >
                  <input
                    type="checkbox"
                    aria-label={`Loaded ${l.label}`}
                    className="no-print h-8 w-8 shrink-0 accent-green-600"
                    checked={checked.has(l.key)}
                    onChange={() =>
                      setChecked((s) => {
                        const n = new Set(s);
                        if (n.has(l.key)) n.delete(l.key);
                        else n.add(l.key);
                        return n;
                      })
                    }
                  />
                  <button type="button" className="flex min-h-12 flex-1 items-center gap-3 text-left" onClick={() => setLineKey(l.key)}>
                    <span className={`w-12 text-right text-2xl font-extrabold ${l.removed ? 'line-through' : ''}`}>{l.qty}</span>
                    <span className="flex-1">
                      <span className={`text-lg font-bold ${l.removed ? 'line-through' : ''}`}>{l.label}</span>{' '}
                      {l.metric && <span className="text-xs text-neutral-600 dark:text-neutral-400">({l.metric})</span>}
                      <span className="ml-1 inline-flex flex-wrap gap-1 align-middle">
                        {l.verify && <VerifyBadge />}
                        {l.edited && <Badge tone="info">edited</Badge>}
                        {l.conflict && <Badge tone="warn">conflict</Badge>}
                        {l.missing && <Badge tone="warn">missing</Badge>}
                        {l.note && <Badge tone="mine">note</Badge>}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="no-print mt-4 flex flex-wrap gap-2">
        <Button onClick={() => setAdding(true)}>+ Add item</Button>
        {edited && (
          <Button kind="danger" onClick={() => edit('Reset all edits', () => ({ edits: {}, added: [] }))}>
            Reset all
          </Button>
        )}
        <Button onClick={() => void saveMine()} title="This exact callout + variant will load your version">
          Save as my version
        </Button>
        {myVersion && (
          <Button kind="ghost" onClick={() => void db.myVersions.delete(mvKey).then(() => toast('Your version removed'))}>
            Remove my version
          </Button>
        )}
        <Button onClick={() => void share()}>Share list</Button>
      </div>
      <Footer />

      <div className="no-print fixed inset-x-0 bottom-14 z-30 border-t-2 border-black bg-yellow-300 px-3 py-2 text-black">
        <div className="mx-auto flex max-w-2xl items-center gap-2">
          <div className="flex-1 leading-tight">
            <div className="text-xl font-extrabold">{final.pieces} pcs</div>
            <div className="text-sm font-semibold">
              {weightText(final.weightKg, final.weightComplete, unit)} · loaded {loadedCount}/{active.length}
            </div>
          </div>
          <Button kind="secondary" className="!bg-black !text-yellow-300" onClick={addToLoad}>
            {work.towerId ? 'Update load' : 'Add to load'}
          </Button>
        </div>
      </div>

      <LineSheet
        line={line}
        work={work}
        onClose={() => setLineKey(null)}
        edit={edit}
        data={data}
        baseBom={variant.bom}
      />
      <AddSheet open={adding} onClose={() => setAdding(false)} data={data} edit={edit} />
    </Page>
  );
}

function LineSheet(props: {
  line: FinalLine | null;
  work: Work;
  onClose: () => void;
  edit: (label: string, fn: (o: Work['overrides']) => Work['overrides']) => void;
  data: ReturnType<typeof useStore<import('../../engine').EngineData>>;
  baseBom: import('../../engine').Bom;
}) {
  const { line, data, baseBom, edit } = props;
  if (!line) return null;
  const isAdded = line.source === 'added';
  const swaps = data.catalog.filter((p) => p.active && p.category === line.category);
  const part = line.partId ? data.catalog.find((p) => p.id === line.partId) : undefined;
  const setQ = (n: number) =>
    edit(`Qty ${line.label}`, (o) => (isAdded ? setAddedQty(o, line.key, n) : setQty(o, baseBom, line.key, n)));
  return (
    <Sheet open onClose={props.onClose} title={line.label}>
      <p className="text-sm text-neutral-600 dark:text-neutral-400">{line.metric}</p>
      <div className="mt-2 rounded-xl bg-neutral-100 p-3 text-base dark:bg-neutral-800">
        <div className="font-bold">Why this many</div>
        <p>{line.explanation}</p>
        {line.notes.map((n) => (
          <p key={n} className="mt-1 font-semibold text-orange-800 dark:text-orange-300">
            {n}
          </p>
        ))}
        {line.calcQty !== null && line.edited && <p className="mt-1">Calculated: {line.calcQty}</p>}
        {line.swappedFrom && <p className="mt-1">Swapped from {line.swappedFrom}</p>}
        {line.conflict && <p className="mt-1 font-bold text-red-700 dark:text-red-400">{line.conflict}</p>}
        {line.missing && <p className="mt-1 font-bold text-red-700 dark:text-red-400">{line.missing}</p>}
      </div>
      {part && (
        <div className="mt-2 text-sm">
          {part.articleNo && <div>Layher art. {part.articleNo}</div>}
          {part.weightKg !== null && <div>{part.weightKg} kg each</div>}
          {part.yardLocation && <div>Yard: {part.yardLocation}</div>}
          {part.verify && (
            <div className="mt-1">
              <VerifyBadge /> {part.notes}
            </div>
          )}
          {part.source && (
            <a className="underline" href={part.source} target="_blank" rel="noreferrer">
              Source
            </a>
          )}
        </div>
      )}
      <div className="mt-4 flex flex-col gap-4">
        <Field label="Quantity">
          <Stepper value={line.qty} onChange={setQ} />
        </Field>
        {!isAdded && swaps.length > 1 && (
          <Field label="Swap to another size">
            <select
              className={inputCls}
              value={line.partId ?? ''}
              onChange={(e) => edit(`Swap ${line.label}`, (o) => swapPart(o, baseBom, line.key, e.target.value))}
            >
              {swaps.map((p) => {
                const pl = partLabel(p, data.sizeMap, data.settings.sizeTolerance);
                return (
                  <option key={p.id} value={p.id}>
                    {pl.label} {pl.metric && `(${pl.metric})`}
                  </option>
                );
              })}
            </select>
          </Field>
        )}
        <Field label="Note">
          <input
            className={inputCls}
            defaultValue={line.note ?? ''}
            placeholder="e.g. use the new ones"
            onBlur={(e) => e.target.value !== (line.note ?? '') && edit(`Note ${line.label}`, (o) => setNote(o, baseBom, line.key, e.target.value))}
          />
        </Field>
        <div className="flex flex-wrap gap-2">
          {!isAdded && !line.removed && (
            <Button kind="danger" onClick={() => edit(`Remove ${line.label}`, (o) => removeLine(o, baseBom, line.key))}>
              Remove line
            </Button>
          )}
          {line.edited && (
            <Button onClick={() => edit(`Reset ${line.label}`, (o) => resetLine(o, line.key))}>{isAdded ? 'Delete added item' : 'Reset line'}</Button>
          )}
        </div>
      </div>
    </Sheet>
  );
}

function AddSheet(props: {
  open: boolean;
  onClose: () => void;
  data: import('../../engine').EngineData;
  edit: (label: string, fn: (o: Work['overrides']) => Work['overrides']) => void;
}) {
  const { data } = props;
  const [cat, setCat] = useState(data.categories[0]?.id ?? '');
  const [partId, setPartId] = useState('');
  const [text, setText] = useState('');
  const [qty, setQty2] = useState(1);
  const parts = data.catalog.filter((p) => p.active && p.category === cat);
  return (
    <Sheet open={props.open} onClose={props.onClose} title="Add item">
      <div className="flex flex-col gap-3">
        <Field label="Category">
          <select className={inputCls} value={cat} onChange={(e) => (setCat(e.target.value), setPartId(''))}>
            {data.categories.map((x) => (
              <option key={x.id} value={x.id}>
                {x.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Part">
          <select className={inputCls} value={partId} onChange={(e) => setPartId(e.target.value)}>
            <option value="">— choose —</option>
            {parts.map((p) => {
              const pl = partLabel(p, data.sizeMap, data.settings.sizeTolerance);
              return (
                <option key={p.id} value={p.id}>
                  {pl.label} {pl.metric && `(${pl.metric})`}
                </option>
              );
            })}
          </select>
        </Field>
        <Field label="…or free text">
          <input className={inputCls} value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. ratchet straps" />
        </Field>
        <Field label="Quantity">
          <Stepper value={qty} onChange={setQty2} />
        </Field>
        <Button
          kind="primary"
          disabled={!partId && !text.trim()}
          onClick={() => {
            props.edit('Add item', (o) => (partId ? addPart(o, uid(), partId, qty) : addFreeText(o, uid(), text.trim(), qty)));
            setText('');
            setPartId('');
            setQty2(1);
            props.onClose();
          }}
        >
          Add
        </Button>
      </div>
    </Sheet>
  );
}
