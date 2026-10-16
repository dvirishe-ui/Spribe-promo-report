import { useState } from "react";
import { multiple } from "@/lib/format";
import { Legend, TipRow, Tooltip, linear, niceTicks, useWidth, type TipState } from "./core";

export interface RoiPoint {
  key: string;
  label: string;
  sub?: string;
  cost: number;
  incremental: number;
  roi: number | null;
}

interface Props {
  points: RoiPoint[];
  format: (v: number) => string;
  formatFull: (v: number) => string;
  height?: number;
  onSelect?: (key: string) => void;
}

/**
 * Prize pool (x) vs extra GGR generated (y). Above the diagonal the promo paid
 * for itself; the further above, the better the ROI.
 */
export function RoiScatter({ points, format, formatFull, height = 280, onSelect }: Props) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [tip, setTip] = useState<TipState | null>(null);
  const [hover, setHover] = useState<string | null>(null);

  const m = { top: 12, right: 16, bottom: 40, left: 56 };
  const maxX = Math.max(1, ...points.map((p) => p.cost));
  const ys = points.map((p) => p.incremental);
  const xt = niceTicks(0, maxX, 4);
  const yt = niceTicks(Math.min(0, ...ys), Math.max(maxX, ...ys, 1), 4);
  const x = linear(0, xt[xt.length - 1], m.left, width - m.right);
  const y = linear(yt[0], yt[yt.length - 1], height - m.bottom, m.top);
  const diagEnd = Math.min(xt[xt.length - 1], yt[yt.length - 1]);

  return (
    <div>
      <Legend
        className="mb-3"
        items={[
          { label: "Promo", color: "var(--series-during)", shape: "dot" },
          { label: "Break-even (extra GGR = prize pool)", color: "var(--viz-axis)", shape: "line" },
        ]}
      />
      <div ref={ref} className="relative" onMouseLeave={() => (setTip(null), setHover(null))}>
        <svg width={width} height={height} className="block overflow-visible" role="img" aria-label="Prize pool versus incremental GGR">
          {yt.map((t) => (
            <g key={`y${t}`}>
              <line x1={m.left} x2={width - m.right} y1={y(t)} y2={y(t)} stroke={t === 0 ? "var(--viz-axis)" : "var(--viz-grid)"} />
              <text x={m.left - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} className="fill-muted-foreground tabular">
                {format(t)}
              </text>
            </g>
          ))}
          {xt.map((t) => (
            <text key={`x${t}`} x={x(t)} y={height - m.bottom + 16} textAnchor="middle" fontSize={11} className="fill-muted-foreground tabular">
              {format(t)}
            </text>
          ))}
          <text x={(m.left + width - m.right) / 2} y={height - 4} textAnchor="middle" fontSize={11} className="fill-muted-foreground">
            Prize pool →
          </text>
          <line x1={x(0)} y1={y(0)} x2={x(diagEnd)} y2={y(diagEnd)} stroke="var(--viz-axis)" strokeWidth={1.5} />
          <text x={x(diagEnd) - 4} y={y(diagEnd) + 14} textAnchor="end" fontSize={10.5} className="fill-muted-foreground">
            1× break-even
          </text>
          {points.map((p) => (
            <g
              key={p.key}
              className={onSelect ? "cursor-pointer" : undefined}
              onClick={() => onSelect?.(p.key)}
              onMouseMove={(e) => {
                const r = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
                setHover(p.key);
                setTip({
                  x: e.clientX - r.left,
                  y: e.clientY - r.top,
                  content: (
                    <>
                      <p className="font-semibold text-foreground">{p.label}</p>
                      {p.sub && <p className="mb-1 text-muted-foreground">{p.sub}</p>}
                      <TipRow label="Prize pool" value={formatFull(p.cost)} />
                      <TipRow label="Extra GGR (during + after)" value={formatFull(p.incremental)} />
                      <TipRow label="ROI" value={multiple(p.roi)} strong />
                    </>
                  ),
                });
              }}
            >
              <circle cx={x(p.cost)} cy={y(p.incremental)} r={14} fill="transparent" />
              <circle
                cx={x(p.cost)}
                cy={y(p.incremental)}
                r={hover === p.key ? 7.5 : 5.5}
                fill={p.incremental >= p.cost ? "var(--series-during)" : "var(--color-muted-foreground)"}
                stroke="var(--viz-surface)"
                strokeWidth={2}
                style={{ transition: "r 120ms" }}
              />
            </g>
          ))}
        </svg>
        <Tooltip tip={tip} width={width} />
      </div>
    </div>
  );
}
