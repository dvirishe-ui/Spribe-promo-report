import { useState } from "react";
import { pct } from "@/lib/format";
import { Legend, TipRow, Tooltip, barPath, fit, linear, niceTicks, useWidth, type TipState } from "./core";

export interface UpliftRow {
  key: string;
  label: string;
  sub?: string;
  /** during vs before */
  during: number | null;
  /** after vs before */
  after: number | null;
}

interface Props {
  rows: UpliftRow[];
  onSelect?: (key: string) => void;
  rowHeight?: number;
}

/**
 * Horizontal diverging bars: the bar is "during vs before", the ring-dot on the
 * same row is "after vs before" — both are % vs the same baseline, so one axis.
 * Green/red carry good/bad and are always paired with a signed value label.
 */
export function UpliftBars({ rows, onSelect, rowHeight = 30 }: Props) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [tip, setTip] = useState<TipState | null>(null);
  const [hover, setHover] = useState<string | null>(null);

  const labelW = Math.min(190, Math.max(110, width * 0.3));
  const m = { top: 8, right: 56, bottom: 24, left: labelW };
  const vals = rows.flatMap((r) => [r.during, r.after]).filter((v): v is number => v != null);
  const ticks = niceTicks(Math.min(-0.05, ...vals), Math.max(0.1, ...vals), 4);
  const x = linear(ticks[0], ticks[ticks.length - 1], m.left, width - m.right);
  const height = m.top + rows.length * rowHeight + m.bottom;
  const x0 = x(0);
  const barH = Math.min(14, rowHeight - 12);

  return (
    <div>
      <Legend
        className="mb-3"
        items={[
          { label: "During vs before (bar)", color: "var(--good)" },
          { label: "After vs before (dot)", color: "var(--color-foreground)", shape: "dot" },
        ]}
      />
      <div ref={ref} className="relative" onMouseLeave={() => (setTip(null), setHover(null))}>
        <svg width={width} height={height} className="block overflow-visible" role="img" aria-label="GGR uplift per promo">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={x(t)} x2={x(t)} y1={m.top} y2={height - m.bottom} stroke={t === 0 ? "var(--viz-axis)" : "var(--viz-grid)"} />
              <text x={x(t)} y={height - 6} textAnchor="middle" fontSize={11} className="fill-muted-foreground tabular">
                {pct(t, 0)}
              </text>
            </g>
          ))}
          {rows.map((r, i) => {
            const cy = m.top + i * rowHeight + rowHeight / 2;
            const d = r.during;
            const good = (d ?? 0) >= 0;
            return (
              <g
                key={r.key}
                className={onSelect ? "cursor-pointer" : undefined}
                onClick={() => onSelect?.(r.key)}
                opacity={hover && hover !== r.key ? 0.5 : 1}
                onMouseMove={(e) => {
                  const rect = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
                  setHover(r.key);
                  setTip({
                    x: e.clientX - rect.left,
                    y: e.clientY - rect.top,
                    content: (
                      <>
                        <p className="font-semibold text-foreground">{r.label}</p>
                        {r.sub && <p className="mb-1 text-muted-foreground">{r.sub}</p>}
                        <TipRow color={good ? "var(--good)" : "var(--bad)"} label="During vs before" value={pct(r.during)} strong />
                        <TipRow color="var(--color-foreground)" label="After vs before" value={pct(r.after)} />
                      </>
                    ),
                  });
                }}
              >
                <rect x={0} y={cy - rowHeight / 2} width={width} height={rowHeight} fill={hover === r.key ? "var(--color-surface-raised)" : "transparent"} rx={6} />
                <text x={8} y={cy} dy="0.32em" fontSize={12} className="fill-foreground">
                  {fit(r.label, labelW - 18, 6.6)}
                </text>
                {d != null && (
                  <>
                    <path d={barPath(x0, x(d), cy - barH / 2, barH)} fill={good ? "var(--good)" : "var(--bad)"} />
                    <text
                      x={d >= 0 ? Math.max(x(d), x(r.after ?? -Infinity)) + 10 : Math.min(x(d), x(r.after ?? Infinity)) - 10}
                      y={cy}
                      dy="0.32em"
                      textAnchor={d >= 0 ? "start" : "end"}
                      fontSize={11.5}
                      className={`tabular font-semibold ${good ? "fill-good-ink" : "fill-bad-ink"}`}
                    >
                      {pct(d)}
                    </text>
                  </>
                )}
                {d == null && (
                  <text x={x0 + 6} y={cy} dy="0.32em" fontSize={11} className="fill-muted-foreground">
                    awaiting data
                  </text>
                )}
                {r.after != null && (
                  <circle cx={x(r.after)} cy={cy} r={5} fill="var(--color-foreground)" stroke="var(--viz-surface)" strokeWidth={2} />
                )}
              </g>
            );
          })}
        </svg>
        <Tooltip tip={tip} width={width} />
      </div>
    </div>
  );
}
