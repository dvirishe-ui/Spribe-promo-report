import { useState, type ReactNode } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MonthColumns } from "@/components/charts/MonthColumns";
import { linear, niceTicks, useWidth } from "@/components/charts/core";
import { CHART_METRICS, formatMetric, formatTick, rollup, type ChartMetric } from "@/lib/rollup";
import { monthLabel, prevMonth } from "@/lib/dates";
import type { MonthRow, PromoMetrics } from "@/lib/metrics";
import { cn } from "@/lib/utils";

const COLOR = "var(--series-before)";

/** Compact dropdown for choosing which metric a chart shows. */
export function MetricPicker({
  value,
  onChange,
  options,
  className,
}: {
  value: string;
  onChange: (key: string) => void;
  options: Array<{ key: string; label: string }>;
  className?: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger aria-label="Choose a metric" className={cn("h-8 w-auto min-w-44 gap-2 bg-surface-raised text-xs", className)}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.key} value={o.key} className="text-xs">
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function ChartHeader({ title, sub, picker }: { title: ReactNode; sub: ReactNode; picker: ReactNode }) {
  return (
    <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
      <div className="min-w-0 basis-full sm:basis-0 sm:flex-1">
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>
      </div>
      {picker}
    </div>
  );
}

/** "+3.5% vs August" for amounts; "+2.1 pts vs August" for rates and changes. */
function vsPrevious(metric: ChartMetric, cur: number | null, prev: number | null, prevName: string): string {
  if (cur == null || prev == null) return "";
  if (metric.format === "money" || metric.format === "count") return prev > 0 ? `, ${formatMetric("change", cur / prev - 1, "")} vs ${prevName}` : "";
  if (metric.format === "roi") return `, ${cur - prev >= 0 ? "+" : "−"}${Math.abs(cur - prev).toFixed(1)}× vs ${prevName}`;
  const pts = (cur - prev) * 100;
  return `, ${pts >= 0 ? "+" : "−"}${Math.abs(pts).toFixed(1)} pts vs ${prevName}`;
}

/**
 * Overview trend: one chart, any metric, by the month promos started. Total
 * GGR comes from the monthly totals; everything else is rolled up from the
 * promos in view (filters apply).
 */
export function TrendCard({
  rows,
  promos,
  currency,
  highlight,
  metricKey,
  onMetric,
  onSelectMonth,
}: {
  rows: MonthRow[];
  promos: PromoMetrics[];
  currency: string;
  highlight: string | null;
  metricKey: string;
  onMetric: (key: string) => void;
  onSelectMonth: (month: string) => void;
}) {
  const metric = CHART_METRICS.find((x) => x.key === metricKey) ?? CHART_METRICS[0];
  const byMonth = new Map<string, PromoMetrics[]>();
  for (const p of promos) byMonth.set(p.month, [...(byMonth.get(p.month) ?? []), p]);
  const data = rows.map((r) => {
    const list = byMonth.get(r.month) ?? [];
    const value = metric.key === "monthGgr" ? r.ggr : list.length ? rollup(list)[metric.key] : null;
    return {
      month: r.month,
      value: value ?? null,
      extra: [{ label: "Promos started", value: String(list.length) }],
    };
  });
  const focus = data.find((d) => d.month === highlight) ?? [...data].reverse().find((d) => d.value != null);
  const prev = focus ? data.find((d) => d.month === prevMonth(focus.month)) : undefined;
  const fmt = (v: number) => formatMetric(metric.format, v, currency);

  return (
    <>
      <ChartHeader
        title={metric.key === "monthGgr" ? "GGR trend" : `${metric.label} by month`}
        sub={
          <>
            {metric.about}
            {focus?.value != null && (
              <>
                {" "}
                <span className="text-foreground">
                  {monthLabel(focus.month, "long")}: {formatMetric(metric.format, focus.value, currency)}
                  {vsPrevious(metric, focus.value, prev?.value ?? null, monthLabel(prevMonth(focus.month), "long", false))}.
                </span>
              </>
            )}{" "}
            Click a month to open it.
          </>
        }
        picker={<MetricPicker value={metric.key} onChange={onMetric} options={CHART_METRICS} />}
      />
      <MonthColumns
        data={data}
        valueName={metric.label}
        format={fmt}
        formatFull={(v) => formatMetric(metric.format, v, currency, true)}
        formatTick={(v) => formatTick(metric.format, v, currency)}
        highlight={highlight}
        label={(d) => fmt(d.value!)}
        onSelect={onSelectMonth}
        shape={metric.shape}
        refLine={metric.ref}
        height={180}
      />
    </>
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
 * Per-promo chart card for Explore → Promotions: the three linked
 * Before / During / After charts, or any single metric as one bar per promo.
 */
export function PromoChartCard({
  list,
  currency,
  metricKey,
  onMetric,
  onSelect,
  triptych,
}: {
  list: PromoMetrics[];
  currency: string;
  metricKey: string;
  onMetric: (key: string) => void;
  onSelect: (id: string) => void;
  /** Renders the before/during/after charts, given the metric picker to place in their header */
  triptych: (toolbar: ReactNode) => ReactNode;
}) {
  const options = [{ key: "bda", label: "GGR before · during · after" }, ...CHART_METRICS.filter((x) => x.perPromo)];
  const metric = CHART_METRICS.find((x) => x.key === metricKey && x.perPromo);
  const picker = <MetricPicker value={metric ? metric.key : "bda"} onChange={onMetric} options={options} className="h-7" />;
  if (!metric) return <>{triptych(picker)}</>;
  const r = rollup(list)[metric.key as keyof ReturnType<typeof rollup>];
  return (
    <>
      <ChartHeader
        title={`${metric.label} by promotion`}
        sub={
          <>
            All in view: <span className="font-medium text-foreground">{formatMetric(metric.format, r as number | null, currency)}</span>
          </>
        }
        picker={picker}
      />
      <PromoBars list={list} metric={metric} currency={currency} onSelect={onSelect} />
    </>
  );
}
