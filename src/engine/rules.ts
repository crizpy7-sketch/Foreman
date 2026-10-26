import { activeLengths, findCombos, matchPart } from './catalog';
import { evalBool, evalNumber, type Vars } from './expr';
import { crossOf, oppositeEdgeId, spanOf } from './geometry';
import type {
  Bay,
  Edge,
  EngineData,
  LevelSet,
  Lift,
  Member,
  PlacementRule,
  Scope,
  SizeSpec,
  StandardsCombo,
  Tower,
} from './types';
import { formatM } from './units';

/** Variables available to rule expressions, with a short description for the rules editor. */
export const RULE_VARIABLES: Record<string, string> = {
  type: "'rolling' or 'stationary'",
  accessType: "'ladder' or 'hatch'",
  accessAxis: "'L', 'W' (side the ladder is on) or 'none'",
  spanAxis: "'L' or 'W' (direction decks run)",
  gateType: "'gate', 'chain' or 'railsStay'",
  diagonalAccess: "'keep', 'move' or 'omit'",
  hDiagStationary: 'setting: horizontal diagonals on stationary towers',
  overRatio: 'deck height ÷ narrowest base is over the limit',
  ratio: 'deck height ÷ narrowest base',
  ratioLimit: 'ratio limit for this type (0 = none)',
  k: 'deck level (rosette index)',
  deckLevel: 'same as k',
  midRail: 'mid-rail level',
  topRail: 'top-rail level',
  lifts: 'number of full lifts',
  liftsTotal: 'number of lifts incl. a short bottom lift',
  shortLift: 'true when the bottom lift is short',
  nL: 'bays along L',
  nW: 'bays along W',
  posts: 'number of standard positions',
  bays: 'number of bays',
  L: 'total length (m)',
  W: 'total width (m)',
  H: 'asked height (m)',
  deckHeight: 'deck height above ground (m)',
  topRailHeight: 'top-rail height above ground (m)',
  deckReach: 'deck height above the base level (m)',
  pitch: 'rosette pitch (m)',
  ladderAboveDeck: 'setting: ladder length above deck (m)',
  level: 'current level (per element × level)',
  levelHeight: 'current level height above ground (m)',
  liftHeight: 'current lift height (m), eachLift only',
  liftFull: 'current lift is a full lift, eachLift only',
  elementLength: 'current edge length / bay span (m)',
};
export const RULE_VARIABLE_NAMES = Object.keys(RULE_VARIABLES);

export function towerVars(t: Tower, d: EngineData): Vars {
  const lv = t.levels;
  const full = lv.lifts.filter((l) => l.full).length;
  return {
    type: t.type,
    accessType: t.options.accessType,
    accessAxis: t.options.accessType === 'ladder' ? t.options.accessAxis : 'none',
    spanAxis: t.options.spanAxis,
    gateType: t.options.gateType,
    diagonalAccess: t.options.diagonalAccess,
    hDiagStationary: d.settings.horizontalDiagonalStationary,
    overRatio: t.overRatio,
    ratio: t.ratio,
    ratioLimit: t.ratioLimit ?? 0,
    k: lv.deck,
    deckLevel: lv.deck,
    midRail: lv.midRail,
    topRail: lv.topRail,
    lifts: full,
    liftsTotal: lv.lifts.length,
    shortLift: lv.lifts.some((l) => !l.full),
    nL: t.nL,
    nW: t.nW,
    posts: t.positions.length,
    bays: t.bays.length,
    L: t.totalL,
    W: t.totalW,
    H: t.askedHeight,
    deckHeight: t.deckHeight,
    topRailHeight: t.topRailHeight,
    deckReach: Math.round(lv.deck * lv.pitch * 1e6) / 1e6,
    pitch: lv.pitch,
    ladderAboveDeck: d.settings.ladderAboveDeck,
    level: 0,
    levelHeight: lv.heightOf(0),
    liftHeight: 0,
    liftFull: true,
    elementLength: 0,
  };
}

type Element =
  | { kind: 'position'; id: string }
  | { kind: 'edge'; id: string; edge: Edge }
  | { kind: 'bay'; id: string; bay: Bay }
  | { kind: 'tower'; id: string };

interface LevelItem {
  n: number;
  name: string;
  lift: Lift | null;
}

