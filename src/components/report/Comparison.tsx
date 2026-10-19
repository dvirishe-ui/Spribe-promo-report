import { useMemo, useState } from "react";
import { Info, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { linear, niceTicks, useWidth } from "@/components/charts/core";
import type { PromoMetrics } from "@/lib/metrics";
import { comparability, indexedTrends, keyDifferences, MAX_SERIES, seriesColor, shortLabels, type TrendSeries } from "@/lib/compare";
import { median } from "@/lib/metrics";
import { money, multiple, num, pct, pctPlain } from "@/lib/format";
import { formatRange } from "@/lib/dates";
import { cn } from "@/lib/utils";

/** Selected promos as removable chips, each with its series colour. */
export function SelectionChips({ list, onRemove, max }: { list: PromoMetrics[]; onRemove: (id: string) => void; max?: number }) {
  const labels = shortLabels(list);
  const shown = max ? list.slice(0, max) : list;
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1">
      {shown.map((m, i) => (
        <span key={m.promo.id} className="inline-flex max-w-[15rem] items-center gap-1.5 rounded-full border border-border bg-surface px-2 py-0.5 text-xs">
          <span className="size-2 shrink-0 rounded-full" style={{ background: seriesColor(i, list.length) }} />
          <span className="truncate" title={`${m.promo.name} · ${m.promo.operator}`}>
            {labels.get(m.promo.id)}
          </span>
          <button aria-label={`Remove ${m.promo.name}`} onClick={() => onRemove(m.promo.id)} className="text-muted-foreground hover:text-foreground">
            <X className="size-3" />
          </button>
        </span>
      ))}
      {max && list.length > max && <span className="text-xs text-muted-foreground">+{list.length - max} more</span>}
    </div>
  );
}

/** Info icon with every caveat; the ones that change how numbers read are also shown inline. */
function Caveats({ list }: { list: PromoMetrics[] }) {
  const all = comparability(list);
  const material = all.filter((c) => c.material);
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
      <Popover>
        <PopoverTrigger asChild>
          <button className="inline-flex items-center gap-1 hover:text-foreground">
            <Info className="size-3.5" /> How to read this ({all.length})
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-80 p-3 text-xs">
          <ul className="space-y-1.5">
            {all.map((c) => (
              <li key={c.text} className={cn(c.material && "text-foreground")}>
                {c.material ? "⚠ " : "• "}
                {c.text}
              </li>
            ))}
          </ul>
        </PopoverContent>
      </Popover>
      {material.map((c) => (
        <span key={c.text} className="text-accent">
          ⚠ {c.text}
        </span>
      ))}
    </div>
  );
}

interface MetricCard {
  title: string;
  get: (m: PromoMetrics) => number | null;
  fmt: (v: number) => string;
  ref?: number;
}

