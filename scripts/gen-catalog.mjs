// One-off generator for src/data/catalog.json from the official Layher Allround catalogue.
// Source: Layher Allround Catalogus & Prijslijst 2025/2026 (NL/FR, DOC0228), hosted by Layher.
// Run: node scripts/gen-catalog.mjs src/data/catalog.json
import { writeFileSync } from 'node:fs';

const DOC = 'https://layher-content-prod.s3.eu-central-1.amazonaws.com/s3fs-public/2025-04/Layher-allround-catalogus-prijslijst-doc0228.pdf';
const src = (page) => `${DOC}#page=${page}`;
const LEN = [0.73, 1.09, 1.4, 1.57, 2.07, 2.57, 3.07];
const f = (n) => n.toFixed(2);

const part = (o) => ({
  id: o.id, name: o.name, category: o.category, size: o.size ?? null, size2: o.size2 ?? null,
  nominal: o.nominal ?? null, articleNo: o.art ?? null, weightKg: o.kg ?? null, yardLocation: '',
  companions: o.companions ?? [], replacesDecks: o.replacesDecks ?? null,
  active: o.active ?? true, verify: o.verify ?? !o.art, source: o.page ? src(o.page) : null, notes: o.notes ?? '',
});
// [length, article, kg, stock] rows copied from the catalogue (W = stock item, P = on request).
const rows = (list) => list.map(([size, art, kg, st]) => ({ size, art, kg, st }));
const stock = (st) => (st === 'P' ? 'Layher: on request.' : 'Layher: stock item.');
const out = [];

// p5 — base jacks and collars
out.push(part({ id: 'castor', name: 'Swivel castor ø200 1000 kg', category: 'castor', art: '1260.201', kg: 6.3, page: 69, verify: true,
  notes: 'Layher: stock item. VERIFY which castor the yard uses: the alternative is 1267.200 "Swivel castor with half coupler 1200 kg ø200, spindle range 0.30–0.60 m" (12.0 kg). Brake not stated in the catalogue.' }));
out.push(part({ id: 'base-jack', name: 'Base plate spindle 0.60', category: 'baseJack', art: '4001.060', kg: 3.6, page: 5, verify: true,
  notes: 'Layher: stock item. VERIFY length used: 0.40 = 4001.040 (2.9 kg); reinforced 0.80 = 4002.080 (4.9 kg).' }));
out.push(part({ id: 'base-collar', name: 'Base collar', category: 'baseCollar', art: '2602.000', kg: 1.4, page: 5, notes: 'Layher: stock item. Tower collar (extended) = 2660.000, 2.2 kg.' }));

// Yard names for legs: nearest whole foot ("a 10 ft scaffold has a 10 ft leg" = 3.0 m).
const LEG_NAMES = { 0.5: "2'", 1.0: "3'", 1.5: "5'", 2.0: "7'", 2.5: "8'", 3.0: "10'", 4.0: "13'" };

// p7 — standards with spigot, 50 cm rosette spacing, LW
for (const r of rows([[0.5, '2617.050', 2.7], [1.0, '2617.100', 5.0], [1.5, '2617.150', 7.1], [2.0, '2617.200', 9.6], [2.5, '2617.250', 11.3], [3.0, '2617.300', 13.6], [4.0, '2617.400', 17.8]]))
  out.push(part({ id: `standard-${r.size.toFixed(1)}`, name: 'Standard', category: 'standard', size: r.size, nominal: LEG_NAMES[r.size], art: r.art, kg: r.kg, page: 7,
    notes: 'Standard with spigot, 50 cm rosette spacing, LW. Layher: stock item. Yard name = nearest foot (a 10 ft leg = 3.0 m).' }));

// p11 — ledgers LW
for (const r of rows([[0.73, '2601.073', 2.9], [1.09, '2601.109', 4.0], [1.4, '2601.140', 5.0], [1.57, '2601.157', 5.5], [2.07, '2601.207', 7.0], [2.57, '2601.257', 8.7], [3.07, '2601.307', 10.1]]))
  out.push(part({ id: `ledger-${f(r.size)}`, name: 'Ledger', category: 'ledger', size: r.size, art: r.art, kg: r.kg, page: 11, notes: 'Ledger LW. Layher: stock item.' }));

