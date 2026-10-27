import { z } from 'zod';
import type {
  CategoryInfo,
  DeckFillEntry,
  EngineData,
  Part,
  PlacementRule,
  Settings,
  SizeMapEntry,
} from '../engine/types';

const len = z.number().positive();

export const sizeMapEntrySchema = z.object({
  label: z.string().min(1),
  ft: z.number().positive(),
  m: len,
  aliases: z.array(z.string()),
  verify: z.boolean(),
}) satisfies z.ZodType<SizeMapEntry>;

export const deckFillEntrySchema = z.object({
  bayWidth: len,
  pieces: z.array(z.object({ width: len, count: z.number().int().positive() })).min(1),
  verify: z.boolean(),
}) satisfies z.ZodType<DeckFillEntry>;

export const partSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  category: z.string().min(1),
  size: len.nullable(),
  size2: len.nullable(),
  nominal: z.string().nullable(),
  articleNo: z.string().nullable(),
  weightKg: z.number().nonnegative().nullable(),
  yardLocation: z.string(),
  companions: z.array(z.object({ partId: z.string(), qty: z.number().int().positive() })),
  replacesDecks: z.number().int().positive().nullable(),
  active: z.boolean(),
  verify: z.boolean(),
  source: z.string().nullable(),
  notes: z.string(),
}) satisfies z.ZodType<Part>;

const SCOPES = [
  'positions', 'allEdges', 'perimeterEdges', 'edgesAlongSpan', 'edgesAcrossSpan', 'bays',
  'perimeterBayFaces', 'accessFace', 'nonAccessFaces', 'oppositeAccessFace', 'accessBay', 'tower',
] as const;
const LEVELS = ['base', 'ledgerLevels', 'deck', 'midRail', 'topRail', 'eachLift'] as const;
const SIZE_FROM = ['edge', 'span', 'crossWidth', 'bay', 'fixed', 'standardsCombo', 'deckFill', 'combo'] as const;
export const SCOPE_OPTIONS = SCOPES;
export const LEVEL_OPTIONS = LEVELS;
export const SIZE_FROM_OPTIONS = SIZE_FROM;

export const ruleSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  category: z.string().min(1),
  note: z.string(),
  scope: z.enum(SCOPES),
  levels: z.array(z.enum(LEVELS)).min(1),
  qtyPer: z.union([z.number(), z.string().min(1)]),
  sizeFrom: z.enum(SIZE_FROM),
  partId: z.string().nullable(),
  reach: z.string().nullable(),
  condition: z.string(),
  replaces: z.array(z.string()),
  enabled: z.boolean(),
  verify: z.boolean(),
}) satisfies z.ZodType<PlacementRule>;

export const settingsSchema = z.object({
  defaultType: z.enum(['rolling', 'stationary']),
  pitch: len,
  heightMeans: z.enum(['legs', 'deck', 'topRail', 'topOfStandards']),
  rounding: z.enum(['nearest', 'up', 'down']),
  baseOffsetRolling: z.number().nonnegative(),
  baseOffsetStationary: z.number().nonnegative(),
  midRailOffset: z.number().int().positive(),
  topRailOffset: z.number().int().positive(),
  liftHeight: len,
  standardAboveTopRail: z.number().nonnegative(),
  maxOvershoot: z.number().nonnegative(),
  maxStandardPieces: z.number().int().min(1).max(8),
  preferredStandardLengths: z.array(len),
  standardsComboOptions: z.number().int().min(1),
  ladderAboveDeck: z.number().nonnegative(),
  ladderMaxOvershoot: z.number().nonnegative(),
  ratioLimitRolling: len,
  ratioLimitStationary: len.nullable(),
  gateType: z.enum(['gate', 'chain', 'railsStay']),
  diagonalAccess: z.enum(['keep', 'move', 'omit']),
  horizontalDiagonalStationary: z.boolean(),
  accessTypes: z.array(z.enum(['ladder', 'hatch'])).min(1),
  maxBaysPerDirection: z.number().int().min(1).max(6),
  allowMixedBays: z.boolean(),
  bayOptionsShown: z.number().int().min(1),
  maxSplitDeviation: z.number().positive(),
  maxVariants: z.number().int().min(1),
  categoryOrder: z.array(z.string()),
  weightUnit: z.enum(['lb', 'kg']),
  sparesEnabled: z.boolean(),
  sparesPercent: z.number().nonnegative(),
  sizeTolerance: z.number().positive(),
}) satisfies z.ZodType<Settings>;

export const categorySchema = z.object({ id: z.string().min(1), label: z.string().min(1) }) satisfies z.ZodType<CategoryInfo>;

export const engineDataSchema = z
  .object({
    settings: settingsSchema,
    sizeMap: z.array(sizeMapEntrySchema),
    deckFill: z.array(deckFillEntrySchema),
    catalog: z.array(partSchema),
    rules: z.array(ruleSchema),
    categories: z.array(categorySchema),
  })
  .superRefine((d, ctx) => {
    const dup = (ids: string[], what: string, path: string) => {
      const seen = new Set<string>();
      for (const id of ids) {
        if (seen.has(id)) ctx.addIssue({ code: 'custom', message: `Duplicate ${what} id "${id}"`, path: [path] });
        seen.add(id);
      }
    };
    dup(d.catalog.map((p) => p.id), 'part', 'catalog');
    dup(d.rules.map((r) => r.id), 'rule', 'rules');
    const partIds = new Set(d.catalog.map((p) => p.id));
    for (const p of d.catalog)
      for (const c of p.companions)
        if (!partIds.has(c.partId))
          ctx.addIssue({ code: 'custom', message: `Part "${p.id}" companion "${c.partId}" not in catalog`, path: ['catalog'] });
    for (const r of d.rules)
      if (r.sizeFrom === 'fixed' && (!r.partId || !partIds.has(r.partId)))
        ctx.addIssue({ code: 'custom', message: `Rule "${r.id}" needs a valid partId`, path: ['rules'] });
  }) satisfies z.ZodType<EngineData>;