/** One small horizontal bar chart: one bar per promo, same order as the chips. */
function MetricBars({ card, list, labels }: { card: MetricCard; list: PromoMetrics[]; labels: Map<string, string> }) {
  const vals = list.map((m) => card.get(m));
  const nums = vals.filter((v): v is number => v != null && Number.isFinite(v));
  const lo = Math.min(0, ...nums, card.ref ?? 0);
  const hi = Math.max(0, ...nums, card.ref ?? 0, lo === 0 && !nums.length ? 1 : 0);
  const span = hi - lo || 1;
  const at = (v: number) => ((v - lo) / span) * 100;
  const best = nums.length ? Math.max(...nums) : null;
  return (
    <div className="rounded-lg border border-border p-2.5">
      <p className="mb-1.5 text-xs font-semibold">{card.title}</p>
      <div className="space-y-1">
        {list.map((m, i) => {
          const v = vals[i];
          return (
            <div key={m.promo.id} className="grid grid-cols-[minmax(0,8rem)_1fr_3.6rem] items-center gap-1.5" title={`${m.promo.name} · ${m.promo.operator}`}>
              <span className="flex min-w-0 items-center gap-1 text-[11px] text-muted-foreground">
                <span className="size-1.5 shrink-0 rounded-full" style={{ background: seriesColor(i, list.length) }} />
                <span className="truncate">{labels.get(m.promo.id)}</span>
              </span>
              <span className="relative h-2.5">
                {lo < 0 && <span className="absolute inset-y-[-2px] w-px bg-viz-axis" style={{ left: `${at(0)}%` }} />}
                {card.ref != null && <span className="absolute inset-y-[-3px] w-px border-l border-dashed border-muted-foreground" style={{ left: `${at(card.ref)}%` }} />}
                {v != null && (
                  <span
                    className="absolute inset-y-0 rounded-[2px]"
                    style={{
                      left: `${Math.min(at(0), at(v))}%`,
                      width: `${Math.max(0.8, Math.abs(at(v) - at(0)))}%`,
                      background: list.length <= MAX_SERIES ? seriesColor(i, list.length) : v === best ? "var(--cat-1)" : "var(--color-muted-foreground)",
                    }}
                  />
                )}
              </span>
              <span className={cn("text-right text-[11px] tabular", v === best && nums.length > 1 && "font-semibold")}>{v == null ? "—" : card.fmt(v)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Before / during / after per promo on one shared scale (per day, so lengths
 * compare). Bars carry the promo's colour (its identity in this view); the
 * phase is the B / D / A label and the shade, so colours never mean two things.
 */
function PhaseBars({ list, labels, currency }: { list: PromoMetrics[]; labels: Map<string, string>; currency: string }) {
  const rows = list.map((m) => ({
    m,
    v: [m.ggrBefore == null ? null : m.ggrBefore / m.windowDays, m.ggrDuring == null ? null : m.ggrDuring / m.promoDays, m.ggrAfter == null ? null : m.ggrAfter / m.windowDays],
  }));
  const max = Math.max(1, ...rows.flatMap((r) => r.v.filter((x): x is number => x != null)));
  const keys = ["before", "during", "after"] as const;
  return (
    <div className="rounded-lg border border-border p-2.5">
      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold">GGR per day · before / during / after</p>
        <span className="text-[10px] text-muted-foreground">B before · D during · A after</span>
      </div>
      <div className="space-y-1.5">
        {rows.map(({ m, v }, i) => (
          <div key={m.promo.id} className="grid grid-cols-[minmax(0,8rem)_1fr] items-center gap-1.5" title={`${m.promo.name} · ${m.promo.operator}`}>
            <span className="flex min-w-0 items-center gap-1 text-[11px] text-muted-foreground">
              <span className="size-1.5 shrink-0 rounded-full" style={{ background: seriesColor(i, list.length) }} />
              <span className="truncate">{labels.get(m.promo.id)}</span>
            </span>
            <div className="space-y-px">
              {keys.map((k, j) => (
                <div key={k} className="grid grid-cols-[0.6rem_1fr_3.6rem] items-center gap-1.5">
                  <span className="text-[9px] font-semibold text-muted-foreground">{k[0].toUpperCase()}</span>
                  <span className="relative h-1.5">
                    {v[j] != null && (
                      <span
                        className="absolute inset-y-0 left-0 rounded-[2px]"
                        style={{ width: `${(v[j]! / max) * 100}%`, background: seriesColor(i, list.length), opacity: k === "during" ? 1 : k === "after" ? 0.7 : 0.45 }}
                      />
                    )}
                  </span>
                  <span className="text-right text-[10px] tabular text-muted-foreground">{v[j] == null ? "—" : money(v[j], currency)}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Daily GGR by day since each promo started, indexed (avg day before = 100)
 * so different-sized promos share a scale. A real time series, so a line
 * chart. With more than six promos the median leads and individual lines
 * recede; hover a legend entry to bring one forward.
 */
function TrendLines({ list, labels }: { list: PromoMetrics[]; labels: Map<string, string> }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [focus, setFocus] = useState<string | null>(null);
  const [hoverDay, setHoverDay] = useState<number | null>(null);
  const series = useMemo(() => indexedTrends(list), [list]);
  const missing = list.filter((m) => !series.some((s) => s.id === m.promo.id));
  if (!series.length) return <p className="py-6 text-center text-xs text-muted-foreground">No daily GGR for these promos — the trend needs a daily series from the Back Office.</p>;

  const many = list.length > MAX_SERIES;
  const days = series.flatMap((s) => s.points.map((p) => p.day));
  const minD = Math.min(...days);
  const maxD = Math.max(...days);
  const medianLine: TrendSeries | null = many
    ? {
        id: "median",
        endDay: 0,
        points: Array.from({ length: maxD - minD + 1 }, (_, k) => minD + k)
          .map((day) => {
            const xs = series.map((s) => s.points.find((p) => p.day === day)?.index).filter((v): v is number => v != null);
            return xs.length >= 2 ? { day, index: median(xs)!, value: 0 } : null;
          })
          .filter((p): p is { day: number; index: number; value: number } => !!p),
      }
    : null;
  const vals = series.flatMap((s) => s.points.map((p) => p.index));
  const ticks = niceTicks(Math.min(80, ...vals), Math.max(120, ...vals), 4);
  const h = 190;
  const m = { top: 10, right: 10, bottom: 22, left: 34 };
  const x = linear(minD, maxD, m.left, width - m.right);
  const y = linear(ticks[0], ticks[ticks.length - 1], h - m.bottom, m.top);
  const path = (pts: TrendSeries["points"]) => pts.map((p, k) => `${k ? "L" : "M"}${x(p.day).toFixed(1)},${y(p.index).toFixed(1)}`).join("");
  const colorOf = (id: string) => seriesColor(list.findIndex((l) => l.promo.id === id), list.length);
  const xTicks = niceTicks(minD, maxD, 6).filter((t) => t >= minD && t <= maxD);

  return (
    <div>
      <div ref={ref} className="relative" onMouseLeave={() => setHoverDay(null)}>
        <svg
          width={width}
          height={h}
          className="block"
          role="img"
          aria-label="Daily GGR indexed to the average day before each promo"
          onMouseMove={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            const d = Math.round(minD + ((e.clientX - r.left - m.left) / Math.max(1, width - m.left - m.right)) * (maxD - minD));
            setHoverDay(Math.max(minD, Math.min(maxD, d)));
          }}
        >
          {ticks.map((t) => (
            <g key={t}>
              <line x1={m.left} x2={width - m.right} y1={y(t)} y2={y(t)} stroke={t === 100 ? "var(--viz-axis)" : "var(--viz-grid)"} strokeDasharray={t === 100 ? "3 3" : undefined} />
              <text x={m.left - 6} y={y(t)} dy="0.32em" textAnchor="end" fontSize={10} className="fill-muted-foreground tabular">
                {t}
              </text>
            </g>
          ))}
          {xTicks.map((t) => (
            <text key={t} x={x(t)} y={h - 6} textAnchor="middle" fontSize={10} className="fill-muted-foreground tabular">
              {t === 0 ? "start" : t > 0 ? `+${t}d` : `${t}d`}
            </text>
          ))}
          <line x1={x(0)} x2={x(0)} y1={m.top} y2={h - m.bottom} stroke="var(--viz-axis)" />
          {series.map((s) => {
            const dim = (focus && focus !== s.id) || (many && focus !== s.id);
            const end = s.points.find((p) => p.day === s.endDay);
            return (
              <g key={s.id} opacity={dim ? 0.25 : 1}>
                <path d={path(s.points)} fill="none" stroke={many && focus !== s.id ? "var(--color-muted-foreground)" : colorOf(s.id)} strokeWidth={focus === s.id ? 2.5 : many ? 1 : 2} strokeLinejoin="round" />
                {end && !many && <circle cx={x(end.day)} cy={y(end.index)} r={3.5} fill={colorOf(s.id)} stroke="var(--viz-surface)" strokeWidth={1.5} />}
              </g>
            );
          })}
          {medianLine && <path d={path(medianLine.points)} fill="none" stroke="var(--cat-1)" strokeWidth={2.5} />}
          {hoverDay != null && <line x1={x(hoverDay)} x2={x(hoverDay)} y1={m.top} y2={h - m.bottom} stroke="var(--viz-axis)" strokeDasharray="2 3" />}
        </svg>
        {hoverDay != null && (
          <div
            className="pointer-events-none absolute top-1 z-10 w-52 rounded-md border border-border bg-popover p-2 text-[11px] shadow-lg"
            style={{ left: Math.min(Math.max(0, x(hoverDay) + 10), width - 215) }}
          >
            <p className="mb-1 font-semibold">{hoverDay === 0 ? "First day" : hoverDay > 0 ? `Day +${hoverDay}` : `${-hoverDay} days before`}</p>
            {(many && medianLine ? [{ id: "median", label: "Median", v: medianLine.points.find((p) => p.day === hoverDay)?.index }] : [])
              .concat(
                series
                  .filter((s) => !many || s.id === focus)
                  .map((s) => ({ id: s.id, label: labels.get(s.id) ?? "", v: s.points.find((p) => p.day === hoverDay)?.index })),
              )
              .map((r) => (
                <p key={r.id} className="flex items-center justify-between gap-2 tabular">
                  <span className="flex min-w-0 items-center gap-1">
                    <span className="size-1.5 shrink-0 rounded-full" style={{ background: r.id === "median" ? "var(--cat-1)" : colorOf(r.id) }} />
                    <span className="truncate">{r.label}</span>
                  </span>
                  <span>{r.v == null ? "—" : Math.round(r.v)}</span>
                </p>
              ))}
          </div>
        )}
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        {many && (
          <span className="flex items-center gap-1 font-medium text-foreground">
            <span className="h-0.5 w-3 bg-[var(--cat-1)]" /> Median of {series.length}
          </span>
        )}
        {series.map((s) => (
          <button key={s.id} onMouseEnter={() => setFocus(s.id)} onMouseLeave={() => setFocus(null)} onFocus={() => setFocus(s.id)} onBlur={() => setFocus(null)} className="flex items-center gap-1 hover:text-foreground">
            <span className="h-0.5 w-3" style={{ background: colorOf(s.id) }} />
            {labels.get(s.id)}
          </button>
        ))}
        {missing.length > 0 && <span>· No daily data: {missing.map((m) => labels.get(m.promo.id)).join(", ")}</span>}
      </div>
    </div>
  );
}

/**
 * Side-by-side view of two or more promos: what differs, the key metrics as
 * small bar charts (categorical → bars), the daily trend as lines (time →
 * lines), and the full numbers in an expandable table.
 */
export function ComparisonView({ list, currency, onOpen }: { list: PromoMetrics[]; currency: string; onOpen: (id: string) => void }) {
  const labels = shortLabels(list);
  if (list.length < 2) return <p className="py-8 text-center text-sm text-muted-foreground">Select two or more promotions to compare them.</p>;
  const diffs = keyDifferences(list, labels, currency);
  const cards: MetricCard[] = [
    { title: "GGR change (during vs before)", get: (m) => m.duringVsBefore, fmt: (v) => pct(v) },
    { title: "After vs before", get: (m) => m.afterVsBefore, fmt: (v) => pct(v) },
    { title: "Part. rate", get: (m) => m.participationRate, fmt: (v) => pctPlain(v, 1) },
    { title: "Total wager", get: (m) => m.turnoverDuring, fmt: (v) => money(v, currency) },
    { title: "Promo contribution", get: (m) => m.promo.prizePool, fmt: (v) => money(v, currency) },
    { title: "Promo ROI (x)", get: (m) => m.promoRoi, fmt: (v) => multiple(v), ref: 1 },
  ];

  return (
    <div className="space-y-3">
      <Caveats list={list} />
      {diffs.length > 0 && (
        <ul className="grid gap-x-4 gap-y-0.5 text-xs sm:grid-cols-2">
          {diffs.map((d) => (
            <li key={d} className="flex gap-1.5">
              <span className="text-primary">▸</span>
              {d}
            </li>
          ))}
        </ul>
      )}
      <div className="grid gap-2.5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <div className="rounded-lg border border-border p-2.5">
          <p className="mb-1 text-xs font-semibold">Daily GGR trend · indexed (avg day before = 100)</p>
          <TrendLines list={list} labels={labels} />
        </div>
        <PhaseBars list={list} labels={labels} currency={currency} />
      </div>
      <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((c) => (
          <MetricBars key={c.title} card={c} list={list} labels={labels} />
        ))}
      </div>
      <details className="group rounded-lg border border-border">
        <summary className="cursor-pointer px-3 py-2 text-xs font-semibold">All numbers</summary>
        <div className="overflow-x-auto border-t border-border">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-surface-raised text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                {["Promotion", "Dates", "GGR before", "GGR during", "GGR after", "Δ during", "Δ after", "Players", "Part.", "Wager", "RTP", "Contribution", "ROI"].map((h, i) => (
                  <th key={h} className={cn("whitespace-nowrap px-2 py-1.5 font-medium", i > 1 && "text-right")}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {list.map((m, i) => (
                <tr key={m.promo.id} onClick={() => onOpen(m.promo.id)} className="cursor-pointer hover:bg-surface-raised">
                  <td className="max-w-[12rem] px-2 py-1.5">
                    <span className="flex items-center gap-1.5">
                      <span className="size-1.5 shrink-0 rounded-full" style={{ background: seriesColor(i, list.length) }} />
                      <span className="truncate">{labels.get(m.promo.id)}</span>
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-2 py-1.5 text-muted-foreground">
                    {formatRange(m.promo.startDate, m.promo.endDate)} · {m.promoDays}d
                  </td>
                  {[
                    money(m.ggrBefore, currency),
                    money(m.ggrDuring, currency),
                    money(m.ggrAfter, currency),
                    pct(m.duringVsBefore),
                    pct(m.afterVsBefore),
                    num(m.participants),
                    pctPlain(m.participationRate, 1),
                    money(m.turnoverDuring, currency),
                    pctPlain(m.rtp, 2),
                    money(m.promo.prizePool, currency),
                    multiple(m.promoRoi),
                  ].map((v, k) => (
                    <td key={k} className="whitespace-nowrap px-2 py-1.5 text-right tabular">
                      {v}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
