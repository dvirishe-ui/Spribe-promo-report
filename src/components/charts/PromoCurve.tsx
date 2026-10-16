import { useState } from "react";
import { pct } from "@/lib/format";
import { Legend, PHASES, TipRow, Tooltip, linear, niceTicks, useWidth, type TipState } from "./core";

export interface CurveLine {
  key: string;
  label: string;
  sub?: string;
  index: { before: number; during: number | null; after: number | null };
}

interface Props {
  lines: CurveLine[];
  average: { before: number; during: number | null; after: number | null } | null;
  height?: number;
  onSelect?: (key: string) => void;
}

/**
 * The signature chart: every promo indexed to its own "before" run-rate (=100),
 * then where GGR went during the promo and after it ended. Individual promos are
 * thin muted lines; the baseline-weighted average is the bold line.
 */
export function PromoCurve({ lines, average, height = 300, onSelect }: Props) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [tip, setTip] = useState<TipState | null>(null);
  const [hover, setHover] = useState<string | null>(null);

  const m = { top: 30, right: 64, bottom: 16, left: 44 };
  const innerW = Math.max(10, width - m.left - m.right);
  const xs = [m.left + innerW * 0.08, m.left + innerW * 0.5, m.left + innerW * 0.92];

  const values = lines.flatMap((l) => [l.index.before, l.index.during, l.index.after]).filter((v): v is number => v != null);
  const ticks = niceTicks(Math.min(90, ...values), Math.max(115, ...values), 5);
  const y = linear(ticks[0], ticks[ticks.length - 1], height - m.bottom, m.top);

  const pts = (idx: CurveLine["index"]) =>
    [idx.before, idx.during, idx.after].map((v, i) => (v == null ? null : ([xs[i], y(v)] as const)));

  const pathOf = (idx: CurveLine["index"]) => {
    const p = pts(idx);
    let d = "";
    let pen = false;
    for (const pt of p) {
      if (!pt) {
        pen = false;
        continue;
      }
      d += `${pen ? "L" : "M"}${pt[0]},${pt[1]}`;
      pen = true;
    }
    return d;
  };

  const lineYAt = (idx: CurveLine["index"], px: number) => {
      const p = pts(idx);
      for (let i = 0; i < 2; i++) {
        const a = p[i];
        const b = p[i + 1];
        if (a && b && px >= a[0] && px <= b[0]) return a[1] + ((px - a[0]) / (b[0] - a[0])) * (b[1] - a[1]);
      }
      const nearest = p.reduce<readonly [number, number] | null>(
        (best, pt) => (pt && (!best || Math.abs(pt[0] - px) < Math.abs(best[0] - px)) ? pt : best),
        null,
      );
      return nearest ? nearest[1] : null;
  };

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - r.left;
    const py = e.clientY - r.top;
    let best: CurveLine | null = null;
    let bestD = 14;
    for (const l of lines) {
      const ly = lineYAt(l.index, px);
      if (ly != null && Math.abs(ly - py) < bestD) {
        bestD = Math.abs(ly - py);
        best = l;
      }
    }
    if (!best) {
      setHover(null);
      setTip(null);
      return;
    }
    setHover(best.key);
    const b = best;
    setTip({
      x: px,
      y: py,
      content: (
        <>
          <p className="font-semibold text-foreground">{b.label}</p>
          {b.sub && <p className="mb-1 text-muted-foreground">{b.sub}</p>}
          <TipRow color={PHASES[0].color} label="Before" value="100" />
          <TipRow
            color={PHASES[1].color}
            label="During"
            value={b.index.during == null ? "—" : `${b.index.during.toFixed(0)} (${pct(b.index.during / 100 - 1)})`}
          />
          <TipRow
            color={PHASES[2].color}
            label="After"
            value={b.index.after == null ? "—" : `${b.index.after.toFixed(0)} (${pct(b.index.after / 100 - 1)})`}
          />
          {onSelect && <p className="mt-1 text-[11px] text-primary">Click to open the report</p>}
        </>
      ),
    });
  };

  const avgPts = average ? pts(average) : [];

  return (
    <div>
      <Legend
        className="mb-3"
        items={[
          { label: "Average (weighted by baseline GGR)", color: "var(--color-foreground)", shape: "line" },
          { label: "Each promo", color: "var(--color-muted-foreground)", shape: "line" },
        ]}
      />
      <div ref={ref} className="relative">
        <svg
          width={width}
          height={height}
          className={`block overflow-visible ${hover && onSelect ? "cursor-pointer" : ""}`}
          role="img"
          aria-label="GGR indexed to the before period, per promo and on average"
          onMouseMove={onMove}
          onMouseLeave={() => (setTip(null), setHover(null))}
          onClick={() => hover && onSelect?.(hover)}
        >
          {/* phase columns */}
          {PHASES.map((p, i) => (
            <g key={p.key}>
              <line x1={xs[i]} x2={xs[i]} y1={m.top - 6} y2={height - m.bottom} stroke="var(--viz-axis)" strokeWidth={1} />
              <circle cx={xs[i] - 30} cy={12} r={4} fill={p.color} />
              <text x={xs[i] - 22} y={12} dy="0.32em" fontSize={11.5} className="fill-foreground font-medium">
                {p.label}
              </text>
            </g>
          ))}
          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={m.left}
                x2={width - m.right}
                y1={y(t)}
                y2={y(t)}
                stroke={t === 100 ? "var(--viz-axis)" : "var(--viz-grid)"}
                strokeWidth={1}
              />
              <text x={m.left - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} className="fill-muted-foreground tabular">
                {t}
              </text>
            </g>
          ))}
          {/* individual promos */}
          {lines.map((l) => (
            <path
              key={l.key}
              d={pathOf(l.index)}
              fill="none"
              stroke={hover === l.key ? "var(--series-during)" : "var(--color-muted-foreground)"}
              strokeOpacity={hover === l.key ? 1 : hover ? 0.15 : 0.35}
              strokeWidth={hover === l.key ? 2.5 : 1.25}
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ transition: "stroke-opacity 120ms" }}
            />
          ))}
          {/* average */}
          {average && (
            <>
              <path
                d={pathOf(average)}
                fill="none"
                stroke="var(--color-foreground)"
                strokeWidth={3}
                strokeLinecap="round"
                strokeLinejoin="round"
                pathLength={1000}
                className="animate-draw"
                opacity={hover ? 0.35 : 1}
              />
              {avgPts.map((pt, i) =>
                pt ? (
                  <g key={i} opacity={hover ? 0.35 : 1}>
                    <circle cx={pt[0]} cy={pt[1]} r={6.5} fill={PHASES[i].color} stroke="var(--viz-surface)" strokeWidth={2.5} />
                    {i > 0 && (
                      <text
                        x={pt[0] + (i === 2 ? 12 : 0)}
                        y={pt[1] + (i === 2 ? 0 : -14)}
                        dy={i === 2 ? "0.32em" : 0}
                        textAnchor={i === 2 ? "start" : "middle"}
                        fontSize={12.5}
                        className="fill-foreground font-semibold tabular"
                      >
                        {pct((i === 1 ? average.during! : average.after!) / 100 - 1)}
                      </text>
                    )}
                  </g>
                ) : null,
              )}
            </>
          )}
        </svg>
        <Tooltip tip={tip} width={width} />
      </div>
    </div>
  );
}
