// Plan + elevation drawn from the variant's member list (the same members that make the BOM).
import { formatFtIn, formatM, nominalFor, splitLabel, type Edge, type SizeMapEntry, type VariantResult } from '../../engine';

const U = 100; // svg units per metre

export function TowerSvg(props: { variant: VariantResult; sizeMap: SizeMapEntry[]; tol: number }) {
  return (
    <div className="mt-3 grid gap-3 rounded-2xl border-2 border-neutral-400 bg-white p-2 text-black sm:grid-cols-2">
      <Plan {...props} />
      <Elevation {...props} />
    </div>
  );
}

function axisPositions(bays: number[]): number[] {
  const out = [0];
  for (const b of bays) out.push(out[out.length - 1]! + b);
  return out;
}

function Plan({ variant, sizeMap, tol }: { variant: VariantResult; sizeMap: SizeMapEntry[]; tol: number }) {
  const t = variant.tower;
  const xs = axisPositions(t.splitL.bays);
  const ys = axisPositions(t.splitW.bays);
  const pad = 0.55;
  const w = t.totalL + pad * 2;
  const h = t.totalW + pad * 2;
  const X = (m: number) => (m + pad) * U;
  const Y = (m: number) => (m + pad) * U;
  const span = t.options.spanAxis;
  const edgeLine = (e: Edge) =>
    e.axis === 'L'
      ? { x1: X(xs[e.i]!), y1: Y(ys[e.j]!), x2: X(xs[e.i + 1]!), y2: Y(ys[e.j]!) }
      : { x1: X(xs[e.i]!), y1: Y(ys[e.j]!), x2: X(xs[e.i]!), y2: Y(ys[e.j + 1]!) };
  const accessEdge = t.edges.find((e) => e.id === t.accessEdgeId);
  const hatchBay = t.options.accessType === 'hatch' ? t.bays.find((b) => b.id === t.accessBayId) : undefined;
  return (
    <figure>
      <figcaption className="text-center text-sm font-bold">Plan</figcaption>
      <svg viewBox={`0 0 ${w * U} ${h * U}`} className="h-auto w-full" role="img" aria-label="Plan view">
        {t.bays.map((b) => {
          const x0 = xs[b.i]!;
          const y0 = ys[b.j]!;
          const lines = [];
          const across = span === 'L' ? b.lenW : b.lenL;
          const n = Math.max(1, Math.floor(across / 0.32));
          for (let k = 1; k < n + 1; k++) {
            const f = (k / (n + 1)) * across;
            lines.push(
              span === 'L' ? (
                <line key={k} x1={X(x0)} y1={Y(y0 + f)} x2={X(x0 + b.lenL)} y2={Y(y0 + f)} stroke="#a3a3a3" strokeWidth={3} />
              ) : (
                <line key={k} x1={X(x0 + f)} y1={Y(y0)} x2={X(x0 + f)} y2={Y(y0 + b.lenW)} stroke="#a3a3a3" strokeWidth={3} />
              ),
            );
          }
          return (
            <g key={b.id}>
              <rect x={X(x0)} y={Y(y0)} width={b.lenL * U} height={b.lenW * U} fill="#fef9c3" />
              {lines}
            </g>
          );
        })}
        {hatchBay && (
          <text x={X(xs[hatchBay.i]! + hatchBay.lenL / 2)} y={Y(ys[hatchBay.j]! + hatchBay.lenW / 2)} fontSize={22} textAnchor="middle" fontWeight={700} fill="#b91c1c">
            HATCH
          </text>
        )}
        {t.edges.map((e) => (
          <line key={e.id} {...edgeLine(e)} stroke="#0a0a0a" strokeWidth={e.perimeter ? 6 : 3} />
        ))}
        {accessEdge && <line {...edgeLine(accessEdge)} stroke="#dc2626" strokeWidth={14} strokeLinecap="round" />}
        {t.positions.map((p) => (
          <circle key={p.id} cx={X(p.x)} cy={Y(p.y)} r={10} fill="#0a0a0a" />
        ))}
        <text x={X(t.totalL / 2)} y={Y(t.totalW) + 40} fontSize={24} textAnchor="middle" fontWeight={700}>
          {splitLabel(t.splitL)} ({formatM(t.totalL)})
        </text>
        <text
          x={X(t.totalL) + 40}
          y={Y(t.totalW / 2)}
          fontSize={24}
          textAnchor="middle"
          fontWeight={700}
          transform={`rotate(90 ${X(t.totalL) + 40} ${Y(t.totalW / 2)})`}
        >
          {splitLabel(t.splitW)} ({formatM(t.totalW)})
        </text>
        {accessEdge && (
          <text x={X(xs[accessEdge.i]!) + 6} y={Y(ys[accessEdge.j]!) - 18} fontSize={22} fontWeight={700} fill="#dc2626">
            LADDER
          </text>
        )}
      </svg>
      <p className="text-center text-xs">
        Decks run {span === 'L' ? splitLabel(t.splitL) : splitLabel(t.splitW)} way · {nominalFor(t.splitL.bays[0]!, sizeMap, tol)} × {nominalFor(t.splitW.bays[0]!, sizeMap, tol)} bays
      </p>
    </figure>
  );
}

