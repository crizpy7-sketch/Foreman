# Assumptions log

Every default I picked without your confirmation. Items marked **VERIFY** are numbers or yard practice you need to check; the rest are design choices you can override. Everything here can be changed through data or settings, not code: `src/data/*.json` now, and the in-app editors from M3.

## Layher data (non-negotiable 2)
**Source:** Layher Allround *Catalogus & Prijslijst 2025/2026* (NL/FR, DOC0228), hosted by Layher at
https://layher-content-prod.s3.eu-central-1.amazonaws.com/s3fs-public/2025-04/Layher-allround-catalogus-prijslijst-doc0228.pdf.
Every part with an article number or weight has `source` = that URL + `#page=N`. `scripts/gen-catalog.mjs` regenerates `catalog.json` and holds the rows exactly as copied.
I couldn't reach Layher's English or US catalogue from this environment (blocked), so the catalogue above is the European edition. US stock can differ, especially weights (LW = current lightweight generation).

**Confirmed from the catalogue** (`verify: false`):
- Standards with spigot, 50 cm rosette spacing, LW: 0.5–4.0 m = 2617.xxx.
- Ledgers LW = 2601.xxx.
- Base collar = 2602.000.
- U-ledgers: 0.73 / 1.09 = 2618.073 / .109. **From 1.40 up, the U-ledger is the reinforced one** (2618.140–.307). A plain 1.40 (2618.139) exists but is on request.
- Vertical diagonals for a 2.00 m bay height = 2683.xxx.
- U-steel decks, U-application: 0.32 wide = 3883.xxx in all 7 lengths, **including 1.40**. 0.19 wide = 3801.xxx in all 7 lengths.
- U-toe boards, wood = 2640.xxx.
- Lift-off preventers 2635.073/.109 and 2658.140–.257.
- Swing gate 0.73 = 2627.073.
- Access ladders 4009.007 / 0731.036 / 4005.010.
- Aluminium access decks with hatch = 3851.157–.307.
- Horizontal diagonals with wedge heads (p17), **only these bays**: square 2'×2' … 10'×10', and 7'×2', 7'×3', 7'×4', 7'×5', 8'×3', 8'×4', 8'×5', 8'×7', 10'×3', 10'×4', 10'×5', 10'×7', 10'×8'. Some come in left and right versions.
- The size map's metric lengths (0.73 … 3.07) are confirmed as Layher system lengths (centre-to-centre of standards).

**Still to verify:**
- **VERIFY**: horizontal diagonals for every other bay combo (including **5'×4'**, 5'×3', 4'×3' and 4'×2') are **not in the Layher catalogue**. They stay as placeholders (active, no article, no weight, verify). Deactivate any you don't have. This is the only part missing a weight in a 5x4 list, so those totals say "≥ … weight incomplete".
- **VERIFY**: castor = swivel castor ø200 1000 kg (1260.201). The catalogue doesn't say whether it has a brake. The alternative is 1267.200 (castor with half coupler, 0.30–0.60 m spindle).
- **VERIFY**: base jack = base plate spindle 0.60 (4001.060). The alternatives are 0.40 (4001.040) and reinforced 0.80 (4002.080).
- **VERIFY**: outside ladders = steel scaffold ladders 2/3/4 m (1002.008/.012/.016). Aluminium 2.90/4.00 (1004.010/.014) are seeded off. Each ladder gets 1 ladder fixing device (0718.846); the count is unconfirmed.
- **VERIFY**: the stabilizer and safety chain are generic. Neither is in the Allround catalogue.
- **VERIFY**: access decks are **0.61 wide** and replace 2 × 0.32 decks. They exist only for spans of 1.57 and up, so a 4'-span hatch build is "not in catalog". Versions with an integrated ladder exist for 2.57/3.07 (3852.xxx) but aren't seeded.
- Deck names: a "Deck 4'" is a standard 0.32 m (about 12½") wide steel deck, 1.40 m (4') long. A "Narrow deck 5'" is the 0.19 m (about 7½") wide filler deck, 1.57 m (5') long.
- Brief-defined stock: 1.40 × 0.32 decks, all 0.19 decks and all access decks stay **off** until you confirm the yard stocks them. Layher makes them all.
- **Gates**: Layher makes no gate wider than 0.73 (system) / 1.00 (metric), so the old generic 4'/5'/… gates are removed.

## Sizes and parsing
- Size map as given in the brief: 2'=0.73, 3'=1.09, 4'=1.40, 5'=1.57, 7'=2.07, 8'=2.57, 10'=3.07. The metric lengths are confirmed Layher system lengths (catalogue p11). The feet names are your yard's convention, so the entries are now `verify: false`. The alias "3.5" → 1.09 is seeded from the brief's example. Layher also makes 1.03 / 1.29 / 4.14 ledgers, which aren't mapped.
- **VERIFY**: deck fill as given in the brief. The 0.32 and 0.19 deck widths are confirmed (p23); the fill per bay width isn't stated in the catalogue. 1.57 and 2.57 need a 0.19 deck, so any build whose deck width is 5' or 8' is "not possible" until 0.19 decks are switched on.
- A number with no unit is **feet**. A trailing `m` means metres. Heights also accept `8'6"`, `8' 6"` and `8ft`.
- A single letter `r` or `s`, alone or stuck to the height (`5x4x8r`), means rolling or stationary.
- Dictation fixes: "for" and "to" next to "by" are read as 4 and 2. "and a half" adds 0.5. "point" makes a decimal.
- If the access side you call isn't a side of the tower ("a7" on a 5x4), I warn you and show every side.
- Words the parser doesn't understand are shown as "Ignored: …" rather than causing an error.

