# Build "Scaffold LoadOut" — Layher pinlock material lists

You're building a phone-first app I'll use in the scaffold yard. My foreman calls out a scaffold ("load up a 5x4x8 rolling") and I need the exact Layher pick list for it, for every valid way it can be built (ladder access on the 4' side vs the 5' side, etc.). I must always be able to edit everything: the list, the rules behind it, and the parts catalog.

First: save this brief verbatim as SPEC.md (source of truth) and write a short CLAUDE.md with the non-negotiables. Don't stop to ask me anything before the M2 checkpoint. Make reasonable assumptions and log each one in ASSUMPTIONS.md.

## The system
- "Pinlock" = Layher Allround. It has:
  - standards with rosettes every 0.5 m and wedge-pin ledgers
  - base collars, and U-ledgers that carry 0.32 m steel decks
  - vertical diagonals sized per bay for a 2.0 m lift, plus horizontal (plan) diagonals
  - toe boards, and castors with height-adjust spindles for rolling towers
- Layher sizes are metric; the yard calls them in feet. Default size map (editable, VERIFY): 2'=0.73 · 3'=1.09 · 4'=1.40 · 5'=1.57 · 7'=2.07 · 8'=2.57 · 10'=3.07 m. So "5x4" = 1.57 × 1.40.
- Show parts the way the yard says them, with metric in small text: "Ledger 5' (1.57)".

## Non-negotiables
1. Data-driven: the catalog, size map, deck fill, settings and placement rules are data (seeded from JSON). Never hard-code them in logic.
2. Never invent Layher data. Article numbers and weights stay null unless taken from an official Layher document, with the URL saved in `source`. Don't burn time hunting; I'll fill them in. Anything unconfirmed gets `verify: true` and a visible "verify" badge wherever it's used.
3. Every quantity is explainable. Tap a line to see where it came from ("Ledger 5' × 6 = 2 long sides × 3 levels: base, mid-rail, top-rail").
4. I have the final word. Any line can be edited, swapped, added or removed, and my edits are never silently overwritten.
5. Deterministic pure-TypeScript engine with zero UI dependencies, fully unit-tested. No AI in the calculation path. No eval or new Function.
6. Offline-first: works with no signal once installed. No login and no server in v1.
7. Footer on every list: "Material estimate only — build per Layher instructions, site rules and your competent person."

## Core flow ("5x4x8 rolling")
1. Home: one big input, a mic button, and recent/favorite callouts. I type or say "5x4x8 rolling".
2. Variant cards, one per valid build, e.g. "Ladder on 4' side · decks run 5'" and "Ladder on 5' side · decks run 5'". Each card shows piece count, total weight (or "weight incomplete") and warnings. Label faces by size ("4' side"), the way people talk.
3. Compare any two variants and show only the lines that differ.
4. Open a variant to get:
   - the pick list grouped by category in yard order, with a checkbox per line for loading
   - a sticky totals bar
   - live toggles for access side, deck direction, standards combo and gate type
   - a plan + elevation SVG with heights in ft-in
5. Edit anything, save it as a job, add more towers to the same load, and share.

## Callout parser
- Accept:
  - "5x4x8 rolling", "5 x 4 x 8 roll", "5x4x8r"
  - "2@5x4x8 rolling" (quantity)
  - "stat", "stationary" or "fixed" for type
  - "access 5", "a5" or "ladder on 5" for access side, and "hatch"
  - heights like 8'6" or 2.5m
  - spoken numbers from the mic ("five by four by eight rolling"). Use the Web Speech API and fall back to the keyboard's dictation.
- First number = L, second = W, third = H. If the type is missing, use the default from settings (rolling).
- If a called size has no exact size-map entry ("6x4"), say so and offer the closest builds.

