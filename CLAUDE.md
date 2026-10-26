# Scaffold LoadOut — working rules

SPEC.md is the source of truth. ASSUMPTIONS.md logs every default not yet confirmed by the user — add to it whenever you pick a default.

## Non-negotiables
1. **Data-driven.** Catalog, size map, deck fill, settings and placement rules live in `src/data/*.json` (validated by Zod in `src/data/schema.ts`). Engine logic never hard-codes part sizes, counts or rule behaviour.
2. **Never invent Layher data.** `articleNo` and `weightKg` stay `null` unless copied from an official Layher document, with the URL in `source`. Anything unconfirmed has `verify: true` and shows a "verify" badge wherever it is used.
3. **Every quantity is explainable.** Each BOM line carries the rule contributions that produced it.
4. **The user has the final word.** User edits are stored as a diff over the calculated list and are never silently overwritten; base changes surface as conflicts.
5. **Pure, deterministic engine.** `src/engine` is plain TypeScript with zero UI/DB dependencies (lint-enforced), fully unit-tested. No AI, no `eval`, no `new Function` — expressions go through `src/engine/expr.ts`.
6. **Offline-first.** No login, no server in v1.
7. Every list ends with: "Material estimate only — build per Layher instructions, site rules and your competent person."

## Layout
- `src/engine` — parser, expression evaluator, geometry, rules → members → parts → BOM, variants, overrides
- `src/data` — seed JSON + Zod schemas
- `src/db`, `src/ui` — added in M3
- `scripts/m2-report.ts` — prints the M2 checkpoint tables

## Commands
`npm run check` (typecheck + lint + tests) must pass before every commit. `npm run report:m2` prints the checkpoint lists.

## UI (M3+)
Phone-first, one-handed, glove-friendly (48px+ targets), high contrast, dark mode. Show parts as the yard says them with metric small: "Ledger 5' (1.57)".
