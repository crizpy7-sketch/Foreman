import { aggregate } from './bom';
import { baySplitOptions, buildTower, splitLabel, type SplitOptions } from './geometry';
import { applyRules } from './rules';
import type {
  AccessType,
  Axis,
  BaySplit,
  Callout,
  DiagonalAccess,
  EngineData,
  GateType,
  VariantResult,
} from './types';
import { formatFeetCall, formatFtIn, formatM, requestMetres } from './units';

export interface VariantSpec {
  splitL: BaySplit;
  splitW: BaySplit;
  accessType: AccessType;
  accessAxis: Axis;
  spanAxis: Axis;
  gateType: GateType;
  diagonalAccess: DiagonalAccess;
  standardsComboIndex: number;
  /** Ranks used for sorting (index of the split option on each axis). */
  splitRank: number;
  /** Prefix the label with the bay layout (when splits are offered). */
  showSplit: boolean;
}

export function variantKey(v: Pick<VariantSpec, 'splitL' | 'splitW' | 'accessType' | 'accessAxis' | 'spanAxis'>): string {
  const access = v.accessType === 'ladder' ? `ladder:${v.accessAxis}` : 'hatch';
  return `${v.splitL.labels.join('+')}x${v.splitW.labels.join('+')}|${access}|span:${v.spanAxis}`;
}

export function spanLabel(split: BaySplit): string {
  const uniq = [...new Set(split.labels)];
  return uniq.join('/');
}

export function variantLabel(v: VariantSpec): string {
  const face = v.accessAxis === 'L' ? splitLabel(v.splitL) : splitLabel(v.splitW);
  let run = spanLabel(v.spanAxis === 'L' ? v.splitL : v.splitW);
  const other = spanLabel(v.spanAxis === 'L' ? v.splitW : v.splitL);
  const sideL = splitLabel(v.splitL);
  const sideW = splitLabel(v.splitW);
  // Same deck length both ways (e.g. 2×5' × 5'): say which side the decks run along.
  if (run === other && sideL !== sideW) run += ` along the ${v.spanAxis === 'L' ? sideL : sideW} side`;
  const access = v.accessType === 'ladder' ? `Ladder on ${face} side` : 'Hatch access';
  const prefix = v.showSplit ? `${splitLabel(v.splitL)} × ${splitLabel(v.splitW)} · ` : '';
  return `${prefix}${access} · decks run ${run}`;
}

export function computeVariant(callout: Callout, d: EngineData, spec: VariantSpec): VariantResult {
  const askedHeight = requestMetres(callout.H);
  const tower = buildTower(
    {
      type: callout.type,
      splitL: spec.splitL,
      splitW: spec.splitW,
      askedHeight,
      options: {
        accessType: spec.accessType,
        accessAxis: spec.accessAxis,
        spanAxis: spec.spanAxis,
        gateType: spec.gateType,
        diagonalAccess: spec.diagonalAccess,
        standardsComboIndex: spec.standardsComboIndex,
      },
    },
    d.settings,
  );
  const run = applyRules(tower, d);
  const bom = aggregate(run.members, d, run.ruleNotes);
  const warnings: string[] = [...run.errors];
  if (tower.overRatio) {
    warnings.push(
      `Height-to-base ratio ${tower.ratio.toFixed(2)}:1 is over the ${tower.ratioLimit}:1 limit — stabilizers added.`,
    );
  }
  const missingParts = [...new Set(bom.lines.filter((l) => l.missing).map((l) => l.missing!))];
  const combos = run.standardsCombos;
  const chosen = combos[Math.min(Math.max(spec.standardsComboIndex, 0), combos.length - 1)];
  // Overall height = ground to top of standards (base offset + standards stack).
  const overallHeight = chosen ? Math.round((tower.levels.baseOffset + chosen.total) * 1e6) / 1e6 : null;
  const asked = `asked ${callout.H.m !== null ? `${callout.H.m}m` : formatFeetCall(callout.H.ft!)}`;
  const deck = formatFtIn(tower.deckHeight);
  const top = formatFtIn(tower.topRailHeight);
  const overall = overallHeight !== null ? formatFtIn(overallHeight) : '?';
  const heightLine =
    d.settings.heightMeans === 'topOfStandards'
      ? `Overall ${overall} (${asked}) · deck ${deck} · top rail ${top}`
      : d.settings.heightMeans === 'topRail'
        ? `Top rail ${top} (${asked}) · deck ${deck} · overall ${overall}`
        : `Deck ${deck} (${asked}) · top rail ${top} · overall ${overall}`;
  const notes = [heightLine, ...run.notes];
  if (spec.splitL.bays.length > 1 || spec.splitW.bays.length > 1 || !spec.splitL.exact || !spec.splitW.exact) {
    notes.push(`Footprint ${formatFtIn(tower.totalL)} × ${formatFtIn(tower.totalW)} (${formatM(tower.totalL)} × ${formatM(tower.totalW)} m)`);
  }
  return {
    key: variantKey(spec),
    label: variantLabel(spec),
    tower,
    members: run.members,
    bom,
    standardsCombos: run.standardsCombos,
    warnings,
    notes,
    missingParts,
    possible: missingParts.length === 0 && run.errors.length === 0,
    splitRank: spec.splitRank,
    overallHeight,
  };
}