## Heights and levels
- **Confirmed by you**: `heightMeans = legs`. The called H is the **leg (standards) length**: "a 10 ft scaffold has a 10 ft leg". The castor or base jack underneath doesn't count. H picks the top-rail rosette (round(H ÷ 0.5 m)), the standards reach it, and the deck is 2 levels (1.0 m) below. 10' → 3.0 m legs, 8' → 2.5 m, 6' → 2.0 m, 16' → 5.0 m stack. Lists lead with "Legs 8' (2.50 m), asked 8' · deck … · top rail … · overall …". Base offsets now only change the heights shown above ground, not the pick list.
- **VERIFY**: yard names for legs = nearest foot: 0.5 = 2', 1.0 = 3', 1.5 = 5', 2.0 = 7', 2.5 = 8', 3.0 = 10', 4.0 = 13'. Only 10' = 3.0 m is confirmed. 2.0 m (6'-7") could be what you call 6' or 7'.
- **VERIFY**: base offsets are 0.45 m (rolling) and 0.30 m (stationary), measured from the ground to the base-collar rosette (level 0).
- **VERIFY**: rosette pitch is 0.5 m. The mid-rail is at k+1 and the top rail at k+2. The lift height is 2.0 m.
- Rounding is `nearest` (an 8' call = 2.438 m rounds to the 2.5 m leg).
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
- Gate setting now defaults to **rails stay**, because Layher only makes a 0.73 gate. With **gate**, one gate replaces both rails in the ladder bay; on a face wider than 2' that build becomes "not possible: Gates 4' — not in catalog". With **chain**, 2 chains replace them.
- Hatch towers keep all rails (no gate).
- Toe boards go on all 4 perimeter edges, including the ladder side.
- Vertical diagonals: one per perimeter bay-face per full lift. On the access face the default is **keep**. **move** puts that diagonal on the opposite face's matching bay. **omit** drops it.
- Horizontal diagonals: one per bay at the base. Rolling towers always get them; stationary towers get them while `horizontalDiagonalStationary = true`, which is the default.
- Ladder: the fewest steel scaffold-ladder sections whose length reaches deck height above the base level (k × 0.5 m) plus `ladderAboveDeck` (0 m), with up to 1.0 m overshoot.
- Hatch: the access deck has the same length as the deck span and replaces 2 decks in bay 1. One **Layher access ladder** (2.15 m for a 2.0 m lift) goes in each full lift.
- **Lift-off preventers (new rule, not in the brief)**: Layher states that "decks on U-ledgers must be secured with U-lift-off preventers" (catalogue p27/p34). I seeded one per deck U-ledger, sized to the U-ledger (rule `liftOffPreventers`). Layher lists none for 3.07, so **a single 10' bay with decks running 5' is "not possible"** until you decide what goes there (for example the universal U-lift-off preventer 2635.001).
- **VERIFY**: lift-off preventer count. One per deck U-ledger is my reading, not a Layher figure.
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

## App behaviour (M3–M5)
- **Undo**: catalog, rule and setting edits, list edits, toggles and load changes all go into one 20-step undo. Text fields commit on leaving the field, so one edit is one undo step.
- Loading checkboxes on a list are for ticking off while you load. They aren't saved.
- **My version** is keyed by the callout without its qty, plus the build. It is saved with **Save as my version** and removed with **Remove my version**.
- A **share link** carries the towers (callout, build, qty, edits) and the job details, compressed into the URL. The receiver recalculates with *their* catalog and rules; the sender's edits are kept.
- Opening a job from **Jobs** saves the current load first (if it has towers), so nothing is lost.
- The rules list for Rolling or Stationary is worked out by evaluating each rule's condition against the live-test tower with that type.
- **Seed updates**: while you haven't edited the catalog, rules or settings, a newer app version brings its new seed data. Once you edit, your data is kept. **Settings → Reset to seed data** brings the seed back (jobs are kept).
- **Spares**: the setting is there but not applied yet.
- **Mic**: Web Speech API (en-US). Where it's unavailable (typically an installed iPhone app), the mic button focuses the box and points you to the keyboard's dictation.
- **Deploy**: GitHub Pages through `.github/workflows/deploy.yml`. Pages has to be switched to "GitHub Actions" in the repo settings once.

## Repository
- The old `index.html` (Foreman Time Charge Pro) moved, unchanged, to `public/time-charge.html` so the app can use the root `index.html`. It is still served at `time-charge.html` and linked from Settings.
