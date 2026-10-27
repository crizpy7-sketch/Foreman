import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { db } from '../../db/db';
import { LEVEL_OPTIONS, SCOPE_OPTIONS, SIZE_FROM_OPTIONS } from '../../data/schema';
import { loadSeed } from '../../data/seed';
import {
  enumerateVariants,
  evalBool,
  parseCallout,
  partLabel,
  RULE_VARIABLES,
  towerVars,
  validateRule,
  type LevelSet,
  type PlacementRule,
  type Scope,
  type SizeFrom,
  type VariantResult,
} from '../../engine';
import { Badge, Button, Field, inputCls, Page, Segmented, VerifyBadge } from '../components/ui';
import { act, toast, useStore } from '../store';

type TypeFilter = 'all' | 'rolling' | 'stationary';

const SCOPE_HELP: Record<Scope, string> = {
  positions: 'every standard position',
  allEdges: 'every edge (incl. interior)',
  perimeterEdges: 'outside edges',
  edgesAlongSpan: 'edges parallel to the decks',
  edgesAcrossSpan: 'edges the decks sit on',
  bays: 'every bay',
  perimeterBayFaces: 'outside bay-faces',
  accessFace: 'the ladder bay-face',
  nonAccessFaces: 'outside faces except ladder bay',
  oppositeAccessFace: 'face opposite the ladder',
  accessBay: 'the ladder / hatch bay',
  tower: 'once per tower',
};