export interface VariantSet {
  callout: Callout;
  splitsL: SplitOptions;
  splitsW: SplitOptions;
  /** Possible builds, sorted and capped. */
  variants: VariantResult[];
  /** Builds that need a missing/inactive part. */
  notPossible: VariantResult[];
  /** Messages about sizes ("No 6' in the size map…"). */
  sizeNotes: string[];
  warnings: string[];
}

function sizeNote(axisName: string, req: Callout['L'], so: SplitOptions): string | null {
  if (so.exact) return null;
  const called = req.m !== null ? `${req.m} m` : formatFeetCall(req.ft!);
  const opts = so.options.map((o) => `${splitLabel(o)} (${formatFtIn(o.total)})`).join(', ');
  return `No ${called} size in the size map (${axisName}) — closest builds: ${opts}.`;
}

export interface EnumerateOptions {
  moreWays?: boolean;
  gateType?: GateType;
  diagonalAccess?: DiagonalAccess;
}

/** Enumerate access face × access type × deck span direction × bay split (when offered). */
export function enumerateVariants(callout: Callout, d: EngineData, opts: EnumerateOptions = {}): VariantSet {
  const s = d.settings;
  const moreWays = opts.moreWays ?? callout.moreWays;
  const splitsL = baySplitOptions(callout.L, d.sizeMap, s, moreWays);
  const splitsW = baySplitOptions(callout.W, d.sizeMap, s, moreWays);
  const warnings = [...callout.warnings];
  const sizeNotes = [sizeNote('length', callout.L, splitsL), sizeNote('width', callout.W, splitsW)].filter((x): x is string => !!x);

  let accessTypes: AccessType[] = callout.accessType ? [callout.accessType] : [...s.accessTypes];
  let accessAxes: Axis[] = ['L', 'W'];
  if (callout.accessSide) {
    const ft = callout.accessSide.ft;
    const axes: Axis[] = [];
    if (ft !== null && callout.L.ft !== null && Math.abs(callout.L.ft - ft) < 1e-6) axes.push('L');
    if (ft !== null && callout.W.ft !== null && Math.abs(callout.W.ft - ft) < 1e-6) axes.push('W');
    if (axes.length) accessAxes = axes;
    else warnings.push(`No ${callout.accessSide.raw}' side on this tower — showing every side.`);
    if (!callout.accessType) accessTypes = ['ladder'];
  }

  const showSplit = splitsL.offered || splitsW.offered;
  const all: VariantResult[] = [];
  const seen = new Set<string>();
  splitsL.options.forEach((splitL, iL) =>
    splitsW.options.forEach((splitW, iW) => {
      for (const accessType of accessTypes) {
        const axes: Axis[] = accessType === 'ladder' ? accessAxes : ['L'];
        for (const accessAxis of axes)
          for (const spanAxis of ['L', 'W'] as Axis[]) {
            const v = computeVariant(callout, d, {
              splitL,
              splitW,
              accessType,
              accessAxis,
              spanAxis,
              gateType: opts.gateType ?? s.gateType,
              diagonalAccess: opts.diagonalAccess ?? s.diagonalAccess,
              standardsComboIndex: 0,
              splitRank: iL + iW,
              showSplit,
            });
            const sig = `${v.label}|${v.bom.lines.map((l) => `${l.key}:${l.qty}`).join(',')}`;
            if (seen.has(sig)) continue;
            seen.add(sig);
            all.push(v);
          }
      }
    }),
  );

  const sorter = (a: VariantResult, b: VariantResult) =>
    a.splitRank - b.splitRank || a.bom.pieces - b.bom.pieces || a.label.localeCompare(b.label);
  const variants = all.filter((v) => v.possible).sort(sorter).slice(0, s.maxVariants);
  const notPossible = all.filter((v) => !v.possible).sort(sorter).slice(0, s.maxVariants);
  return { callout, splitsL, splitsW, variants, notPossible, sizeNotes, warnings };
}