## Geometry & heights
- The tower is a grid of nL × nW bays (default 1×1).
- Offer single- and multi-bay options in two cases: the called dimension has no exact size-map entry, or I tap "More ways". Example: 10' = one 10' bay or 5'+5'. Rank options by how close the actual length is to the call, and show actual ft-in on each.
- Levels = rosette index above the base collar (pitch 0.5 m, editable).
- Setting `heightMeans`: deck (default) | top rail | top of standards.
- `baseOffsetRolling` / `baseOffsetStationary` = ground to base-collar rosette (defaults 0.45 / 0.30 m, VERIFY; I'll measure).
- Deck level k = round((H − offset) / pitch). The rounding mode is a setting.
- Always show asked vs actual: "Deck 8'-0" (asked 8')", plus the top-rail height.
- Mid-rail goes at k+1 and top-rail at k+2 (1.0 m ≈ 39"). Both editable.
- Ledger levels: the base (0), plus levels counted down from the deck in lift steps (2.0 m, editable). A leftover short lift at the bottom gets ledgers but no diagonal; say so in the explanation.
- Standards: find combos of active lengths that reach the top-rail level, with max overshoot 0.5 m (setting). Rank by fewest pieces, then least overshoot. Show them as a selector inside each variant. My preferred-lengths order is a setting.
- Stability: compare deck height ÷ narrowest base against a limit (rolling default 3:1, editable). Over the limit → red warning + stabilizer lines.

## Engine: geometry → members → parts → BOM
Don't hand-write per-part count formulas. Instead:
1. Build the tower model (positions, edges, faces, levels).
2. Apply placement rules to create members.
3. Map each member to an active catalog part by category + size.
4. Aggregate into the BOM with explanations.

The same member list drives the SVG.

Placement rule fields:
- id, label, category, note
- scope: positions | allEdges | perimeterEdges | edgesAlongSpan | edgesAcrossSpan | bays | perimeterBayFaces | accessFace | nonAccessFaces
- levels: base | ledgerLevels | deck | midRail | topRail | eachLift
- qtyPer: a number or a safe expression using geometry variables (k, lifts, nL, nW, posts, …)
- sizeFrom: edge | span | crossWidth | bay (L×W) | fixed part | standardsCombo
- condition: e.g. type == 'rolling'
- replaces: the rules it substitutes on its scope

Parts can declare companion parts (e.g. ladder → hooks) and `replacesDecks` (for access/hatch decks).

Seed rules (editable, all VERIFY):
1. Castor with spindle + brake: 1 per position (rolling).
2. Base jack: 1 per position (stationary).
3. Base collar: 1 per position.
4. Standards: the chosen combo per position.
5. Ledgers on all edges at the base and at every intermediate ledger level.
6. Horizontal diagonal: 1 per bay at the base (rolling; stationary per setting).
7. Deck level: U-ledgers on edges across the deck span, ledgers on edges along it.
8. Decks: per bay per deck level, use the deck fill for the cross width; deck length = span.
9. Guardrails: ledgers on perimeter edges at mid-rail and top-rail. On the access face, apply the gate setting (gate | chain | rails stay).
10. Toe boards: 1 per perimeter edge per deck level, sized to the edge.
11. Vertical diagonals: 1 per perimeter bay-face per lift, sized by that bay. Access-face setting: keep | move to opposite face | omit.
12. Ladder access: ladder(s) on the access face reaching the deck, using the fewest pieces, plus companions.
13. Hatch access: in one bay per deck level, an access deck of the same span replaces `replacesDecks` decks, plus a ladder per lift.
14. Stabilizers: 4 per tower when over the ratio limit (rolling).

Deck fill (decks across a bay width; editable, VERIFY):
0.73 → 2×0.32 · 1.09 → 3×0.32 · 1.40 → 4×0.32 · 1.57 → 4×0.32 + 1×0.19 · 2.07 → 6×0.32 · 2.57 → 7×0.32 + 1×0.19 · 3.07 → 9×0.32.

Seed catalog (everything verify: true; "(off)" = inactive until I confirm we stock it):
- standards 0.5 / 1.0 / 1.5 / 2.0 / 2.5 / 3.0 / 4.0 m
- ledgers and U-ledgers 0.73 / 1.09 / 1.40 / 1.57 / 2.07 / 2.57 / 3.07
- U-steel decks 0.32 wide in 0.73 / 1.09 / 1.57 / 2.07 / 2.57 / 3.07 (1.40 off)
- 0.19 decks (off)
- vertical diagonals per bay length; horizontal diagonals per L×W combo
- toe boards per length
- base collar, base jack, castor
- generic ladder sections, a gate per face size, and a stabilizer
- access/hatch decks (off)

Variants:
- Enumerate access face × access type × deck span direction × bay split (bay split only when offered).
- Sort by fewest pieces and cap at 8.
- Variants that need an inactive part go in a collapsed "Not possible with current catalog" section that names the missing part.

## Editing — I'm always in control
- This list:
  - type a qty or use big +/− steppers
  - swap to another size in the same category
  - add any catalog part or a free-text item
  - delete a line or add a note
  - edited lines are highlighted, with "reset line" and "reset all"
  - store edits as a diff over the calculated list; if a toggle or rule change moves the base, keep my edits and flag conflicts
- Make it my default: "Save as my version of 5x4x8 rolling · ladder 4' side". That exact callout + variant then loads my version (badged), with a toggle to see the calculated one and the diff.
- Rules editor: placement rules per scaffold type in a table with dropdowns, a live test panel (type any callout and watch the list change), inline validation, and version history with restore.
- Catalog editor:
  - add, edit or deactivate parts; inactive parts are never chosen
  - fields: name, category, size (m), nominal label, Layher article no., weight, yard location, companions, verify, source, notes
  - CSV import/export
- Settings:
  - size map with aliases ("3.5" → 1.09) and deck fill
  - height convention, offsets, rail levels, lift height, max overshoot
  - ratio limit, gate/diagonal handling
  - category order (yard order), units (weight in lb by default), default type
  - spares (off)
- Safety nets:
  - undo for the last 20 actions everywhere
  - export/import all data as JSON
  - request navigator.storage.persist()
  - a weekly backup reminder

## Loads, sharing, history
- A load = several towers, each with a qty → combined totals + a per-tower breakdown.
- Sharing options:
  - copy as plain text formatted for a text message
  - Web Share API
  - a print-friendly page (save as PDF)
  - a share link with the load compressed in the URL hash (no server)
- History: saved jobs with date, foreman, job/location and status (draft / loaded). I can duplicate a past job.

## UX
Phone-first, one-handed and glove-friendly (48px+ targets). High contrast for sunlight, dark mode, minimal typing.

## Tech
- Vite + React + TypeScript (strict) + Tailwind
- Dexie (IndexedDB), Zod for seed/import validation
- vite-plugin-pwa (installable, offline), lz-string for share links
- a small hand-written expression evaluator (arithmetic, comparisons, and/or, min/max/ceil/floor, named variables)
- Vitest, plus one Playwright smoke test
- Folders: src/engine (pure TS), src/data (seed JSON), src/db, src/ui
- Static deploy (Vercel/Netlify/GitHub Pages). README with "Add to Home Screen" steps for iPhone and Android.

## Milestones
- M1: engine + seed data + tests (parser, geometry, variants, BOM, overrides).
- M2 CHECKPOINT — stop here.
  - Print as terminal tables the full lists, level breakdown and actual heights for:
    - "5x4x8 rolling" (every variant)
    - "5x4x8 stationary"
    - "5x4x16 rolling" (should trip the ratio warning)
    - "6x4x8 rolling" (should explain there's no 6' and offer the closest builds)
    - "10x5x8 stationary" with More ways on (one 10' bay vs 2×5')
  - Then ask me in one message:
    - Is the size map right?
    - What does H mean in my yard?
    - What are the base offsets?
    - What are the guardrail, toe-board and diagonal rules?
    - Which ladders, gates, hatch decks and 0.19 / 1.40 decks do we stock?
  - Apply my answers, then lock those lists as golden tests.
- M3: UI — callout → variants → list → edit → save; catalog, settings and rules editors.
- M4: loads, share/print, history, backups, PWA offline.
- M5: SVG plan/elevation, compare view, mic input, polish, README.

Later (design for it, don't build): yard stock counts and shortage flags, return check-in, sync between phones, stair towers and long runs.

Done = tests, typecheck and lint pass. The production build works offline after first load and installs on my phone. ASSUMPTIONS.md lists every default I still need to verify.