// p13 — U-ledgers LW (0.73/1.09) and U-ledgers LW reinforced (1.40+)
for (const r of rows([[0.73, '2618.073', 3.1, 'W'], [1.09, '2618.109', 4.4, 'W'], [1.4, '2618.140', 8.9, 'W'], [1.57, '2618.157', 9.4, 'W'], [2.07, '2618.207', 12.7, 'W'], [2.57, '2618.257', 15.4, 'W'], [3.07, '2618.307', 18.0, 'W']])) {
  const reinforced = r.size >= 1.4;
  out.push(part({ id: `uledger-${f(r.size)}`, name: reinforced ? 'U-ledger reinf.' : 'U-ledger', category: 'uLedger', size: r.size, art: r.art, kg: r.kg, page: 13,
    notes: `${reinforced ? 'U-ledger LW, reinforced.' : 'U-ledger LW.'} ${stock(r.st)}${r.size === 1.4 ? ' Non-reinforced 1.40 = 2618.139 (5.4 kg, on request).' : ''}` }));
}

// p17 — horizontal diagonals with wedge heads, LW: only these bay combos are listed.
const hd = [
  // square bays
  [0.73, 0.73, '0729.789', 4.1, 'W', ''], [1.09, 1.09, '2678.109', 5.5, 'P', ''], [1.4, 1.4, '0703.716', 7.6, 'P', ''], [1.57, 1.57, '2678.157', 7.7, 'P', ''],
  [2.07, 2.07, '2678.207', 10.0, 'W', ''], [2.57, 2.57, '2678.257', 12.2, 'W', ''], [3.07, 3.07, '2678.307', 14.5, 'P', ''],
  // left
  [2.07, 0.73, '2678.208', 7.8, 'W', 'left'], [2.07, 1.09, '0702.268', 8.4, 'W', 'left'], [2.07, 1.4, '0713.516', 10.1, 'P', 'left'], [2.07, 1.57, '2678.205', 9.2, 'P', 'left'],
  [2.57, 1.4, '0700.804', 10.8, 'W', 'left'], [2.57, 2.07, '0700.807', 11.5, 'W', 'left'], [3.07, 1.09, '0706.428', 11.7, 'P', 'left'], [3.07, 1.57, '2678.310', 11.7, 'P', 'left'],
  [3.07, 2.07, '0701.174', 12.9, 'P', 'left'], [3.07, 2.57, '0701.175', 15.0, 'P', 'left'],
  // right
  [2.07, 1.09, '2678.209', 8.1, 'W', 'right'], [2.07, 1.4, '0703.719', 8.9, 'P', 'right'], [2.57, 1.09, '2678.259', 9.6, 'W', 'right'], [2.57, 1.4, '0709.609', 10.8, 'W', 'right'],
  [2.57, 1.57, '2678.256', 10.3, 'P', 'right'], [2.57, 2.07, '2678.255', 11.2, 'P', 'right'], [3.07, 1.4, '0703.718', 11.8, 'P', 'right'],
];
const listed = new Set();
for (const [a, b, art, kg, st, hand] of hd) {
  const key = `${f(a)}x${f(b)}`;
  const id = listed.has(key) ? `hdiag-${key}-${hand}` : `hdiag-${key}`;
  listed.add(key);
  out.push(part({ id, name: hand ? `H-diagonal (${hand})` : 'H-diagonal', category: 'hDiagonal', size: a, size2: b, art, kg, page: 17, notes: `Horizontal diagonal LW with wedge heads. ${stock(st)}` }));
}
for (let i = 0; i < LEN.length; i++)
  for (let j = 0; j <= i; j++) {
    const key = `${f(LEN[i])}x${f(LEN[j])}`;
    if (listed.has(key)) continue;
    out.push(part({ id: `hdiag-${key}`, name: 'H-diagonal', category: 'hDiagonal', size: LEN[i], size2: LEN[j], verify: true,
      notes: 'NOT in the Layher Allround catalogue 2025/26 (p17 lists only square bays and some long×short combos). VERIFY this exists in the yard or deactivate it.' }));
  }

