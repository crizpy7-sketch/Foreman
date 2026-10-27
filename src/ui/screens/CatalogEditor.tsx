import { useState } from 'react';
import { catalogToCsv, csvToCatalog } from '../../data/csv';
import { partSchema } from '../../data/schema';
import { partLabel, type Part } from '../../engine';
import { Badge, Button, download, Field, inputCls, Page, pickFile, Sheet, VerifyBadge } from '../components/ui';
import { act, toast, useStore } from '../store';

const blank = (category: string): Part => ({
  id: '',
  name: '',
  category,
  size: null,
  size2: null,
  nominal: null,
  articleNo: null,
  weightKg: null,
  yardLocation: '',
  companions: [],
  replacesDecks: null,
  active: true,
  verify: true,
  source: null,
  notes: '',
});

export function CatalogEditor() {
  const data = useStore((s) => s.data);
  const [cat, setCat] = useState('');
  const [q, setQ] = useState('');
  const [showOff, setShowOff] = useState(true);
  const [editing, setEditing] = useState<{ part: Part; isNew: boolean } | null>(null);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const tol = data.settings.sizeTolerance;
  const catLabel = (id: string) => data.categories.find((c) => c.id === id)?.label ?? id;
  const parts = data.catalog.filter(
    (p) =>
      (!cat || p.category === cat) &&
      (showOff || p.active) &&
      (!q || `${p.id} ${p.name} ${p.articleNo ?? ''} ${partLabel(p, data.sizeMap, tol).label}`.toLowerCase().includes(q.toLowerCase())),
  );

  const setActive = (p: Part, active: boolean) =>
    act(`${active ? 'Activate' : 'Deactivate'} ${p.name}`, (s) => ({ data: { ...s.data, catalog: s.data.catalog.map((x) => (x.id === p.id ? { ...x, active } : x)) } }), {
      editsData: true,
    });

  const importCsv = async () => {
    const text = await pickFile('.csv,text/csv');
    if (!text) return;
    const { parts: rows, errors } = csvToCatalog(text);
    setImportErrors(errors);
    if (!rows.length) return;
    act(
      `Import ${rows.length} parts from CSV`,
      (s) => {
        const byId = new Map(s.data.catalog.map((p) => [p.id, p]));
        for (const r of rows) byId.set(r.id, r);
        return { data: { ...s.data, catalog: [...byId.values()] } };
      },
      { editsData: true },
    );
    toast(`Imported ${rows.length} parts${errors.length ? `, ${errors.length} rows skipped` : ''}`);
  };

  return (
    <Page
      title="Parts catalog"
      actions={
        <Button kind="primary" onClick={() => setEditing({ part: blank(cat || 'other'), isNew: true })}>
          + Part
        </Button>
      }
    >
      <div className="grid gap-2 sm:grid-cols-2">
        <select className={inputCls} value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Category">
          <option value="">All categories</option>
          {data.categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
        <input className={inputCls} placeholder="Search name, size, article…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <label className="mt-2 flex min-h-12 items-center gap-3 font-semibold">
        <input type="checkbox" className="h-6 w-6 accent-yellow-400" checked={showOff} onChange={(e) => setShowOff(e.target.checked)} />
        Show inactive parts
      </label>
      <div className="mt-2 flex flex-wrap gap-2">
        <Button onClick={() => download('loadout-catalog.csv', catalogToCsv(data.catalog), 'text/csv')}>Export CSV</Button>
        <Button onClick={() => void importCsv()}>Import CSV</Button>
      </div>
      {importErrors.length > 0 && (
        <ul className="mt-2 list-disc rounded-xl bg-red-100 p-3 pl-6 text-sm text-red-950 dark:bg-red-950 dark:text-red-100">
          {importErrors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-sm">{parts.length} parts · inactive parts are never chosen by the calculator.</p>
      <ul className="mt-2 flex flex-col">
        {parts.map((p) => {
          const pl = partLabel(p, data.sizeMap, tol);
          return (
            <li key={p.id} className={`flex items-center gap-2 border-b border-neutral-300 py-1 dark:border-neutral-800 ${p.active ? '' : 'opacity-60'}`}>
              <button type="button" className="min-h-12 flex-1 text-left" onClick={() => setEditing({ part: p, isNew: false })}>
                <div className="font-bold">
                  {pl.label} {pl.metric && <span className="text-xs font-normal">({pl.metric})</span>}
                </div>
                <div className="flex flex-wrap items-center gap-1 text-xs">
                  <span>{catLabel(p.category)}</span>
                  {p.articleNo && <span>· art. {p.articleNo}</span>}
                  {p.weightKg !== null && <span>· {p.weightKg} kg</span>}
                  {p.yardLocation && <span>· {p.yardLocation}</span>}
                  {p.verify && <VerifyBadge />}
                  {!p.active && <Badge tone="warn">off</Badge>}
                </div>
              </button>
              <label className="flex min-h-12 items-center gap-2 text-sm font-semibold">
                <input type="checkbox" className="h-7 w-7 accent-green-600" checked={p.active} onChange={(e) => setActive(p, e.target.checked)} />
                on
              </label>
            </li>
          );
        })}
      </ul>
      {editing && <PartSheet key={editing.part.id || 'new'} part={editing.part} isNew={editing.isNew} onClose={() => setEditing(null)} />}
    </Page>
  );
}

function PartSheet(props: { part: Part; isNew: boolean; onClose: () => void }) {
  const data = useStore((s) => s.data);
  const [p, setP] = useState<Part>(props.part);
  const [companions, setCompanions] = useState(props.part.companions.map((c) => `${c.partId}:${c.qty}`).join('; '));
  const [error, setError] = useState<string | null>(null);
  const num = (v: string) => (v.trim() === '' ? null : Number(v));
  const usedByRules = data.rules.filter((r) => r.partId === p.id).map((r) => r.label);

  const save = () => {
    const comp = companions
      .split(';')
      .map((x) => x.trim())
      .filter(Boolean)
      .map((x) => {
        const [partId, qty] = x.split(':');
        return { partId: (partId ?? '').trim(), qty: Number(qty ?? 1) };
      });
    const candidate = { ...p, companions: comp };
    const r = partSchema.safeParse(candidate);
    if (!r.success) return setError(r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '));
    if (props.isNew && data.catalog.some((x) => x.id === candidate.id)) return setError(`Id "${candidate.id}" already exists`);
    const unknown = comp.filter((c) => !data.catalog.some((x) => x.id === c.partId));
    if (unknown.length) return setError(`Unknown companion part: ${unknown.map((u) => u.partId).join(', ')}`);
    act(
      props.isNew ? `Add part ${r.data.name}` : `Edit part ${r.data.name}`,
      (s) => ({
        data: {
          ...s.data,
          catalog: props.isNew ? [...s.data.catalog, r.data] : s.data.catalog.map((x) => (x.id === props.part.id ? r.data : x)),
        },
      }),
      { editsData: true },
    );
    props.onClose();
  };

  const text = (k: keyof Part, label: string, hint?: string) => (
    <Field label={label} hint={hint}>
      <input
        className={inputCls}
        value={(p[k] as string | null) ?? ''}
        onChange={(e) => setP({ ...p, [k]: e.target.value === '' && k !== 'name' && k !== 'id' && k !== 'yardLocation' && k !== 'notes' ? null : e.target.value })}
      />
    </Field>
  );
  const number = (k: 'size' | 'size2' | 'weightKg' | 'replacesDecks', label: string, hint?: string) => (
    <Field label={label} hint={hint}>
      <input className={inputCls} inputMode="decimal" value={p[k] ?? ''} onChange={(e) => setP({ ...p, [k]: num(e.target.value) })} />
    </Field>
  );

  return (
    <Sheet open onClose={props.onClose} title={props.isNew ? 'New part' : p.name}>
      <div className="grid gap-3 sm:grid-cols-2">
        {props.isNew ? text('id', 'Id (unique)', 'e.g. ledger-1.57') : <Field label="Id">{<div className="min-h-12 content-center font-mono">{p.id}</div>}</Field>}
        {text('name', 'Name')}
        <Field label="Category">
          <select className={inputCls} value={p.category} onChange={(e) => setP({ ...p, category: e.target.value })}>
            {data.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </Field>
        {number('size', 'Size (m)', 'Length. Blank for castor, collar…')}
        {number('size2', 'Size 2 (m)', 'Deck width, or W of an H-diagonal')}
        {text('nominal', 'Nominal label', 'Yard name, e.g. 10\'. Blank = from size map')}
        {text('articleNo', 'Layher article no.')}
        {number('weightKg', 'Weight (kg)')}
        {text('yardLocation', 'Yard location')}
        <Field label="Companions" hint="partId:qty; e.g. ladder-fixing:1">
          <input className={inputCls} value={companions} onChange={(e) => setCompanions(e.target.value)} />
        </Field>
        {number('replacesDecks', 'Replaces decks', 'Hatch decks: how many decks one replaces')}
        {text('source', 'Source (URL)', 'Official Layher document for article no. / weight')}
        <Field label="Notes">
          <textarea className={`${inputCls} min-h-20 py-2`} value={p.notes} onChange={(e) => setP({ ...p, notes: e.target.value })} />
        </Field>
        <label className="flex min-h-12 items-center gap-3 font-semibold">
          <input type="checkbox" className="h-7 w-7 accent-green-600" checked={p.active} onChange={(e) => setP({ ...p, active: e.target.checked })} />
          Active (we stock it)
        </label>
        <label className="flex min-h-12 items-center gap-3 font-semibold">
          <input type="checkbox" className="h-7 w-7 accent-orange-500" checked={p.verify} onChange={(e) => setP({ ...p, verify: e.target.checked })} />
          Needs verifying
        </label>
      </div>
      {(p.articleNo || p.weightKg !== null) && !p.source && (
        <p className="mt-2 font-semibold text-orange-800 dark:text-orange-300">Add the Layher document URL in Source for the article no. / weight.</p>
      )}
      {error && <p className="mt-2 font-bold text-red-700 dark:text-red-400">{error}</p>}
      <div className="mt-4 flex flex-wrap gap-2">
        <Button kind="primary" onClick={save}>
          Save part
        </Button>
        {!props.isNew && (
          <Button
            kind="danger"
            disabled={usedByRules.length > 0}
            title={usedByRules.length ? `Used by rule(s): ${usedByRules.join(', ')}` : undefined}
            onClick={() => {
              if (!confirm(`Delete ${p.name}? Deactivating keeps it for later.`)) return;
              act(`Delete part ${p.name}`, (s) => ({ data: { ...s.data, catalog: s.data.catalog.filter((x) => x.id !== p.id) } }), { editsData: true });
              props.onClose();
            }}
          >
            Delete
          </Button>
        )}
      </div>
      {usedByRules.length > 0 && <p className="mt-2 text-sm">Used by rule(s): {usedByRules.join(', ')} — deactivate instead of deleting.</p>}
    </Sheet>
  );
}
