import { useState } from "react";
import { Legend, TipRow, Tooltip, columnPath, fit, linear, niceTicks, useWidth, type TipState } from "./core";

export interface ColumnSeries {
  key: string;
  label: string;
  color: string;
}

export interface ColumnCategory {
  key: string;
  label: string;
  values: Record<string, number | null>;
  /** Extra rows for the tooltip (e.g. "During vs before +24%") */
  extra?: Array<{ label: string; value: string }>;
}

interface Props {
  categories: ColumnCategory[];
  series: ColumnSeries[];
  format: (v: number) => string;
  formatFull?: (v: number) => string;
  height?: number;
  onSelect?: (key: string) => void;
  /** Label the tip of each column of this series (selective labelling, e.g. only "during"). */
  labelSeries?: string;
  showLegend?: boolean;
}

/**
 * Grouped columns — e.g. Before / During / After GGR side by side per promo or per type.
 * Thin columns (≤24px), 2px surface gap inside a group, rounded data-ends.
 */
export function GroupedColumns({
  categories,
  series,
  format,
  formatFull = format,
  height = 280,
  onSelect,
  labelSeries,
  showLegend = true,
}: Props) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [tip, setTip] = useState<TipState | null>(null);
  const [hover, setHover] = useState<string | null>(null);

  const all = categories.flatMap((c) => series.map((s) => c.values[s.key])).filter((v): v is number => v != null);
  const ticks = niceTicks(Math.min(0, ...all), Math.max(0, ...all, 1), 4);
  const yMin = ticks[0];
  const yMax = ticks[ticks.length - 1];

  const m = { top: labelSeries ? 22 : 10, right: 8, bottom: 30, left: 52 };
  const innerW = Math.max(10, width - m.left - m.right);
  const innerH = height - m.top - m.bottom;
  const y = linear(yMin, yMax, m.top + innerH, m.top);
  const band = innerW / Math.max(1, categories.length);
  const gap = 2;
  const colW = Math.max(4, Math.min(24, (band * 0.72 - gap * (series.length - 1)) / series.length));
  const groupW = colW * series.length + gap * (series.length - 1);
  const y0 = y(0);

  return (
    <div>
      {showLegend && <Legend items={series.map((s) => ({ label: s.label, color: s.color }))} className="mb-3" />}
      <div ref={ref} className="relative" onMouseLeave={() => (setTip(null), setHover(null))}>
        <svg width={width} height={height} className="block overflow-visible" role="img" aria-label="Grouped column chart">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={m.left} x2={width - m.right} y1={y(t)} y2={y(t)} stroke="var(--viz-grid)" strokeWidth={1} />
              <text x={m.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="fill-muted-foreground tabular" fontSize={11}>
                {format(t)}
              </text>
            </g>
          ))}
          {categories.map((c, i) => {
            const gx = m.left + band * i + (band - groupW) / 2;
            const dim = hover && hover !== c.key;
            return (
              <g
                key={c.key}
                opacity={dim ? 0.45 : 1}
                style={{ transition: "opacity 120ms" }}
                className={onSelect ? "cursor-pointer" : undefined}
                onClick={() => onSelect?.(c.key)}
                onMouseMove={(e) => {
                  const r = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
                  setHover(c.key);
                  setTip({
                    x: e.clientX - r.left,
                    y: e.clientY - r.top,
                    content: (
                      <>
                        <p className="mb-1 font-semibold text-foreground">{c.label}</p>
                        {series.map((s) => (
                          <TipRow
                            key={s.key}
                            color={s.color}
                            label={s.label}
                            value={c.values[s.key] == null ? "—" : formatFull(c.values[s.key] as number)}
                          />
                        ))}
                        {c.extra?.map((x) => <TipRow key={x.label} label={x.label} value={x.value} strong />)}
                      </>
                    ),
                  });
                }}
              >
                {/* hit target larger than the marks */}
                <rect x={m.left + band * i} y={m.top} width={band} height={innerH} fill="transparent" />
                {series.map((s, j) => {
                  const v = c.values[s.key];
                  if (v == null) return null;
                  const x = gx + j * (colW + gap);
                  return (
                    <g key={s.key}>
                      <path d={columnPath(x, colW, y0, y(v))} fill={s.color} />
                      {labelSeries === s.key && band > 46 && (
                        <text
                          x={x + colW / 2}
                          y={v >= 0 ? y(v) - 6 : y(v) + 13}
                          textAnchor="middle"
                          fontSize={10.5}
                          className="fill-foreground tabular"
                        >
                          {format(v)}
                        </text>
                      )}
                    </g>
                  );
                })}
                <text
                  x={m.left + band * i + band / 2}
                  y={height - 10}
                  textAnchor="middle"
                  fontSize={11}
                  className={hover === c.key ? "fill-foreground" : "fill-muted-foreground"}
                >
                  {fit(c.label, band - 6)}
                </text>
              </g>
            );
          })}
          <line x1={m.left} x2={width - m.right} y1={y0} y2={y0} stroke="var(--viz-axis)" strokeWidth={1} />
        </svg>
        <Tooltip tip={tip} width={width} />
      </div>
    </div>
  );
}
