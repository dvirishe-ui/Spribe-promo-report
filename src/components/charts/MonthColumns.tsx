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
  /** Axis labels; defaults to format */
  formatTick?: (v: number) => string;
  /** Highlighted month (selected period) — others recede */
  highlight?: string | null;
  /** Label shown above the highlighted (or last) column */
  label?: (d: MonthDatum) => string;
  height?: number;
  color?: string;
  onSelect?: (month: string) => void;
  valueName: string;
  /**
   * "bar" reads from zero (negative values hang below it). "line" fits the
   * axis to the data, for rates that move in a narrow band.
   */
  shape?: "bar" | "line";
  /** Dashed reference line, e.g. break-even */
  refLine?: { value: number; label: string };
  /** Shared hover, so several month charts highlight the same month together */
  hoverMonth?: string | null;
  onHoverMonth?: (month: string | null) => void;
}

/** One series per month. The selected/latest month is in the accent color and labelled; others are tinted. */
export function MonthColumns({
  data,
  format,
  formatFull = format,
  formatTick = format,
  highlight,
  label,
  height = 200,
  color = "var(--series-before)",
  onSelect,
  valueName,
  shape = "bar",
  refLine,
  hoverMonth,
  onHoverMonth,
}: Props) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [tip, setTip] = useState<TipState | null>(null);
  const [ownHover, setOwnHover] = useState<string | null>(null);
  const hover = hoverMonth !== undefined ? hoverMonth : ownHover;
  const setHover = (m: string | null) => (onHoverMonth ? onHoverMonth(m) : setOwnHover(m));

  const vals = data.map((d) => d.value).filter((v): v is number => v != null && Number.isFinite(v));
  if (refLine) vals.push(refLine.value);
  let lo: number, hi: number;
  if (shape === "line") {
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const pad = Math.max((max - min) * 0.25, Math.abs(max) * 0.002, 1e-6);
    lo = min - pad;
    hi = max + pad;
  } else {
    lo = Math.min(0, ...vals);
    hi = Math.max(0, ...vals);
    if (hi === lo) hi = 1;
  }
  const ticks = vals.length ? niceTicks(lo, hi, 3) : [0, 1];
  const t0 = ticks[0];
  const t1 = ticks[ticks.length - 1];
  const m = { top: 24, right: 6, bottom: 26, left: 50 };
  const innerW = Math.max(10, width - m.left - m.right);
  const y = linear(t0, t1, height - m.bottom, m.top);
  const band = innerW / Math.max(1, data.length);
  const colW = Math.max(6, Math.min(24, band * 0.6));
  const focus = highlight ?? [...data].reverse().find((d) => d.value != null)?.month;
  const everyOther = band < 34;
  const zero = shape === "bar" ? y(0) : null;
  const cx = (i: number) => m.left + band * i + band / 2;
  const linePts = data.map((d, i) => (d.value == null ? null : ([cx(i), y(d.value)] as const)));
  // Break the line at months without data rather than drawing through them.
  const lineD = linePts.reduce((acc, p, i) => (p ? acc + `${acc && linePts[i - 1] ? "L" : "M"}${p[0]},${p[1]}` : acc), "");

  return (
    <div ref={ref} className="relative" onMouseLeave={() => (setTip(null), setHover(null))}>
      <svg width={width} height={height} className="block overflow-visible" role="img" aria-label={`${valueName} by month`}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={m.left} x2={width - m.right} y1={y(t)} y2={y(t)} stroke={t === 0 && shape === "bar" ? "var(--viz-axis)" : "var(--viz-grid)"} />
            <text x={m.left - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} className="fill-muted-foreground tabular">
              {formatTick(t)}
            </text>
          </g>
        ))}
        {refLine && refLine.value >= t0 && refLine.value <= t1 && (
          <g>
            <line x1={m.left} x2={width - m.right} y1={y(refLine.value)} y2={y(refLine.value)} stroke="var(--color-muted-foreground)" strokeDasharray="4 4" />
            <text x={width - m.right} y={y(refLine.value) - 5} textAnchor="end" fontSize={10.5} className="fill-muted-foreground">
              {refLine.label}
            </text>
          </g>
        )}
        {shape === "line" && lineD && <path d={lineD} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />}
        {data.map((d, i) => {
          const x = cx(i);
          const isFocus = d.month === focus;
          const fill = isFocus || hover === d.month ? color : `color-mix(in oklab, ${color} 38%, var(--viz-surface))`;
          const neg = d.value != null && d.value < 0;
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
              {shape === "line" && hover === d.month && (
                <line x1={x} x2={x} y1={m.top - 6} y2={height - m.bottom} stroke="var(--viz-axis)" strokeDasharray="2 3" />
              )}
              {shape === "bar" && d.value != null && <path d={columnPath(x - colW / 2, colW, zero!, y(d.value))} fill={fill} style={{ transition: "fill 120ms" }} />}
              {shape === "line" && d.value != null && (
                <circle cx={x} cy={y(d.value)} r={isFocus || hover === d.month ? 5 : 4} fill={isFocus || hover === d.month ? color : "var(--viz-surface)"} stroke={color} strokeWidth={2} />
              )}
              {d.value == null && shape === "bar" && (
                <line x1={x - colW / 2} x2={x + colW / 2} y1={zero! - 1} y2={zero! - 1} stroke="var(--viz-axis)" strokeWidth={2} />
              )}
              {isFocus && d.value != null && label && (
                <text
                  x={x}
                  y={neg && shape === "bar" ? y(d.value) + 15 : y(d.value) - 9}
                  textAnchor="middle"
                  fontSize={11.5}
                  className="fill-foreground font-semibold tabular"
                >
                  {label(d)}
                </text>
              )}
              {(!everyOther || i % 2 === data.length % 2 || isFocus) && (
                <text x={x} y={height - 8} textAnchor="middle" fontSize={11} className={isFocus ? "fill-foreground font-medium" : "fill-muted-foreground"}>
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
