// Core data and result types for the LoadOut engine. Plain TypeScript, no runtime deps.

export type ScaffoldType = 'rolling' | 'stationary';
export type AccessType = 'ladder' | 'hatch';
/** Which axis an element runs along: L = the first called dimension, W = the second. */
export type Axis = 'L' | 'W';
export type GateType = 'gate' | 'chain' | 'railsStay';
export type DiagonalAccess = 'keep' | 'move' | 'omit';
export type HeightMeans = 'deck' | 'topRail' | 'topOfStandards';
export type RoundingMode = 'nearest' | 'up' | 'down';
export type WeightUnit = 'lb' | 'kg';

// ---------------------------------------------------------------- data

export interface SizeMapEntry {
  /** Yard label, e.g. "5'". */
  label: string;
  /** Called size in feet (what the foreman says). */
  ft: number;
  /** Layher system length in metres. */
  m: number;
  /** Extra spellings that resolve to this entry, e.g. "3.5". */
  aliases: string[];
  verify: boolean;
}

export interface DeckFillPiece {
  width: number;
  count: number;
}

export interface DeckFillEntry {
  /** Bay width across the deck span (m). */
  bayWidth: number;
  pieces: DeckFillPiece[];
  verify: boolean;
}

export interface Companion {
  partId: string;
  qty: number;
}

export interface Part {
  id: string;
  name: string;
  category: string;
  /** Primary size in metres (length). Null for size-less parts (castor, base collar…). */
  size: number | null;
  /** Second size for two-dimensional parts: deck width, or the W of a horizontal diagonal. */
  size2: number | null;
  /** Yard label override; otherwise derived from the size map. */
  nominal: string | null;
  articleNo: string | null;
  weightKg: number | null;
  yardLocation: string;
  companions: Companion[];
  /** Access/hatch decks: how many standard decks one of these replaces. */
  replacesDecks: number | null;
  active: boolean;
  verify: boolean;
  source: string | null;
  notes: string;
}

export type Scope =
  | 'positions'
  | 'allEdges'
  | 'perimeterEdges'
  | 'edgesAlongSpan'
  | 'edgesAcrossSpan'
  | 'bays'
  | 'perimeterBayFaces'
  | 'accessFace'
  | 'nonAccessFaces'
  | 'oppositeAccessFace'
  | 'accessBay'
  | 'tower';

export type LevelSet = 'base' | 'ledgerLevels' | 'deck' | 'midRail' | 'topRail' | 'eachLift';

export type SizeFrom =
  | 'edge'
  | 'span'
  | 'crossWidth'
  | 'bay'
  | 'fixed'
  | 'standardsCombo'
  | 'deckFill'
  | 'combo';

export interface PlacementRule {
  id: string;
  label: string;
  category: string;
  note: string;
  scope: Scope;
  levels: LevelSet[];
  /** Number, or an expression string evaluated per scope element × level. */
  qtyPer: number | string;
  sizeFrom: SizeFrom;
  /** sizeFrom 'fixed': the catalog part to use. */
  partId: string | null;
  /** sizeFrom 'combo': expression for the length (m) the pieces must reach. */
  reach: string | null;
  /** Expression; rule fires only when true. Empty = always. */
  condition: string;
  /** Rule ids whose members on this rule's scope elements are removed when this rule fires. */
  replaces: string[];
  enabled: boolean;
  verify: boolean;
}

export interface Settings {
  defaultType: ScaffoldType;
  pitch: number;
  heightMeans: HeightMeans;
  rounding: RoundingMode;
  baseOffsetRolling: number;
  baseOffsetStationary: number;
  /** Levels above the deck. */
  midRailOffset: number;
  topRailOffset: number;
  liftHeight: number;
  /** Standard length needed above the top-rail rosette. */
  standardAboveTopRail: number;
  maxOvershoot: number;
  maxStandardPieces: number;
  preferredStandardLengths: number[];
  standardsComboOptions: number;
  ladderAboveDeck: number;
  ladderMaxOvershoot: number;
  ratioLimitRolling: number;
  ratioLimitStationary: number | null;
  gateType: GateType;
  diagonalAccess: DiagonalAccess;
  horizontalDiagonalStationary: boolean;
  accessTypes: AccessType[];
  maxBaysPerDirection: number;
  allowMixedBays: boolean;
  bayOptionsShown: number;
  /** Bay-split options further than this from the called length (m) are not offered. */
  maxSplitDeviation: number;
  maxVariants: number;
  categoryOrder: string[];
  weightUnit: WeightUnit;
  sparesEnabled: boolean;
  sparesPercent: number;
  /** Matching tolerance when comparing metric sizes. */
  sizeTolerance: number;
}

export interface CategoryInfo {
  id: string;
  label: string;
}

export interface EngineData {
  settings: Settings;
  sizeMap: SizeMapEntry[];
  deckFill: DeckFillEntry[];
  catalog: Part[];
  rules: PlacementRule[];
  categories: CategoryInfo[];
}

