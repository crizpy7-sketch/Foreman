// Inline validation for the rules editor.
import { validateExpr } from './expr';
import { RULE_VARIABLE_NAMES } from './rules';
import type { EngineData, PlacementRule } from './types';

const BAY_SCOPES = new Set(['bays', 'accessBay']);
const EDGE_SCOPES = new Set(['allEdges', 'perimeterEdges', 'edgesAlongSpan', 'edgesAcrossSpan', 'perimeterBayFaces', 'accessFace', 'nonAccessFaces', 'oppositeAccessFace']);

export interface RuleIssue {
  field: keyof PlacementRule;
  message: string;
}

export function validateRule(r: PlacementRule, d: EngineData): RuleIssue[] {
  const out: RuleIssue[] = [];
  const expr = (field: 'qtyPer' | 'condition' | 'reach', src: string | number | null) => {
    if (typeof src !== 'string') return;
    const e = validateExpr(src, RULE_VARIABLE_NAMES);
    if (e) out.push({ field, message: e });
  };
  expr('condition', r.condition);
  expr('qtyPer', r.qtyPer);
  if (r.sizeFrom === 'combo') {
    if (!r.reach) out.push({ field: 'reach', message: 'Combo rules need a reach expression (m)' });
    else expr('reach', r.reach);
  }
  if (!r.label.trim()) out.push({ field: 'label', message: 'Label is required' });
  if (!d.categories.some((c) => c.id === r.category)) out.push({ field: 'category', message: `Unknown category "${r.category}"` });
  if (r.sizeFrom === 'fixed' && !d.catalog.some((p) => p.id === r.partId))
    out.push({ field: 'partId', message: 'Pick the catalog part this rule always uses' });
  if ((r.sizeFrom === 'edge') && !EDGE_SCOPES.has(r.scope))
    out.push({ field: 'sizeFrom', message: 'Size from "edge" needs an edge scope (edges, faces)' });
  if ((r.sizeFrom === 'bay' || r.sizeFrom === 'deckFill' || r.sizeFrom === 'crossWidth') && !BAY_SCOPES.has(r.scope))
    out.push({ field: 'sizeFrom', message: `Size from "${r.sizeFrom}" needs a bay scope` });
  if (!r.levels.length) out.push({ field: 'levels', message: 'Pick at least one level' });
  for (const id of r.replaces)
    if (!d.rules.some((x) => x.id === id)) out.push({ field: 'replaces', message: `Replaces unknown rule "${id}"` });
  if (r.replaces.includes(r.id)) out.push({ field: 'replaces', message: 'A rule cannot replace itself' });
  if (d.rules.filter((x) => x.id === r.id).length > 1) out.push({ field: 'id', message: `Duplicate rule id "${r.id}"` });
  return out;
}
