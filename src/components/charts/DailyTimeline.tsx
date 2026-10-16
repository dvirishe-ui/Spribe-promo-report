import { useState } from "react";
import { formatDay, parseDay } from "@/lib/dates";
import type { DailyPoint } from "@/lib/types";
import { PHASES, TipRow, Tooltip, linear, niceTicks, useWidth, type TipState } from "./core";

interface Window {
  start: string;
  end: string;
}

interface Props {
  daily: DailyPoint[];
  before: Window;
  during: Window;
  after: Window;
  perDay: { before: number | null; during: number | null; after: number | null };
  format: (v: number) => string;
  formatFull: (v: number) => string;
  height?: number;
}

/** Daily GGR across the three windows; the line takes each phase's color and a thin rule marks each window's daily average. */
export function DailyTimeline({ daily, before, during, after, perDay, format, formatFull, height = 280 }: Props) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [tip, setTip] = useState<TipState | null>(null);
  const [hoverI, setHoverI] = useState<number | null>(null);

  const pts = daily.filter((p) => p.date >= before.start && p.date <= after.end);
  if (pts.length < 2) return null;

  const m = { top: 30, right: 12, bottom: 26, left: 52 };
  const t0 = parseDay(before.start);
  const t1 = parseDay(after.end);
  const x = linear(t0, t1, m.left, width - m.right);
  const ticks = niceTicks(0, Math.max(...pts.map((p) => p.ggr)) * 1.08, 4);
  const y = linear(0, ticks[ticks.length - 1], height - m.bottom, m.top);
  const dayW = (width - m.left - m.right) / Math.max(1, (t1 - t0) / 86_400_000);

  const windows = [before, during, after];
  const phaseOf = (d: string) => (d < during.start ? 0 : d <= during.end ? 1 : 2);

  // Split the line into phase-colored runs that share their joining point.
  const runs: Array<{ phase: number; d: string }> = [];
  let cur: { phase: number; pts: string[] } | null = null;
  pts.forEach((p, i) => {
    const ph = phaseOf(p.date);
    const xy = `${x(parseDay(p.date))},${y(p.ggr)}`;
    if (!cur || cur.phase !== ph) {
      if (cur) runs.push({ phase: cur.phase, d: `M${cur.pts.join("L")}` });
      const prev = i > 0 ? `${x(parseDay(pts[i - 1].date))},${y(pts[i - 1].ggr)}` : null;
      cur = { phase: ph, pts: prev ? [prev, xy] : [xy] };
    } else cur.pts.push(xy);
  });
  if (cur) runs.push({ phase: (cur as { phase: number }).phase, d: `M${(cur as { pts: string[] }).pts.join("L")}` });

  const avg = [perDay.before, perDay.during, perDay.after];
  const hp = hoverI != null ? pts[hoverI] : null;

  return (
    <div ref={ref} className="relative">
      <svg
        width={width}
        height={height}
        className="block overflow-visible"
        role="img"
        aria-label="Daily GGR before, during and after the promo"
        onMouseLeave={() => (setTip(null), setHoverI(null))}
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const px = e.clientX - r.left;
          let best = 0;
          pts.forEach((p, i) => {
            if (Math.abs(x(parseDay(p.date)) - px) < Math.abs(x(parseDay(pts[best].date)) - px)) best = i;
          });
          const p = pts[best];
          const ph = PHASES[phaseOf(p.date)];
          setHoverI(best);
          setTip({
            x: x(parseDay(p.date)),
            y: y(p.ggr),
            content: (
              <>
                <p className="mb-1 font-semibold text-foreground">{formatDay(p.date, true)}</p>
                <TipRow color={ph.color} label={`${ph.label} the promo`} value={formatFull(p.ggr)} strong />
                {avg[phaseOf(p.date)] != null && (
                  <TipRow label={`${ph.label} avg / day`} value={formatFull(avg[phaseOf(p.date)] as number)} />
                )}
              </>
            ),
          });
        }}
      >
        {windows.map((w, i) => {
          const xa = x(parseDay(w.start)) - dayW / 2;
          const xb = x(parseDay(w.end)) + dayW / 2;
          return (
            <g key={i}>
              <rect
                x={Math.max(m.left, xa)}
                y={m.top - 22}
                width={Math.max(0, Math.min(width - m.right, xb) - Math.max(m.left, xa))}
                height={height - m.bottom - m.top + 22}
                fill={PHASES[i].color}
                opacity={i === 1 ? 0.1 : 0.05}
                rx={6}
              />
              <circle cx={Math.max(m.left, xa) + 12} cy={m.top - 10} r={3.5} fill={PHASES[i].color} />
              <text x={Math.max(m.left, xa) + 20} y={m.top - 10} dy="0.32em" fontSize={11} className="fill-foreground font-medium">
                {PHASES[i].label}
              </text>
            </g>
          );
        })}
        {ticks.map((t) => (
          <g key={t}>
            <line x1={m.left} x2={width - m.right} y1={y(t)} y2={y(t)} stroke={t === 0 ? "var(--viz-axis)" : "var(--viz-grid)"} />
            <text x={m.left - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} className="fill-muted-foreground tabular">
              {format(t)}
            </text>
          </g>
        ))}
        {windows.map((w, i) =>
          avg[i] != null ? (
            <line
              key={`avg-${i}`}
              x1={x(parseDay(w.start))}
              x2={x(parseDay(w.end))}
              y1={y(avg[i] as number)}
              y2={y(avg[i] as number)}
              stroke={PHASES[i].color}
              strokeWidth={1.5}
              opacity={0.7}
            />
          ) : null,
        )}
        {runs.map((r, i) => (
          <path key={i} d={r.d} fill="none" stroke={PHASES[r.phase].color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        ))}
        {[before.start, during.start, after.start, after.end].map((d, i) => (
          <text
            key={d + i}
            x={x(parseDay(d))}
            y={height - 8}
            textAnchor={i === 3 ? "end" : i === 0 ? "start" : "middle"}
            fontSize={11}
            className="fill-muted-foreground"
          >
            {formatDay(d)}
          </text>
        ))}
        {hp && (
          <>
            <line x1={x(parseDay(hp.date))} x2={x(parseDay(hp.date))} y1={m.top} y2={height - m.bottom} stroke="var(--viz-axis)" />
            <circle
              cx={x(parseDay(hp.date))}
              cy={y(hp.ggr)}
              r={5}
              fill={PHASES[phaseOf(hp.date)].color}
              stroke="var(--viz-surface)"
              strokeWidth={2}
            />
          </>
        )}
      </svg>
      <Tooltip tip={tip} width={width} />
    </div>
  );
}