const SCOPE_NOUN: Record<Scope, string> = {
  positions: 'position',
  allEdges: 'edge',
  perimeterEdges: 'edge',
  edgesAlongSpan: 'edge',
  edgesAcrossSpan: 'edge',
  bays: 'bay',
  perimeterBayFaces: 'bay-face',
  accessFace: 'access bay-face',
  nonAccessFaces: 'bay-face',
  oppositeAccessFace: 'opposite bay-face',
  accessBay: 'access bay',
  tower: 'tower',
};

export function scopeElements(scope: Scope, t: Tower): Element[] {
  const edge = (e: Edge): Element => ({ kind: 'edge', id: e.id, edge: e });
  const span = t.options.spanAxis;
  switch (scope) {
    case 'positions':
      return t.positions.map((p) => ({ kind: 'position', id: p.id }));
    case 'allEdges':
      return t.edges.map(edge);
    case 'perimeterEdges':
    case 'perimeterBayFaces':
      return t.edges.filter((e) => e.perimeter).map(edge);
    case 'edgesAlongSpan':
      return t.edges.filter((e) => e.axis === span).map(edge);
    case 'edgesAcrossSpan':
      return t.edges.filter((e) => e.axis !== span).map(edge);
    case 'bays':
      return t.bays.map((b) => ({ kind: 'bay', id: b.id, bay: b }));
    case 'accessFace':
      return t.edges.filter((e) => e.id === t.accessEdgeId).map(edge);
    case 'nonAccessFaces':
      return t.edges.filter((e) => e.perimeter && e.id !== t.accessEdgeId).map(edge);
    case 'oppositeAccessFace': {
      const id = oppositeEdgeId(t);
      return t.edges.filter((e) => e.id === id).map(edge);
    }
    case 'accessBay':
      return t.bays.filter((b) => b.id === t.accessBayId).map((b) => ({ kind: 'bay', id: b.id, bay: b }));
    case 'tower':
      return [{ kind: 'tower', id: 'tower' }];
  }
}

export function levelItems(sets: LevelSet[], t: Tower): LevelItem[] {
  const lv = t.levels;
  const out: LevelItem[] = [];
  for (const s of sets) {
    if (s === 'base') out.push({ n: 0, name: 'base', lift: null });
    else if (s === 'ledgerLevels') lv.ledgerLevels.forEach((n) => out.push({ n, name: n === 0 ? 'base' : `level ${n}`, lift: null }));
    else if (s === 'deck') out.push({ n: lv.deck, name: 'deck', lift: null });
    else if (s === 'midRail') out.push({ n: lv.midRail, name: 'mid-rail', lift: null });
    else if (s === 'topRail') out.push({ n: lv.topRail, name: 'top-rail', lift: null });
    else lv.lifts.forEach((l) => out.push({ n: l.from, name: `lift ${l.from}→${l.to}`, lift: l }));
  }
  return out;
}

function elementLength(el: Element, t: Tower): number {
  if (el.kind === 'edge') return el.edge.length;
  if (el.kind === 'bay') return spanOf(el.bay, t.options.spanAxis);
  return 0;
}

export interface RuleRunResult {
  members: Member[];
  notes: string[];
  errors: string[];
  standardsCombos: StandardsCombo[];
  /** Notes keyed by rule id (e.g. short lifts), attached to that rule's BOM lines. */
  ruleNotes: Record<string, string[]>;
}

export function standardsCombosFor(t: Tower, d: EngineData, category = 'standard'): StandardsCombo[] {
  const s = d.settings;
  const reach = t.levels.topRail * t.levels.pitch + s.standardAboveTopRail;
  return findCombos(activeLengths(d.catalog, category), reach, s.maxOvershoot, s.maxStandardPieces, s.preferredStandardLengths).slice(
    0,
    s.standardsComboOptions,
  );
}

interface Draft {
  size: SizeSpec;
  qty: number;
  missing: string | null;
}