// p15 — vertical diagonals LW for bay height 2.00 m
for (const r of rows([[0.73, '2683.073', 7.1], [1.09, '2683.109', 7.4], [1.4, '2683.140', 7.9], [1.57, '2683.157', 8.2], [2.07, '2683.207', 8.9], [2.57, '2683.257', 10.0], [3.07, '2683.307', 11.1]]))
  out.push(part({ id: `vdiag-${f(r.size)}`, name: 'V-diagonal', category: 'vDiagonal', size: r.size, art: r.art, kg: r.kg, page: 15, notes: 'Diagonal brace LW, bay height 2.00 m. Layher: stock item.' }));

// p23 — steel decks, U-application
for (const r of rows([[0.73, '3883.073', 5.6], [1.09, '3883.109', 7.7], [1.4, '3883.140', 9.3], [1.57, '3883.157', 10.5], [2.07, '3883.207', 13.4], [2.57, '3883.257', 16.4], [3.07, '3883.307', 19.3]]))
  out.push(part({ id: `deck-0.32x${f(r.size)}`, name: 'Deck', category: 'deck', size: r.size, size2: 0.32, art: r.art, kg: r.kg, page: 23, active: r.size !== 1.4,
    notes: `Steel LW deck, U-application, 0.32 wide. Layher: stock item.${r.size === 1.4 ? ' Off until you confirm the yard stocks it.' : ''}` }));
for (const r of rows([[0.73, '3801.073', 5.1], [1.09, '3801.109', 6.4], [1.4, '3801.140', 8.0], [1.57, '3801.157', 8.5], [2.07, '3801.207', 10.2], [2.57, '3801.257', 13.2], [3.07, '3801.307', 15.3]]))
  out.push(part({ id: `deck-0.19x${f(r.size)}`, name: 'Narrow deck', category: 'deck', size: r.size, size2: 0.19, art: r.art, kg: r.kg, page: 23, active: false,
    notes: 'Steel deck, U-application, 0.19 wide. Layher: stock item. Off until you confirm the yard stocks it.' }));

// p25 — access decks aluminium with hatch, U-application, 0.61 wide (no 0.73/1.09/1.40 in U-application)
for (const r of rows([[1.57, '3851.157', 15.1, 'P'], [2.07, '3851.207', 17.0, 'W'], [2.57, '3851.257', 20.0, 'W'], [3.07, '3851.307', 24.5, 'W']]))
  out.push(part({ id: `accessdeck-${f(r.size)}`, name: 'Hatch deck', category: 'accessDeck', size: r.size, size2: 0.61, art: r.art, kg: r.kg, page: 25, replacesDecks: 2, active: false,
    notes: `Access deck aluminium, U-application, 0.61 wide. ${stock(r.st)} Off until you confirm the yard stocks it. replacesDecks = 2 × 0.32 (VERIFY). Versions with integrated 2.00 m ladder exist for 2.57/3.07 (3852.257/.307).` }));

// p27 — lift-off preventers (U) and access ladders (for hatch decks)
for (const r of rows([[0.73, '2635.073', 1.3], [1.09, '2635.109', 1.8], [1.4, '2658.140', 4.7], [1.57, '2658.157', 5.9], [2.07, '2658.207', 7.9], [2.57, '2658.257', 9.9]]))
  out.push(part({ id: `liftoff-${f(r.size)}`, name: 'Lift-off preventer', category: 'liftOff', size: r.size, art: r.art, kg: r.kg, page: 27,
    notes: 'Lift-off preventer for U-decks. Layher: stock item. No 3.07 listed; universal U-lift-off preventer 2635.001 (0.28, 1.0 kg) is the alternative.' }));
