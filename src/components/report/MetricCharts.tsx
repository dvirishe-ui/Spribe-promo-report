import { useState, type ReactNode } from "react";
import { linear, niceTicks, useWidth } from "@/components/charts/core";
import { CHART_METRICS, formatMetric, formatTick, rollup, type ChartMetric } from "@/lib/rollup";
import type { PromoMetrics } from "@/lib/metrics";
import { cn } from "@/lib/utils";
import { MetricChips } from "./MetricChips";

const COLOR = "var(--series-before)";

function ChartHeader({ title, sub, picker }: { title: ReactNode; sub?: ReactNode; picker: ReactNode }) {
  return (
    <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
      <div className="min-w-0">
        <h3 className="text-sm font-semibold">{title}</h3>
        {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
      </div>
      {picker}
    </div>
  );
}

/**
 * One bar per promo for the chosen metric, sorted high to low. Bars read from
 * zero (negative values go left); rates in a narrow band (RTP) are shown as
 * dots on a zoomed axis instead, since bars from zero would all look equal.
 */
export function PromoBars({ list, metric, currency, onSelect }: { list: PromoMetrics[]; metric: ChartMetric; currency: string; onSelect: (id: string) => void }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<string | null>(null);
  const get = metric.perPromo!;
  const withValue = list.filter((m) => get(m) != null && Number.isFinite(get(m)!)).sort((a, b) => get(b)! - get(a)!);
  const missing = list.length - withValue.length;
  if (!withValue.length) return <p className="py-8 text-center text-sm text-muted-foreground">No promo in view reports {metric.label} yet.</p>;

  const vals = withValue.map((m) => get(m)!);
  if (metric.ref) vals.push(metric.ref.value);
  const dots = metric.shape === "line";
  let lo = Math.min(...vals);
  let hi = Math.max(...vals);
  if (dots) {
    const pad = Math.max((hi - lo) * 0.15, Math.abs(hi) * 0.002, 1e-6);
    lo -= pad;
    hi += pad;
  } else {
    lo = Math.min(0, lo);
    hi = Math.max(0, hi);
    if (hi === lo) hi = 1;
  }
  const ticks = niceTicks(lo, hi, 4);
  const labelW = Math.min(250, Math.max(110, width * 0.32));
  const valueW = 64;
  const x0 = labelW + 8;
  const x1 = Math.max(x0 + 40, width - valueW - 4);
  const x = linear(ticks[0], ticks[ticks.length - 1], x0, x1);
  const rowH = 26;
  const top = 18;
  const h = top + withValue.length * rowH + 4;

  return (
    <div>
      <div ref={ref} className="max-h-[340px] overflow-y-auto pr-1">
        <svg width={width} height={h} className="block" role="img" aria-label={`${metric.label} per promotion`}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={x(t)} x2={x(t)} y1={top - 4} y2={h} stroke={t === 0 && !dots ? "var(--viz-axis)" : "var(--viz-grid)"} />
              <text x={x(t)} y={10} textAnchor="middle" fontSize={10.5} className="fill-muted-foreground tabular">
                {formatTick(metric.format, t, currency)}
              </text>
            </g>
          ))}
          {metric.ref && (
            <line x1={x(metric.ref.value)} x2={x(metric.ref.value)} y1={top - 4} y2={h} stroke="var(--color-muted-foreground)" strokeDasharray="4 4" />
          )}
          {withValue.map((m, i) => {
            const v = get(m)!;
            const cy = top + i * rowH + rowH / 2;
            const on = hover === m.promo.id;
            const base = x(Math.max(ticks[0], Math.min(0, ticks[ticks.length - 1])));
            const end = x(v);
            return (
              <g
                key={m.promo.id}
                className="cursor-pointer"
                onClick={() => onSelect(m.promo.id)}
                onMouseEnter={() => setHover(m.promo.id)}
                onMouseLeave={() => setHover(null)}
              >
                <rect x={0} y={cy - rowH / 2} width={width} height={rowH} fill={on ? "var(--color-surface-raised)" : "transparent"} rx={4} />
                <text x={labelW} y={cy} dy="0.32em" textAnchor="end" fontSize={11.5} className={on ? "fill-foreground" : "fill-muted-foreground"}>
                  {truncate(`${m.promo.name} · ${m.promo.operator}`, labelW)}
                  <title>{`${m.promo.name} · ${m.promo.operator}`}</title>
                </text>
                {dots ? (
                  <circle cx={end} cy={cy} r={5} fill={on ? COLOR : "var(--viz-surface)"} stroke={COLOR} strokeWidth={2} />
                ) : (
                  Math.abs(end - base) >= 0.5 && (
                    <rect
                      x={Math.min(base, end)}
                      y={cy - 7}
                      width={Math.abs(end - base)}
                      height={14}
                      rx={3}
                      fill={on ? COLOR : `color-mix(in oklab, ${COLOR} 70%, var(--viz-surface))`}
                    />
                  )
                )}
                <text x={width - 2} y={cy} dy="0.32em" textAnchor="end" fontSize={11.5} className="fill-foreground font-medium tabular">
                  {formatMetric(metric.format, v, currency)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      {(missing > 0 || dots || metric.ref) && (
        <p className="mt-2 text-[11px] text-muted-foreground">
          {dots && "Axis is zoomed in. "}
          {metric.ref && `Dashed line: ${metric.ref.label} (${formatMetric(metric.format, metric.ref.value, currency)}). `}
          {missing > 0 && `${missing} promo${missing === 1 ? " doesn't" : "s don't"} report this yet.`}
        </p>
      )}
    </div>
  );
}

function truncate(s: string, px: number): string {
  const max = Math.floor(px / 6.3);
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

/**
 * Per-promo charts for Explore → Promotions. Pick what to see: the linked
 * Before / During / After charts and/or any metric as one bar per promo.
 */
export function PromoChartCard({
  list,
  currency,
  metricKeys,
  onMetrics,
  onSelect,
  triptych,
}: {
  list: PromoMetrics[];
  currency: string;
  metricKeys: string[];
  onMetrics: (keys: string[]) => void;
  onSelect: (id: string) => void;
  /** Renders the linked before/during/after charts */
  triptych: () => ReactNode;
}) {
  const options = [
    { key: "bda", label: "GGR before · during · after", hint: "Three linked charts, same promos, one scale" },
    ...CHART_METRICS.filter((x) => x.perPromo).map((m) => ({ key: m.key, label: m.label, hint: m.hint })),
  ];
  const keys = metricKeys.filter((k) => options.some((o) => o.key === k));
  const chosen = keys.length ? keys : ["bda"];
  const bars = chosen.map((k) => CHART_METRICS.find((x) => x.key === k && x.perPromo)).filter((m): m is ChartMetric => !!m);
  return (
    <>
      <ChartHeader title="Charts" picker={<MetricChips options={options} value={chosen} onChange={onMetrics} className="w-full sm:w-auto sm:max-w-[36rem]" />} />
      <div className="space-y-5">
        {chosen.includes("bda") && triptych()}
        {bars.length > 0 && (
          <div className={cn("grid gap-x-6 gap-y-5", bars.length > 1 && "lg:grid-cols-2")}>
            {bars.map((metric) => {
              const r = rollup(list)[metric.key as keyof ReturnType<typeof rollup>];
              return (
                <div key={metric.key} className="min-w-0">
                  <div className="mb-1 flex items-baseline justify-between gap-2">
                    <p className="text-xs font-semibold">{metric.label} by promotion</p>
                    <p className="text-[11px] text-muted-foreground">
                      All in view <span className="font-semibold text-foreground">{formatMetric(metric.format, r as number | null, currency)}</span>
                    </p>
                  </div>
                  <PromoBars list={list} metric={metric} currency={currency} onSelect={onSelect} />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