/** Steps 2–3: apply placement rules to create members, then map each to an active catalog part. */
export function applyRules(t: Tower, d: EngineData): RuleRunResult {
  const s = d.settings;
  const tol = s.sizeTolerance;
  const base = towerVars(t, d);
  const notes: string[] = [];
  const errors: string[] = [];
  const ruleNotes: Record<string, string[]> = {};
  let members: Member[] = [];
  let standardsCombos: StandardsCombo[] = [];
  const fired: { rule: PlacementRule; elementIds: Set<string> }[] = [];

  for (const rule of d.rules) {
    if (!rule.enabled) continue;
    let on: boolean;
    try {
      on = evalBool(rule.condition, base);
    } catch (e) {
      errors.push(`Rule "${rule.label}" condition: ${(e as Error).message}`);
      continue;
    }
    if (!on) continue;

    const elements = scopeElements(rule.scope, t);
    const levels = levelItems(rule.levels, t);
    fired.push({ rule, elementIds: new Set(elements.map((e) => e.id)) });

    let combo: StandardsCombo | undefined;
    if (rule.sizeFrom === 'standardsCombo') {
      standardsCombos = standardsCombosFor(t, d, rule.category);
      combo = standardsCombos[Math.min(Math.max(t.options.standardsComboIndex, 0), standardsCombos.length - 1)];
    }

    const shortNotes = new Set<string>();
    for (const el of elements) {
      for (const lvl of levels) {
        const vars: Vars = {
          ...base,
          level: lvl.n,
          levelHeight: t.levels.heightOf(lvl.n),
          liftHeight: lvl.lift?.height ?? 0,
          liftFull: lvl.lift?.full ?? true,
          elementLength: elementLength(el, t),
        };
        let qtyPer: number;
        try {
          qtyPer = Math.max(0, Math.round(evalNumber(rule.qtyPer, vars)));
        } catch (e) {
          errors.push(`Rule "${rule.label}" qtyPer: ${(e as Error).message}`);
          continue;
        }
        if (qtyPer === 0) {
          if (lvl.lift && !lvl.lift.full)
            shortNotes.add(
              `Short ${lvl.name} (${formatM(lvl.lift.height)} m) gets ledgers but no ${rule.category === 'vDiagonal' ? 'diagonal' : rule.label.toLowerCase()}.`,
            );
          continue;
        }

        const drafts: Draft[] = [];
        const bad = (msg: string) => drafts.push({ size: { kind: 'none' }, qty: qtyPer, missing: msg });
        switch (rule.sizeFrom) {
          case 'edge':
            if (el.kind === 'edge') drafts.push({ size: { kind: 'length', m: el.edge.length }, qty: qtyPer, missing: null });
            else bad(`Rule "${rule.label}": sizeFrom "edge" needs an edge scope`);
            break;
          case 'span':
          case 'crossWidth':
            if (el.kind === 'bay') {
              const m = rule.sizeFrom === 'span' ? spanOf(el.bay, t.options.spanAxis) : crossOf(el.bay, t.options.spanAxis);
              drafts.push({ size: { kind: 'length', m }, qty: qtyPer, missing: null });
            } else if (el.kind === 'edge' && rule.sizeFrom === 'span') {
              drafts.push({ size: { kind: 'length', m: el.edge.length }, qty: qtyPer, missing: null });
            } else bad(`Rule "${rule.label}": sizeFrom "${rule.sizeFrom}" needs a bay scope`);
            break;
          case 'bay':
            if (el.kind === 'bay') drafts.push({ size: { kind: 'bay', l: el.bay.lenL, w: el.bay.lenW }, qty: qtyPer, missing: null });
            else bad(`Rule "${rule.label}": sizeFrom "bay" needs a bay scope`);
            break;
          case 'fixed':
            drafts.push({ size: { kind: 'part', partId: rule.partId ?? '' }, qty: qtyPer, missing: null });
            break;
          case 'standardsCombo':
            if (!combo) {
              const reach = t.levels.topRail * t.levels.pitch + s.standardAboveTopRail;
              bad(`No combo of active ${rule.category} lengths reaches ${formatM(reach)} m within ${formatM(s.maxOvershoot)} m overshoot`);
            } else for (const piece of combo.pieces) drafts.push({ size: { kind: 'piece', m: piece }, qty: qtyPer, missing: null });
            break;
          case 'deckFill': {
            if (el.kind !== 'bay') {
              bad(`Rule "${rule.label}": sizeFrom "deckFill" needs a bay scope`);
              break;
            }
            const cross = crossOf(el.bay, t.options.spanAxis);
            const span = spanOf(el.bay, t.options.spanAxis);
            const fill = d.deckFill.find((f) => Math.abs(f.bayWidth - cross) <= tol);
            if (!fill) bad(`No deck fill entry for a ${formatM(cross)} m bay width`);
            else
              for (const p of fill.pieces)
                drafts.push({ size: { kind: 'deck', length: span, width: p.width }, qty: p.count * qtyPer, missing: null });
            break;
          }
          case 'combo': {
            let reach: number;
            try {
              reach = evalNumber(rule.reach ?? '0', vars);
            } catch (e) {
              errors.push(`Rule "${rule.label}" reach: ${(e as Error).message}`);
              break;
            }
            const found = findCombos(activeLengths(d.catalog, rule.category), reach, s.ladderMaxOvershoot, s.maxStandardPieces)[0];
            if (!found) bad(`No combo of active ${rule.category} lengths reaches ${formatM(reach)} m`);
            else for (const piece of found.pieces) drafts.push({ size: { kind: 'piece', m: piece }, qty: qtyPer, missing: null });
            break;
          }
        }

        drafts.forEach((dr, idx) => {
          members.push({
            id: `${rule.id}:${el.id}:${lvl.n}:${idx}`,
            ruleId: rule.id,
            ruleLabel: rule.label,
            category: rule.category,
            size: dr.size,
            elementId: el.id,
            level: lvl.n,
            levelName: lvl.name,
            qty: dr.qty,
            partId: null,
            missing: dr.missing,
            scopeNoun: SCOPE_NOUN[rule.scope],
            companionOf: null,
          });
        });
      }
    }
    if (shortNotes.size) {
      for (const n of shortNotes) if (!notes.includes(n)) notes.push(n);
      ruleNotes[rule.id] = [...shortNotes];
    }
  }

  // Rules that substitute others on their scope elements.
  for (const f of fired) {
    if (!f.rule.replaces.length) continue;
    members = members.filter((m) => !(f.rule.replaces.includes(m.ruleId) && f.elementIds.has(m.elementId)));
  }

  // Map to catalog parts.
  for (const m of members) {
    if (m.missing) continue;
    const match = matchPart(d.catalog, m.category, m.size, d.sizeMap, d.categories, tol);
    m.partId = match.part?.id ?? null;
    m.missing = match.missing;
  }

  // Parts that replace standard decks (hatch/access decks).
  const extra: Member[] = [];
  for (const m of members) {
    const part = m.partId ? d.catalog.find((p) => p.id === m.partId) : undefined;
    if (!part?.replacesDecks) continue;
    let toRemove = part.replacesDecks * m.qty;
    const decks = members
      .filter((x) => x.category === 'deck' && x.elementId === m.elementId && x.level === m.level && x.qty > 0)
      .sort((a, b) => (b.size.kind === 'deck' ? b.size.width : 0) - (a.size.kind === 'deck' ? a.size.width : 0));
    for (const dk of decks) {
      if (toRemove <= 0) break;
      const take = Math.min(dk.qty, toRemove);
      toRemove -= take;
      extra.push({ ...dk, id: `${dk.id}:replaced`, ruleId: m.ruleId, ruleLabel: `${m.ruleLabel} (replaces decks)`, qty: -take, scopeNoun: m.scopeNoun });
    }
  }
  members.push(...extra);

  // Companion parts (e.g. ladder → hooks).
  const companions: Member[] = [];
  for (const m of members) {
    const part = m.partId ? d.catalog.find((p) => p.id === m.partId) : undefined;
    if (!part || m.qty <= 0) continue;
    for (const c of part.companions) {
      const cp = d.catalog.find((p) => p.id === c.partId);
      companions.push({
        ...m,
        id: `${m.id}:companion:${c.partId}`,
        ruleLabel: `${m.ruleLabel} companions`,
        category: cp?.category ?? 'other',
        size: { kind: 'part', partId: c.partId },
        qty: m.qty * c.qty,
        partId: cp?.active ? cp.id : null,
        missing: cp ? (cp.active ? null : `${cp.name} — inactive in catalog`) : `Companion "${c.partId}" — not in catalog`,
        companionOf: part.id,
      });
    }
  }
  members.push(...companions);

  return { members, notes, errors, standardsCombos, ruleNotes };
}
