import type { EngineData } from '../engine/types';
import categories from './categories.json';
import catalog from './catalog.json';
import deckFill from './deckFill.json';
import rules from './rules.json';
import settings from './settings.json';
import sizeMap from './sizeMap.json';
import { engineDataSchema } from './schema';

/** Validated seed data. Returns a fresh deep copy each call so callers may mutate it. */
export function loadSeed(): EngineData {
  const raw = structuredClone({ settings, sizeMap, deckFill, catalog, rules, categories });
  return engineDataSchema.parse(raw);
}
