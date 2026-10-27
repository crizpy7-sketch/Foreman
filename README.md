# Scaffold LoadOut

Phone-first pick lists for **Layher Allround (pinlock)** towers from yard callouts. Type or say "5x4x8 rolling" and get every valid build, with the exact pick list for each.

- `SPEC.md`: the brief (source of truth)
- `CLAUDE.md`: working rules
- `ASSUMPTIONS.md`: every default still to verify

> Material estimate only — build per Layher instructions, site rules and your competent person.

## Using it

1. **Build**: type a callout such as `5x4x8 rolling`, `2@5x4x8 stat`, `5x4x8 a5` (ladder on the 5' side), `5x4x8 hatch` or `5x4x8'6"`, or tap 🎤. **H is the leg length**: a 10 ft scaffold has 10 ft legs.
2. **Builds**: one card per valid way to build it. Tick two to **compare**. Builds that need a part you've switched off are listed under "Not possible", which names the missing part.
3. **List**: tap a card.
   - Toggle the access side, deck direction, legs combo, gate and diagonal; the list updates as you go.
   - Tap a line to see why it's that many. From there you can change the qty, swap the size, add a note or remove the line.
   - Edited lines are highlighted. Your edits survive toggles, and any conflicts are flagged.
   - **Save as my version** makes that exact callout + build open with your edits next time.
4. **Load**: add towers (each with a qty) to see combined totals and a per-tower breakdown. You can then save the job, copy it as text, share it, send a share link, or print / save as PDF.
5. **Jobs**: saved loads, with date, foreman, location and status. Duplicate any past job.
6. **Parts / Rules / Settings**: edit the catalog (CSV import/export), the placement rules (with a live test panel and version history) and every setting, including the size map, deck fill, height convention and yard order.

**↶ Undo** in the header steps back through the last 20 changes. Everything is stored on the phone (IndexedDB), with no login and no server. Use **Settings → Export all** for backups; the app reminds you weekly.

## Install on your phone ("Add to Home Screen")

Open the app's web address once while you have signal. After that it works with no signal.

**iPhone (Safari)**
1. Open the link in **Safari** (not Chrome).
2. Tap **Share** (the square with the arrow).
3. Scroll down, tap **Add to Home Screen**, then **Add**.
4. Open LoadOut from the home-screen icon.

**Android (Chrome)**
1. Open the link in **Chrome**.
2. Tap **⋮** (top right) → **Add to Home screen** or **Install app** → **Install**.
3. Open LoadOut from the home-screen icon.

The mic uses the phone's speech recognition. Where it isn't available (for example, an installed iPhone app), tap the input box and use the 🎤 on the keyboard instead.

## Develop

```bash
npm install
npm run dev         # local dev server
npm run check       # typecheck + lint + unit tests
npm run test:e2e    # Playwright smoke test (builds, previews, tests offline)
npm run build       # production build in dist/ (installable PWA, works offline)
npm run report:m2   # print the checkpoint pick lists as tables
```

- `src/engine`: pure TypeScript engine, no UI dependencies. Pipeline: parser → geometry → placement rules → members → catalog parts → BOM, then variants, overrides, loads and share text.
- `src/data`: seed JSON (catalog, size map, deck fill, settings, rules), Zod schemas, CSV and backup formats. Article numbers and weights come from the official Layher Allround catalogue 2025/26; `scripts/gen-catalog.mjs` regenerates `catalog.json` from the rows exactly as copied.
- `src/db`: Dexie (IndexedDB).
- `src/ui`: React + Tailwind screens.

## Deploy

The build uses relative paths and hash routing, so `dist/` works from any static host.

- **GitHub Pages**: in the repo, go to **Settings → Pages → Source: GitHub Actions**. `.github/workflows/deploy.yml` then checks, builds and deploys every push to `main`.
- **Netlify / Vercel**: build command `npm run build`, output directory `dist`.

The old Foreman time-charge page is still served at `time-charge.html`.