export function RulesEditor() {
  const data = useStore((s) => s.data);
  const [filter, setFilter] = useState<TypeFilter>('all');
  const [test, setTest] = useState('5x4x8 rolling');
  const [openId, setOpenId] = useState<string | null>(null);
  const [showVars, setShowVars] = useState(false);
  const versions = useLiveQuery(() => db.ruleVersions.orderBy('savedAt').reverse().toArray(), []) ?? [];

  // Live test panel: first possible build (or first build) for the test callout.
  const preview = useMemo(() => {
    const r = parseCallout(test, data.settings.defaultType);
    if (!r.ok) return { error: r.error, v: null as VariantResult | null };
    const set = enumerateVariants(r.callout, data);
    return { error: null, v: set.variants[0] ?? set.notPossible[0] ?? null };
  }, [test, data]);

  // Which types each rule applies to, evaluated against the test tower.
  const appliesTo = (rule: PlacementRule, type: 'rolling' | 'stationary') => {
    if (!preview.v) return true;
    try {
      return evalBool(rule.condition, { ...towerVars(preview.v.tower, data), type });
    } catch {
      return true;
    }
  };
  const rules = data.rules.filter((r) => filter === 'all' || appliesTo(r, filter));

  const update = (id: string, patch: Partial<PlacementRule>, label = 'Edit rule') =>
    act(label, (s) => ({ data: { ...s.data, rules: s.data.rules.map((r) => (r.id === id ? { ...r, ...patch } : r)) } }), { editsData: true });
  const move = (id: string, dir: -1 | 1) =>
    act(
      'Reorder rules',
      (s) => {
        const list = [...s.data.rules];
        const i = list.findIndex((r) => r.id === id);
        const j = i + dir;
        if (j < 0 || j >= list.length) return {};
        [list[i], list[j]] = [list[j]!, list[i]!];
        return { data: { ...s.data, rules: list } };
      },
      { editsData: true },
    );
  const addRule = () => {
    let n = 1;
    while (data.rules.some((r) => r.id === `rule${n}`)) n++;
    const rule: PlacementRule = {
      id: `rule${n}`,
      label: 'New rule',
      category: 'other',
      note: '',
      scope: 'positions',
      levels: ['base'],
      qtyPer: 1,
      sizeFrom: 'fixed',
      partId: data.catalog[0]?.id ?? null,
      reach: null,
      condition: '',
      replaces: [],
      enabled: false,
      verify: true,
    };
    act('Add rule', (s) => ({ data: { ...s.data, rules: [...s.data.rules, rule] } }), { editsData: true });
    setOpenId(rule.id);
  };
  const saveVersion = async () => {
    const note = prompt('Name this version (optional)', new Date().toLocaleString()) ?? '';
    await db.ruleVersions.add({ savedAt: Date.now(), note, rules: structuredClone(data.rules) });
    toast('Rules version saved');
  };
  const restore = async (rulesToSet: PlacementRule[], label: string) => {
    await db.ruleVersions.add({ savedAt: Date.now(), note: `Before restoring “${label}”`, rules: structuredClone(data.rules) });
    act(`Restore rules: ${label}`, (s) => ({ data: { ...s.data, rules: structuredClone(rulesToSet) } }), { editsData: true });
    toast(`Restored ${label} (previous rules saved in history)`);
  };

  return (
    <Page title="Placement rules" actions={<Button kind="primary" onClick={addRule}>+ Rule</Button>}>
      <div className="rounded-2xl border-4 border-yellow-400 p-3">
        <Field label="Live test — type any callout">
          <input className={inputCls} value={test} onChange={(e) => setTest(e.target.value)} />
        </Field>
        {preview.error && <p className="mt-1 font-semibold text-red-700">{preview.error}</p>}
        {preview.v && (
          <div className="mt-2 text-sm">
            <div className="font-bold">
              {preview.v.label} · {preview.v.bom.pieces} pcs {!preview.v.possible && <Badge tone="warn">not possible</Badge>}
            </div>
            <div>{preview.v.notes[0]}</div>
            {[...preview.v.warnings, ...preview.v.missingParts].map((w) => (
              <div key={w} className="font-semibold text-red-700 dark:text-red-400">
                {w}
              </div>
            ))}
            <ul className="mt-1 columns-1 sm:columns-2">
              {preview.v.bom.lines.map((l) => (
                <li key={l.key}>
                  <b>{l.qty}</b> {l.label}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="mt-3">
        <Segmented<TypeFilter>
          label="Show rules for"
          value={filter}
          options={[
            { value: 'all', label: 'All' },
            { value: 'rolling', label: 'Rolling' },
            { value: 'stationary', label: 'Stationary' },
          ]}
          onChange={setFilter}
        />
      </div>
      <Button kind="ghost" onClick={() => setShowVars(!showVars)}>
        {showVars ? 'Hide' : 'Show'} variables for expressions
      </Button>
      {showVars && (
        <table className="mt-1 w-full text-sm">
          <tbody>
            {Object.entries(RULE_VARIABLES).map(([k, v]) => (
              <tr key={k} className="border-b border-neutral-300 dark:border-neutral-800">
                <td className="py-1 pr-2 font-mono font-bold">{k}</td>
                <td>{v}</td>
              </tr>
            ))}
            <tr>
              <td className="py-1 pr-2 font-mono font-bold">functions</td>
              <td>min max ceil floor round abs · and or not · == != &lt; &lt;= &gt; &gt;= · a ? b : c</td>
            </tr>
          </tbody>
        </table>
      )}

      <ul className="mt-3 flex flex-col gap-2">
        {rules.map((r) => {
          const issues = validateRule(r, data);
          const open = openId === r.id;
          return (
            <li key={r.id} className={`rounded-xl border-2 p-2 ${issues.length ? 'border-red-600' : 'border-neutral-400'} ${r.enabled ? '' : 'opacity-70'}`}>
              <div className="flex items-center gap-2">
                <button type="button" className="min-h-12 flex-1 text-left" onClick={() => setOpenId(open ? null : r.id)}>
                  <div className="font-extrabold">
                    {r.label} {!r.enabled && <Badge tone="warn">off</Badge>} {r.verify && <VerifyBadge />}{' '}
                    {issues.length > 0 && <Badge tone="warn">{issues.length} issue{issues.length > 1 ? 's' : ''}</Badge>}
                  </div>
                  <div className="text-xs">
                    {r.scope} × {r.levels.join(', ')} · qty {String(r.qtyPer)} · size from {r.sizeFrom}
                    {r.condition ? ` · if ${r.condition}` : ''}
                  </div>
                </button>
                <label className="flex min-h-12 items-center gap-1 text-sm font-semibold">
                  <input type="checkbox" className="h-7 w-7 accent-green-600" checked={r.enabled} onChange={(e) => update(r.id, { enabled: e.target.checked }, `${e.target.checked ? 'Enable' : 'Disable'} ${r.label}`)} />
                  on
                </label>
              </div>
              {open && <RuleForm rule={r} issues={issues} update={(p, l) => update(r.id, p, l)} move={(d) => move(r.id, d)} />}
            </li>
          );
        })}
      </ul>

      <h2 className="mt-6 text-lg font-bold">Version history</h2>
      <div className="mt-2 flex flex-wrap gap-2">
        <Button kind="primary" onClick={() => void saveVersion()}>
          Save version
        </Button>
        <Button onClick={() => confirm('Restore the original seed rules?') && void restore(loadSeed().rules, 'seed rules')}>Restore seed rules</Button>
      </div>
      <ul className="mt-2 flex flex-col gap-2">
        {versions.map((v) => (
          <li key={v.id} className="flex items-center gap-2 rounded-xl border-2 border-neutral-400 p-2">
            <div className="flex-1">
              <div className="font-bold">{v.note || 'Untitled'}</div>
              <div className="text-xs">
                {new Date(v.savedAt).toLocaleString()} · {v.rules.length} rules
              </div>
            </div>
            <Button onClick={() => confirm('Restore this version?') && void restore(v.rules as PlacementRule[], v.note || 'version')}>Restore</Button>
            <Button kind="ghost" onClick={() => v.id !== undefined && void db.ruleVersions.delete(v.id)}>
              Delete
            </Button>
          </li>
        ))}
      </ul>
    </Page>
  );
}

function RuleForm(props: {
  rule: PlacementRule;
  issues: { field: keyof PlacementRule; message: string }[];
  update: (p: Partial<PlacementRule>, label?: string) => void;
  move: (d: -1 | 1) => void;
}) {
  const { rule: r, update } = props;
  const data = useStore((s) => s.data);
  const err = (f: keyof PlacementRule) => props.issues.filter((i) => i.field === f).map((i) => i.message).join('; ') || null;
  const commit = (k: keyof PlacementRule, v: string) => {
    if (k === 'qtyPer') {
      const n = Number(v);
      update({ qtyPer: v.trim() !== '' && Number.isFinite(n) ? n : v }, `Edit ${r.label} qty`);
    } else update({ [k]: v === '' && k === 'reach' ? null : v }, `Edit ${r.label}`);
  };
  const textField = (k: 'label' | 'qtyPer' | 'condition' | 'reach' | 'note', label: string, hint?: string) => (
    <Field label={label} hint={hint} error={err(k)}>
      <input
        key={`${r.id}-${k}-${String(r[k])}`}
        className={`${inputCls} font-mono`}
        defaultValue={r[k] === null ? '' : String(r[k])}
        onBlur={(e) => e.target.value !== (r[k] === null ? '' : String(r[k])) && commit(k, e.target.value)}
      />
    </Field>
  );
  return (
    <div className="mt-2 grid gap-3 border-t-2 border-neutral-300 pt-3 sm:grid-cols-2 dark:border-neutral-700">
      {textField('label', 'Label')}
      <Field label="Category" error={err('category')}>
        <select className={inputCls} value={r.category} onChange={(e) => update({ category: e.target.value })}>
          {data.categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Scope (where)" hint={SCOPE_HELP[r.scope]}>
        <select className={inputCls} value={r.scope} onChange={(e) => update({ scope: e.target.value as Scope })}>
          {SCOPE_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s} — {SCOPE_HELP[s]}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Levels" error={err('levels')}>
        <div className="flex flex-wrap gap-2">
          {LEVEL_OPTIONS.map((l) => (
            <label key={l} className="flex min-h-12 items-center gap-2 rounded-xl border-2 border-neutral-400 px-2 font-semibold">
              <input
                type="checkbox"
                className="h-6 w-6 accent-yellow-400"
                checked={r.levels.includes(l)}
                onChange={(e) => update({ levels: e.target.checked ? [...r.levels, l] : r.levels.filter((x) => x !== l) as LevelSet[] })}
              />
              {l}
            </label>
          ))}
        </div>
      </Field>
      {textField('qtyPer', 'Qty per (number or expression)', 'e.g. 1, 4, liftFull ? 1 : 0')}
      <Field label="Size from" error={err('sizeFrom')}>
        <select className={inputCls} value={r.sizeFrom} onChange={(e) => update({ sizeFrom: e.target.value as SizeFrom })}>
          {SIZE_FROM_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </Field>
      {r.sizeFrom === 'fixed' && (
        <Field label="Fixed part" error={err('partId')}>
          <select className={inputCls} value={r.partId ?? ''} onChange={(e) => update({ partId: e.target.value })}>
            <option value="">— choose —</option>
            {data.catalog.map((p) => (
              <option key={p.id} value={p.id}>
                {partLabel(p, data.sizeMap, data.settings.sizeTolerance).label} ({p.id})
              </option>
            ))}
          </select>
        </Field>
      )}
      {r.sizeFrom === 'combo' && textField('reach', 'Reach (m, expression)', 'e.g. deckReach + ladderAboveDeck')}
      {textField('condition', 'Condition (blank = always)', "e.g. type == 'rolling'")}
      <Field label="Replaces (on its scope)" error={err('replaces')}>
        <div className="flex flex-wrap gap-2">
          {data.rules
            .filter((x) => x.id !== r.id)
            .map((x) => (
              <label key={x.id} className="flex min-h-12 items-center gap-2 rounded-xl border-2 border-neutral-400 px-2 text-sm font-semibold">
                <input
                  type="checkbox"
                  className="h-6 w-6 accent-yellow-400"
                  checked={r.replaces.includes(x.id)}
                  onChange={(e) => update({ replaces: e.target.checked ? [...r.replaces, x.id] : r.replaces.filter((y) => y !== x.id) })}
                />
                {x.label}
              </label>
            ))}
        </div>
      </Field>
      {textField('note', 'Note')}
      <label className="flex min-h-12 items-center gap-3 font-semibold">
        <input type="checkbox" className="h-7 w-7 accent-orange-500" checked={r.verify} onChange={(e) => update({ verify: e.target.checked })} />
        Needs verifying
      </label>
      <div className="flex flex-wrap gap-2 sm:col-span-2">
        <Button onClick={() => props.move(-1)}>↑ Up</Button>
        <Button onClick={() => props.move(1)}>↓ Down</Button>
        <Button
          kind="danger"
          onClick={() =>
            confirm(`Delete rule “${r.label}”?`) &&
            act(`Delete rule ${r.label}`, (s) => ({ data: { ...s.data, rules: s.data.rules.filter((x) => x.id !== r.id) } }), { editsData: true })
          }
        >
          Delete rule
        </Button>
      </div>
    </div>
  );
}
