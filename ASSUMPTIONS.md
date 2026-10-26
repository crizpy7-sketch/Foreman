# Assumptions log

Every default I picked without your confirmation. Items marked **VERIFY** are numbers or yard practice you need to check; the rest are design choices you can override. Everything here can be changed through data or settings, not code: `src/data/*.json` now, and the in-app editors from M3.

## Layher data (non-negotiable 2)
- **VERIFY**: every catalog part, size-map entry, deck-fill row and placement rule is seeded with `verify: true`. `articleNo`, `weightKg` and `source` are all `null`. I copied no Layher data.
- Weights are stored in **kg**, because Layher documents use kg, and shown in **lb** by default (`weightUnit`). While any weight is missing, totals say "weight incomplete".
- Castor, base jack, ladder sections, ladder hooks, gates, safety chain and stabilizer are **generic placeholders**, not specific Layher articles.
- **VERIFY**: generic ladder sections are seeded at **2.0 m and 3.0 m**. I made these up as placeholders, so replace them with what you stock. Each section has **2 ladder hooks** as companions.
- I added a **Safety chain (generic)** part, which isn't in the brief's catalog list, so the "chain" gate setting has something to point at.
- **VERIFY**: access/hatch decks are seeded **off**, in all 7 lengths, assumed **0.64 m wide** with `replacesDecks: 2`.
- **VERIFY**: gates are seeded **on**, in all 7 face widths.
- U-steel decks: 0.32 m wide in 7 lengths, with 1.40 **off**. All 0.19 m decks are **off**. This follows the brief.

## Sizes and parsing
- **VERIFY**: size map as given in the brief: 2'=0.73, 3'=1.09, 4'=1.40, 5'=1.57, 7'=2.07, 8'=2.57, 10'=3.07. The alias "3.5" → 1.09 is seeded from the brief's example.
- **VERIFY**: deck fill as given in the brief. 1.57 and 2.57 need a 0.19 deck, so any build whose deck width is 5' or 8' is "not possible" until 0.19 decks are switched on.
- A number with no unit is **feet**. A trailing `m` means metres. Heights also accept `8'6"`, `8' 6"` and `8ft`.
- A single letter `r` or `s`, alone or stuck to the height (`5x4x8r`), means rolling or stationary.
- Dictation fixes: "for" and "to" next to "by" are read as 4 and 2. "and a half" adds 0.5. "point" makes a decimal.
- If the access side you call isn't a side of the tower ("a7" on a 5x4), I warn you and show every side.
- Words the parser doesn't understand are shown as "Ignored: …" rather than causing an error.

## Heights and levels
- **VERIFY**: `heightMeans = deck`. The called H is the deck height.
- **VERIFY**: base offsets are 0.45 m (rolling) and 0.30 m (stationary), measured from the ground to the base-collar rosette (level 0).
- **VERIFY**: rosette pitch is 0.5 m. The mid-rail is at k+1 and the top rail at k+2. The lift height is 2.0 m.
- Rounding is `nearest`. A stationary 8' therefore gets a deck at **7'-7"** (asked 8'), because the 0.30 m offset puts it between rosettes. `up` would give 9'-2".
- The deck level is never below 1.
- ft-in values are rounded to the nearest inch.
- The standards stack is measured from the base-collar rosette and must reach the top-rail rosette exactly (`standardAboveTopRail = 0`). The base collar's own length is ignored. **VERIFY** whether the standards must stick up above the top rail.
- Standards combos allow up to 0.5 m overshoot and at most 4 pieces per position. The preferred order is 3.0, 2.0, 4.0, 2.5, 1.5, 1.0, 0.5, and 5 combos are shown. Every position uses the same combo.
- Ledger levels are counted down from the deck in 2.0 m steps, so only the **bottom** lift can be short.
- Short lifts get ledgers but **no vertical diagonals** and **no hatch ladder**. Both rules use `qtyPer = "liftFull ? 1 : 0"`, and the explanation says so.
- One deck level only: the top one. The data shapes allow more deck levels later.

## Geometry and bay splits
- Bays within one direction are all equal (`allowMixedBays = false`). I allow at most 3 bays per direction, show 3 options, and drop any option more than 0.4 m (`maxSplitDeviation`) from the called length.
- If a size **has** an exact entry, "More ways" adds multi-bay splits only (10' → 2×5', 3×3'). It never offers a different single size. A size with **no** exact entry (6') also offers the nearest single sizes (7', 5').
- "More ways" applies to both L and W. For example, 10x5 also offers a 5' width as 2×2'.
- Variants are sorted by how close the bay split is to the call, then by fewest pieces. The possible list and the not-possible list are each capped at 8 (`maxVariants`).
- Identical builds are shown once. A square tower would otherwise list the same build twice.
- When both directions give the same deck length, the label says which side the decks run along ("decks run 5' along the 2×5' side").
- The ladder, gate and hatch always go in the **first bay** of the access face.

## Placement rules (all **VERIFY**)
- Ledgers go on every edge (interior edges included) at the base and at each intermediate ledger level.
- At deck level, U-ledgers go on every edge across the deck span and ledgers on every edge along it, interior edges included.
- Guardrails are ledgers on every perimeter edge at the mid-rail and top rail.
- Gate setting defaults to **gate**. One gate replaces both rails in the ladder bay. With **chain**, 2 chains replace them. With **rails stay**, nothing changes.
- Hatch towers keep all rails (no gate).
- Toe boards go on all 4 perimeter edges, including the ladder side.
- Vertical diagonals: one per perimeter bay-face per full lift. On the access face the default is **keep**. **move** puts that diagonal on the opposite face's matching bay. **omit** drops it.
- Horizontal diagonals: one per bay at the base. Rolling towers always get them; stationary towers get them while `horizontalDiagonalStationary = true`, which is the default.
- Ladder: the fewest generic sections whose length reaches deck height above the base level (k × 0.5 m) plus `ladderAboveDeck` (0 m), with up to 1.0 m overshoot.
- Hatch: the access deck has the same length as the deck span and replaces 2 decks in bay 1. One ladder goes in each full lift.
- Stabilizers: 4 per rolling tower when deck height above ground ÷ the narrowest footprint side (system lengths) is over **3:1**. Stationary towers have no ratio limit (`ratioLimitStationary = null`).
- One castor (rolling) or one base jack (stationary), plus one base collar, under every standard.
- Hatch access is in the variant list by default (`accessTypes`). Hatch decks are off, so those builds always show up under "Not possible".

## Display
- Ledger, deck, toe-board, gate and diagonal names come from the size map ("Ledger 5' (1.57)"). Standards and ladders have no size-map name, so they show the ft-in of their length ("Standard 9'-10" (3.00)"). **VERIFY** what the yard calls them; you can set a `nominal` on any part.
- Metric small print always has 2 decimals (1.40, 3.00).

## Editing and overrides
- Edits are keyed by the calculated line's part id. A swap keeps the original key, so a later recalculation still lines up.
- Removed lines stay in the list, struck through, and don't count toward totals.
- A conflict is flagged when the calculated qty has changed since your qty, swap or remove edit. A note alone never conflicts. Your edits are always kept.
- The "my version" key is the canonical callout without the quantity, plus the variant key.

## Not yet applied
- The spares setting exists but is off and not used by the engine yet.

## Repository
- The existing `index.html` (Foreman Time Charge Pro) is unchanged. In M3 the Vite app needs the root `index.html`, so I plan to move that page to `public/time-charge.html`, where it will still be served.