// ---------------------------------------------------------------- callout

export interface DimRequest {
  /** What was typed/said, normalised, e.g. "5", "8'6\"", "2.5m". */
  raw: string;
  /** Feet value if given in feet (or unitless). */
  ft: number | null;
  /** Metres if given in metres. */
  m: number | null;
}

export interface Callout {
  input: string;
  qty: number;
  L: DimRequest;
  W: DimRequest;
  H: DimRequest;
  type: ScaffoldType;
  typeExplicit: boolean;
  /** Called access side as a dimension request ("access 5" → 5 ft), if any. */
  accessSide: DimRequest | null;
  accessType: AccessType | null;
  moreWays: boolean;
  warnings: string[];
}

export type ParseResult = { ok: true; callout: Callout } | { ok: false; error: string };

// ---------------------------------------------------------------- geometry

export interface BaySplit {
  /** Bay lengths in metres along this axis. */
  bays: number[];
  labels: string[];
  total: number;
  /** Target length in metres the split was ranked against. */
  target: number;
  exact: boolean;
}

export interface Position {
  id: string;
  i: number;
  j: number;
  x: number;
  y: number;
}

export type FaceId = 'L0' | 'L1' | 'W0' | 'W1';

export interface Edge {
  id: string;
  axis: Axis;
  /** Grid indices of the start node. */
  i: number;
  j: number;
  length: number;
  perimeter: boolean;
  face: FaceId | null;
}

export interface Bay {
  id: string;
  i: number;
  j: number;
  lenL: number;
  lenW: number;
}

export interface Lift {
  from: number;
  to: number;
  height: number;
  full: boolean;
}

export interface Levels {
  pitch: number;
  baseOffset: number;
  deck: number;
  midRail: number;
  topRail: number;
  ledgerLevels: number[];
  lifts: Lift[];
  /** Height of level n above ground. */
  heightOf: (n: number) => number;
}

export interface TowerOptions {
  accessType: AccessType;
  /** Axis the access face runs along (its length), e.g. 'W' = ladder on the W-side face. */
  accessAxis: Axis;
  spanAxis: Axis;
  gateType: GateType;
  diagonalAccess: DiagonalAccess;
  standardsComboIndex: number;
}

export interface Tower {
  type: ScaffoldType;
  splitL: BaySplit;
  splitW: BaySplit;
  nL: number;
  nW: number;
  totalL: number;
  totalW: number;
  positions: Position[];
  edges: Edge[];
  bays: Bay[];
  levels: Levels;
  options: TowerOptions;
  accessFace: FaceId | null;
  oppositeFace: FaceId | null;
  accessEdgeId: string | null;
  accessBayId: string | null;
  askedHeight: number;
  deckHeight: number;
  topRailHeight: number;
  ratio: number;
  ratioLimit: number | null;
  overRatio: boolean;
}

// ---------------------------------------------------------------- members / BOM

export type SizeSpec =
  | { kind: 'length'; m: number }
  | { kind: 'bay'; l: number; w: number }
  | { kind: 'deck'; length: number; width: number }
  | { kind: 'part'; partId: string }
  | { kind: 'piece'; m: number }
  | { kind: 'none' };

export interface Member {
  id: string;
  ruleId: string;
  ruleLabel: string;
  category: string;
  size: SizeSpec;
  /** Scope element id (position, edge, bay, face…). */
  elementId: string;
  level: number;
  qty: number;
  /** Resolved catalog part, or null when missing. */
  partId: string | null;
  missing: string | null;
  /** Explanation grouping helpers. */
  scopeNoun: string;
  levelName: string;
  companionOf: string | null;
}

export interface Contribution {
  ruleId: string;
  ruleLabel: string;
  qty: number;
  elements: number;
  qtyPer: number;
  levelNames: string[];
  scopeNoun: string;
}

export interface BomLine {
  key: string;
  partId: string | null;
  category: string;
  label: string;
  metric: string;
  qty: number;
  weightKg: number | null;
  verify: boolean;
  missing: string | null;
  contributions: Contribution[];
  explanation: string;
  notes: string[];
}

export interface Bom {
  lines: BomLine[];
  pieces: number;
  weightKg: number;
  weightComplete: boolean;
}

export interface StandardsCombo {
  pieces: number[];
  total: number;
  overshoot: number;
}

export interface VariantResult {
  key: string;
  label: string;
  tower: Tower;
  members: Member[];
  bom: Bom;
  standardsCombos: StandardsCombo[];
  warnings: string[];
  notes: string[];
  missingParts: string[];
  possible: boolean;
  /** Closeness rank of the bay split (0 = closest); variants sort by this, then piece count. */
  splitRank: number;
  /** Ground to top of the chosen standards (m); null when no standards combo fits. */
  overallHeight: number | null;
}
