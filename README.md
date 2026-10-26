# Scaffold LoadOut

Phone-first pick lists for Layher Allround (pinlock) towers from yard callouts ("5x4x8 rolling").
See `SPEC.md` (source of truth), `CLAUDE.md` (working rules) and `ASSUMPTIONS.md` (defaults to verify).

Status: **M1 done, at the M2 checkpoint**. The engine, seed data and tests are in place; the UI starts in M3.

```bash
npm install
npm run check       # typecheck + lint + tests
npm run report:m2   # print the M2 checkpoint lists (also: -- --out docs/M2-REPORT.md)
```

- `src/engine`: pure TypeScript engine (parser → geometry → placement rules → members → catalog parts → BOM, variants, overrides)
- `src/data`: seed JSON (catalog, size map, deck fill, settings, rules) + Zod schemas

> Material estimate only — build per Layher instructions, site rules and your competent person.