function Elevation({ variant }: { variant: VariantResult }) {
  const t = variant.tower;
  const lv = t.levels;
  const face = t.accessFace ?? 'L0';
  const alongL = face.startsWith('L');
  const bays = alongL ? t.splitL.bays : t.splitW.bays;
  const xs = axisPositions(bays);
  const faceEdges = t.edges.filter((e) => e.face === face);
  const edgeX = (id: string): [number, number] | null => {
    const e = faceEdges.find((x) => x.id === id);
    if (!e) return null;
    const i = alongL ? e.i : e.j;
    return [xs[i]!, xs[i + 1]!];
  };
  const combo = variant.standardsCombos[Math.min(t.options.standardsComboIndex, variant.standardsCombos.length - 1)];
  const top = lv.baseOffset + (combo?.total ?? lv.topRail * lv.pitch);
  const padL = 0.25;
  const padR = 2.45;
  const padT = 0.3;
  const W = xs[xs.length - 1]! + padL + padR;
  const H = top + padT + 0.15;
  const X = (m: number) => (m + padL) * U;
  const Y = (m: number) => (H - m - 0.1) * U;
  const onFace = variant.members.filter((m) => m.qty > 0 && faceEdges.some((e) => e.id === m.elementId));
  const ledgerish = onFace.filter((m) => ['ledger', 'uLedger'].includes(m.category));
  const diag = onFace.filter((m) => m.category === 'vDiagonal');
  const gates = onFace.filter((m) => m.category === 'gate' || m.category === 'chain');
  const ladder = onFace.some((m) => m.category === 'ladder');
  const labels: [number, string][] = [
    [top, `Legs top ${formatFtIn(top)}`],
    [t.topRailHeight, `Top rail ${formatFtIn(t.topRailHeight)}`],
    [t.deckHeight, `Deck ${formatFtIn(t.deckHeight)}`],
    [lv.baseOffset, `Base ${formatFtIn(lv.baseOffset)}`],
  ];
  // Keep labels from overlapping.
  const placed: [number, string][] = [];
  for (const [y, s] of labels) {
    const last = placed[placed.length - 1];
    placed.push([last && last[0] - y < 0.28 ? last[0] - 0.28 : y, s]);
  }
  return (
    <figure>
      <figcaption className="text-center text-sm font-bold">
        Elevation · {alongL ? splitLabel(t.splitL) : splitLabel(t.splitW)} side{t.accessFace ? ' (ladder face)' : ''}
      </figcaption>
      <svg viewBox={`0 0 ${W * U} ${H * U}`} className="h-auto w-full" role="img" aria-label="Elevation view">
        <line x1={0} y1={Y(0)} x2={W * U} y2={Y(0)} stroke="#78716c" strokeWidth={6} />
        {xs.map((x, i) => (
          <g key={i}>
            {t.type === 'rolling' ? (
              <circle cx={X(x)} cy={Y(0.1)} r={10} fill="#0a0a0a" />
            ) : (
              <rect x={X(x) - 16} y={Y(0.02)} width={32} height={6} fill="#0a0a0a" />
            )}
            <line x1={X(x)} y1={Y(0.15)} x2={X(x)} y2={Y(lv.baseOffset)} stroke="#525252" strokeWidth={5} />
            <line x1={X(x)} y1={Y(lv.baseOffset)} x2={X(x)} y2={Y(top)} stroke="#0a0a0a" strokeWidth={7} />
          </g>
        ))}
        {ledgerish.map((m) => {
          const ex = edgeX(m.elementId);
          if (!ex) return null;
          const y = Y(lv.heightOf(m.level));
          return <line key={m.id} x1={X(ex[0])} y1={y} x2={X(ex[1])} y2={y} stroke="#0a0a0a" strokeWidth={5} />;
        })}
        {diag.map((m) => {
          const ex = edgeX(m.elementId);
          const lift = lv.lifts.find((l) => l.from === m.level);
          if (!ex || !lift) return null;
          return (
            <line key={m.id} x1={X(ex[0])} y1={Y(lv.heightOf(lift.from))} x2={X(ex[1])} y2={Y(lv.heightOf(lift.to))} stroke="#2563eb" strokeWidth={5} />
          );
        })}
        {gates.map((m) => {
          const ex = edgeX(m.elementId);
          if (!ex) return null;
          return (
            <rect
              key={m.id}
              x={X(ex[0]) + 8}
              y={Y(t.topRailHeight)}
              width={(ex[1] - ex[0]) * U - 16}
              height={(t.topRailHeight - t.deckHeight) * U}
              fill="none"
              stroke="#16a34a"
              strokeWidth={5}
              strokeDasharray="14 8"
            />
          );
        })}
        <rect x={X(0)} y={Y(t.deckHeight)} width={(xs[xs.length - 1]!) * U} height={10} fill="#ca8a04" />
        <rect x={X(0)} y={Y(t.deckHeight + 0.15)} width={(xs[xs.length - 1]!) * U} height={0.15 * U} fill="none" stroke="#ca8a04" strokeWidth={3} />
        {ladder && (
          <g stroke="#dc2626" strokeWidth={5}>
            <line x1={X(xs[0]! + 0.2)} y1={Y(lv.baseOffset)} x2={X(xs[0]! + 0.2)} y2={Y(t.deckHeight + 0.9)} />
            <line x1={X(xs[0]! + 0.6)} y1={Y(lv.baseOffset)} x2={X(xs[0]! + 0.6)} y2={Y(t.deckHeight + 0.9)} />
            {Array.from({ length: Math.floor((t.deckHeight + 0.9 - lv.baseOffset) / 0.28) }, (_, k) => (
              <line key={k} x1={X(xs[0]! + 0.2)} x2={X(xs[0]! + 0.6)} y1={Y(lv.baseOffset + 0.28 * (k + 1))} y2={Y(lv.baseOffset + 0.28 * (k + 1))} />
            ))}
          </g>
        )}
        {placed.map(([y, s]) => (
          <text key={s} x={X(xs[xs.length - 1]!) + 20} y={Y(y) + 8} fontSize={24} fontWeight={700}>
            {s}
          </text>
        ))}
      </svg>
      <p className="text-center text-xs">Blue = diagonals · gold = deck + toe boards · red = ladder · green dash = gate</p>
    </figure>
  );
}
