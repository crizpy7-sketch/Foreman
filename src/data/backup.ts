// Export/import of all app data as one JSON file, validated with Zod.
import { z } from 'zod';
import { engineDataSchema, ruleSchema } from './schema';

const overridesSchema = z.object({
  edits: z.record(
    z.object({
      key: z.string(),
      qty: z.number().optional(),
      swapTo: z.string().optional(),
      removed: z.boolean().optional(),
      note: z.string().optional(),
      baseQty: z.number().nullable(),
    }),
  ),
  added: z.array(
    z.object({ id: z.string(), partId: z.string().nullable(), text: z.string().nullable(), qty: z.number(), note: z.string().optional() }),
  ),
});

const splitSchema = z.object({
  bays: z.array(z.number()),
  labels: z.array(z.string()),
  total: z.number(),
  target: z.number(),
  exact: z.boolean(),
});

export const specSchema = z.object({
  splitL: splitSchema,
  splitW: splitSchema,
  accessType: z.enum(['ladder', 'hatch']),
  accessAxis: z.enum(['L', 'W']),
  spanAxis: z.enum(['L', 'W']),
  gateType: z.enum(['gate', 'chain', 'railsStay']),
  diagonalAccess: z.enum(['keep', 'move', 'omit']),
  standardsComboIndex: z.number().int(),
  splitRank: z.number(),
  showSplit: z.boolean(),
});

export const towerSchema = z.object({
  id: z.string(),
  callout: z.string(),
  spec: specSchema,
  qty: z.number().int().positive(),
  overrides: overridesSchema,
});

export const jobSchema = z.object({
  id: z.string(),
  createdAt: z.number(),
  updatedAt: z.number(),
  foreman: z.string(),
  job: z.string(),
  location: z.string(),
  status: z.enum(['draft', 'loaded']),
  notes: z.string(),
  towers: z.array(towerSchema),
});

export const myVersionSchema = z.object({ key: z.string(), callout: z.string(), variantLabel: z.string(), savedAt: z.number(), overrides: overridesSchema });
export const ruleVersionSchema = z.object({ id: z.number().optional(), savedAt: z.number(), note: z.string(), rules: z.array(ruleSchema) });
export const recentSchema = z.object({ callout: z.string(), at: z.number(), favorite: z.boolean() });

export const backupSchema = z.object({
  app: z.literal('scaffold-loadout'),
  version: z.literal(1),
  exportedAt: z.number(),
  data: engineDataSchema,
  jobs: z.array(jobSchema),
  myVersions: z.array(myVersionSchema),
  ruleVersions: z.array(ruleVersionSchema),
  recents: z.array(recentSchema),
});

export type Backup = z.infer<typeof backupSchema>;
export type MyVersion = z.infer<typeof myVersionSchema>;
export type RuleVersion = z.infer<typeof ruleVersionSchema>;
export type Recent = z.infer<typeof recentSchema>;
