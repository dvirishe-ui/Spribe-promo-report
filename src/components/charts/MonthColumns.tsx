import { useState } from "react";
import { monthLabel } from "@/lib/dates";
import { TipRow, Tooltip, columnPath, linear, niceTicks, useWidth, type TipState } from "./core";

export interface MonthDatum {
  month: string;
  value: number | null;
  /** extra tooltip rows */
  extra?: Array<{ label: string; value: string; color?: string }>;
}

interface Props {
  data: MonthDatum[];
  format: (v: number) => string;
  formatFull?: (v: number) => string;
  /** Highlighted month (selected period) — others recede */
  highlight?: string | null;
  /** Label shown above the highlighted (or last) column */
  label?: (d: MonthDatum) => string;
  height?: number;
  color?: string;
  onSelect?: (month: string) => void;
  valueName: string;
}

/** One series per month. The selected/latest month is in the accent color and labelled; others are tinted. */
export function MonthColumns({
  data,
  format,
  formatFull = format,
  highlight,
  label,
  height = 200,
  color = "var(--series-before)",
  onSelect,
  valueName,
}: Props) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [tip, setTip] = useState<TipState | null>(null);
  const [hover, setHover] = useState<string | null>(null);

  const vals = data.map((d) => d.value).filter((v): v is number => v != null);
  const ticks = niceTicks(0, Math.max(1, ...vals), 3);
  const m = { top: 24, right: 6, bottom: 26, left: 46 };
  const innerW = Math.max(10, width - m.left - m.right);
  const y = linear(0, ticks[ticks.length - 1], height - m.bottom, m.top);
  const band = innerW / Math.max(1, data.length);
  const colW = Math.max(6, Math.min(24, band * 0.6));
  const focus = highlight ?? [...data].reverse().find((d) => d.value != null)?.month;
  const everyOther = band < 34;

  return (
    <div ref={ref} className="relative" onMouseLeave={() => (setTip(null), setHover(null))}>
      <svg width={width} height={height} className="block overflow-visible" role="img" aria-label={`${valueName} by month`}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={m.left} x2={width - m.right} y1={y(t)} y2={y(t)} stroke={t === 0 ? "var(--viz-axis)" : "var(--viz-grid)"} />
            <text x={m.left - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} className="fill-muted-foreground tabular">
              {format(t)}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const cx = m.left + band * i + band / 2;
          const isFocus = d.month === focus;
          const fill = isFocus || hover === d.month ? color : `color-mix(in oklab, ${color} 38%, var(--viz-surface))`;
          return (
            <g
              key={d.month}
              className={onSelect ? "cursor-pointer" : undefined}
              onClick={() => onSelect?.(d.month)}
              onMouseMove={(e) => {
                const r = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
                setHover(d.month);
                setTip({
                  x: e.clientX - r.left,
                  y: e.clientY - r.top,
                  content: (
                    <>
                      <p className="mb-1 font-semibold text-foreground">{monthLabel(d.month, "long")}</p>
                      <TipRow color={color} label={valueName} value={d.value == null ? "No data" : formatFull(d.value)} strong />
                      {d.extra?.map((x) => <TipRow key={x.label} label={x.label} value={x.value} color={x.color} />)}
                    </>
                  ),
                });
              }}
            >
              <rect x={m.left + band * i} y={m.top - 20} width={band} height={height - m.top - m.bottom + 20} fill="transparent" />
              {d.value != null && <path d={columnPath(cx - colW / 2, colW, y(0), y(d.value))} fill={fill} style={{ transition: "fill 120ms" }} />}
              {d.value == null && (
                <line x1={cx - colW / 2} x2={cx + colW / 2} y1={y(0) - 1} y2={y(0) - 1} stroke="var(--viz-axis)" strokeWidth={2} />
              )}
              {isFocus && d.value != null && label && (
                <text x={cx} y={y(d.value) - 8} textAnchor="middle" fontSize={11.5} className="fill-foreground font-semibold tabular">
                  {label(d)}
                </text>
              )}
              {(!everyOther || i % 2 === data.length % 2 || isFocus) && (
                <text
                  x={cx}
                  y={height - 8}
                  textAnchor="middle"
                  fontSize={11}
                  className={isFocus ? "fill-foreground font-medium" : "fill-muted-foreground"}
                >
                  {monthLabel(d.month, "short", false)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <Tooltip tip={tip} width={width} />
    </div>
  );
}