out.push(part({ id: 'accessladder-2.00', name: 'Access ladder', category: 'accessLadder', size: 2.0, nominal: '2.15 m, for 2.0 m lift', art: '4009.007', kg: 7.6, page: 27, notes: 'Access ladder 2.15 m for a 2.00 m lift (hatch decks). Layher: stock item. Size = lift height it serves.' }));
out.push(part({ id: 'accessladder-2.16', name: 'Access ladder', category: 'accessLadder', size: 2.16, nominal: '2.40 m, for 2.16 m lift', art: '0731.036', kg: 8.5, page: 27, notes: 'Layher: stock item.' }));
out.push(part({ id: 'accessladder-2.80', name: 'Access ladder', category: 'accessLadder', size: 2.8, nominal: '2.95 m, for 2.80 m lift', art: '4005.010', kg: 11.3, page: 27, notes: 'Layher: stock item.' }));

// p33 — toe boards, wood, U-application
for (const r of rows([[0.73, '2640.073', 1.5], [1.09, '2640.109', 2.5], [1.4, '2640.140', 3.5], [1.57, '2640.157', 3.5], [2.07, '2640.207', 4.6], [2.57, '2640.257', 5.7], [3.07, '2640.307', 7.1]]))
  out.push(part({ id: `toeboard-${f(r.size)}`, name: 'Toe board', category: 'toeBoard', size: r.size, art: r.art, kg: r.kg, page: 33, notes: 'U-toe board, wood. Layher: stock item.' }));

// p57 — swing gate (only 0.73 in system lengths), scaffold ladders and ladder fixing
out.push(part({ id: 'gate-0.73', name: 'Swing gate', category: 'gate', size: 0.73, art: '2627.073', kg: 8.8, page: 57,
  notes: 'Swinging door with aluminium toe board, 0.73 wide × 1.00 high. Layher: stock item. The catalogue lists no gate for wider bays (only 1.00 metric = 2627.100, 10.5 kg).' }));
out.push(part({ id: 'chain', name: 'Safety chain (generic)', category: 'chain', notes: 'Not a Layher catalogue item. VERIFY.' }));
for (const r of rows([[2.0, '1002.008', 15.0], [3.0, '1002.012', 21.5], [4.0, '1002.016', 28.0]]))
  out.push(part({ id: `ladder-${r.size.toFixed(1)}`, name: 'Scaffold ladder, steel', category: 'ladder', size: r.size, art: r.art, kg: r.kg, page: 57, verify: true,
    companions: [{ partId: 'ladder-fixing', qty: 1 }], notes: 'Layher: stock item. VERIFY steel vs aluminium (2.90 = 1004.010, 8.2 kg; 4.00 = 1004.014, 11.3 kg).' }));
for (const r of rows([[2.9, '1004.010', 8.2], [4.0, '1004.014', 11.3]]))
  out.push(part({ id: `ladder-alu-${r.size.toFixed(1)}`, name: 'Scaffold ladder, alu', category: 'ladder', size: r.size, art: r.art, kg: r.kg, page: 57, active: false,
    companions: [{ partId: 'ladder-fixing', qty: 1 }], notes: 'Layher: stock item. Off — turn on if the yard uses aluminium ladders.' }));
out.push(part({ id: 'ladder-fixing', name: 'Ladder fixing device', category: 'ladderHook', art: '0718.846', kg: 6.1, page: 57, verify: true,
  notes: 'Fixing device for scaffold ladder (bent, with half couplers), 0.715 m. Layher: stock item. VERIFY how many per ladder (seeded 1).' }));
out.push(part({ id: 'stabilizer', name: 'Stabilizer (generic)', category: 'stabilizer', notes: 'Not in the Layher Allround catalogue 2025/26. VERIFY what the yard uses.' }));

writeFileSync(process.argv[2], JSON.stringify(out, null, 2) + '\n');
console.log(out.length, 'parts;', out.filter((p) => p.articleNo).length, 'with Layher article numbers');
