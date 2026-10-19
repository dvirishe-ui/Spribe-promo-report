import { useMemo, useRef, useState, type ReactNode } from "react";
import { Check } from "lucide-react";
import { PHASE_COLORS, niceTicks } from "./core";
import type { PromoMetrics } from "@/lib/metrics";
import { formatRange } from "@/lib/dates";
import { money, moneyFull, pct } from "@/lib/format";
import { cn } from "@/lib/utils";

export type GgrMode = "total" | "perDay" | "change";
type SortBy = "during" | "change" | "date" | "name";

interface Panel {
  key: "before" | "during" | "after";
  title: string;
  color: string;
  value: (m: PromoMetrics) => number | null;
  kind: "money" | "change";
}

const per = (v: number | null, days: number) => (v == null ? null : v / Math.max(1, days));

function panels(mode: GgrMode): Panel[] {
  if (mode === "change")
    return [
      { key: "before", title: "Before · per day", color: PHASE_COLORS.before, value: (m) => per(m.ggrBefore, m.windowDays), kind: "money" },
      { key: "during", title: "During vs Before", color: PHASE_COLORS.during, value: (m) => m.duringVsBefore, kind: "change" },
      { key: "after", title: "After vs Before", color: PHASE_COLORS.after, value: (m) => m.afterVsBefore, kind: "change" },
    ];
  const pd = mode === "perDay";
  return [
    { key: "before", title: pd ? "GGR Before · per day" : "GGR Before", color: PHASE_COLORS.before, value: (m) => (pd ? per(m.ggrBefore, m.windowDays) : m.ggrBefore), kind: "money" },
    { key: "during", title: pd ? "GGR During · per day" : "GGR During", color: PHASE_COLORS.during, value: (m) => (pd ? per(m.ggrDuring, m.promoDays) : m.ggrDuring), kind: "money" },
    { key: "after", title: pd ? "GGR After · per day" : "GGR After", color: PHASE_COLORS.after, value: (m) => (pd ? per(m.ggrAfter, m.windowDays) : m.ggrAfter), kind: "money" },
  ];
}

interface Scale {
  min: number;
  max: number;
  ticks: number[];
  at: (v: number) => number;
}

function scaleFor(values: number[]): Scale {
  const lo = Math.min(0, ...values);
  const hi = Math.max(0, ...values, lo === 0 ? 1e-9 : 0);
  const ticks = niceTicks(lo, hi, 2);
  const min = ticks[0];
  const max = ticks[ticks.length - 1] || 1;
  return { min, max, ticks, at: (v) => ((v - min) / (max - min || 1)) * 100 };
}

/**
 * GGR Before, During and After as three side-by-side bar charts with the
 * same promotions in the same order. Absolute views share one scale across
 * all three panels so lengths compare honestly; the % view shares one scale
 * across the two change panels. Hovering a row highlights it in every panel
 * and shows all values; the checkbox selects it for comparison; clicking the
 * row opens its report.
 */
export function GgrTriptych({
  list,
  currency,
  mode,
  onMode,
  selected,
  onToggle,
  onOpen,
  limit = 10,
  toolbar,
}: {
  list: PromoMetrics[];
  currency: string;
  mode: GgrMode;
  onMode: (m: GgrMode) => void;
  selected: string[];
  onToggle: (id: string) => void;
  onOpen: (id: string) => void;
  limit?: number;
  /** Extra controls shown in the header row (e.g. a metric picker) */
  toolbar?: ReactNode;
}) {
  const [sortBy, setSortBy] = useState<SortBy>("during");
  const [all, setAll] = useState(false);
  const [onlySelected, setOnlySelected] = useState(false);
  const [hover, setHover] = useState<{ id: string; x: number; y: number } | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const ps = panels(mode);

  const withData = list.filter((m) => m.ggrBefore != null || m.ggrDuring != null);
  const sorted = useMemo(() => {
    const key: Record<SortBy, (m: PromoMetrics) => number | string> = {
      during: (m) => -(mode === "perDay" ? (per(m.ggrDuring, m.promoDays) ?? -Infinity) : (m.ggrDuring ?? -Infinity)),
      change: (m) => -(m.duringVsBefore ?? -Infinity),
      date: (m) => m.promo.startDate,
      name: (m) => m.promo.name.toLowerCase(),
    };
    const k = key[sortBy];
    const base = onlySelected ? withData.filter((m) => selected.includes(m.promo.id)) : withData;
    return [...base].sort((a, b) => {
      const x = k(a);
      const y = k(b);
      return typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y));
    });
  }, [withData, sortBy, mode, onlySelected, selected]);
  const rows = all ? sorted : sorted.slice(0, limit);

  // Shared scales: money panels share one; change panels share another.
  const valuesOf = (kind: Panel["kind"]) =>
    ps.filter((p) => p.kind === kind).flatMap((p) => rows.map(p.value).filter((v): v is number => v != null && Number.isFinite(v)));
  const moneyScale = scaleFor(valuesOf("money"));
  const changeScale = scaleFor(valuesOf("change"));
  const scaleOf = (p: Panel) => (p.kind === "money" ? moneyScale : changeScale);
  const fmt = (p: Panel, v: number | null) => (v == null ? "—" : p.kind === "money" ? money(v, currency) : pct(v));
  const fmtTick = (p: Panel, v: number) => (p.kind === "money" ? money(v, currency) : `${v > 0 ? "+" : ""}${Math.round(v * 100)}%`);

  const hovered = hover ? rows.find((m) => m.promo.id === hover.id) : undefined;
  const grid = "grid grid-cols-[1.25rem_minmax(5.5rem,10rem)_repeat(3,minmax(0,1fr))] items-center gap-x-2 sm:grid-cols-[1.25rem_minmax(7rem,13rem)_repeat(3,minmax(0,1fr))] sm:gap-x-3";
  const seg = (m: GgrMode, label: string) => (
    <button
      key={m}
      onClick={() => onMode(m)}
      className={cn("h-6 rounded px-2 text-xs transition-colors", mode === m ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
    >
      {label}
    </button>
  );

  return (
    <div ref={box} className="relative" onMouseLeave={() => setHover(null)}>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">GGR before · during · after</h3>
        <div className="flex flex-wrap items-center gap-1.5">
          {toolbar}
          {selected.length > 0 && (
            <button
              onClick={() => setOnlySelected((v) => !v)}
              className={cn("h-7 rounded-md border px-2 text-xs", onlySelected ? "border-primary/60 bg-primary/10" : "border-border text-muted-foreground hover:text-foreground")}
            >
              Selected only
            </button>
          )}
          <select
            aria-label="Sort promotions"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortBy)}
            className="h-7 rounded-md border border-border bg-surface px-1.5 text-xs text-muted-foreground"
          >
            <option value="during">Sort: GGR during</option>
            <option value="change">Sort: change</option>
            <option value="date">Sort: date</option>
            <option value="name">Sort: name</option>
          </select>
          <div className="flex h-7 items-center gap-0.5 rounded-md border border-border bg-surface-raised p-0.5">
            {seg("total", "Total")}
            {seg("perDay", "Per day")}
            {seg("change", "% change")}
          </div>
        </div>
      </div>

      {/* Panel titles and axis ticks */}
      <div className={cn(grid, "border-b border-border pb-1.5")}>
        <span />
        <span className="text-[11px] text-muted-foreground">{rows.length < withData.length ? `${rows.length} of ${withData.length}` : `${rows.length} promos`}</span>
        {ps.map((p) => {
          const s = scaleOf(p);
          return (
            <div key={p.key} className="min-w-0">
              <p className="flex items-center gap-1.5 truncate text-xs font-semibold">
                <span className="size-2 shrink-0 rounded-sm" style={{ background: p.color }} />
                <span className="sm:hidden">{p.key === "before" ? "Before" : p.key === "during" ? (mode === "change" ? "Δ During" : "During") : mode === "change" ? "Δ After" : "After"}</span>
                <span className="hidden truncate sm:inline">{p.title}</span>
              </p>
              <div className="relative mr-12 mt-0.5 hidden h-3 sm:block">
                {s.ticks.map((t) => (
                  <span key={t} className="absolute -translate-x-1/2 text-[10px] text-muted-foreground tabular" style={{ left: `${s.at(t)}%` }}>
                    {fmtTick(p, t)}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div role="list">
        {rows.map((m) => {
          const on = selected.includes(m.promo.id);
          const isHover = hover?.id === m.promo.id;
          return (
            <div
              key={m.promo.id}
              role="listitem"
              onClick={() => onOpen(m.promo.id)}
              onMouseMove={(e) => {
                const r = box.current!.getBoundingClientRect();
                setHover({ id: m.promo.id, x: e.clientX - r.left, y: e.clientY - r.top });
              }}
              className={cn(
                grid,
                "relative cursor-pointer border-b border-border/60 py-1 transition-colors last:border-b-0",
                isHover ? "bg-surface-raised" : on ? "bg-primary/[0.06]" : "",
              )}
            >
              <button
                aria-label={on ? `Deselect ${m.promo.name}` : `Select ${m.promo.name} to compare`}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggle(m.promo.id);
                }}
                className={cn("grid size-4 place-items-center rounded border", on ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-primary/60")}
              >
                {on && <Check className="size-3" />}
              </button>
              <div className="min-w-0 leading-tight">
                <p className={cn("truncate text-xs font-medium", on && "text-foreground")} title={m.promo.name}>
                  {m.promo.name}
                </p>
                <p className="truncate text-[10px] text-muted-foreground">{m.promo.operator}</p>
              </div>
              {ps.map((p) => {
                const s = scaleOf(p);
                const v = p.value(m);
                const z = s.at(0);
                const e = v == null ? z : s.at(v);
                return (
                  <div key={p.key} className="flex min-w-0 items-center gap-1.5">
                    <div className="relative h-3.5 flex-1">
                      {s.min < 0 && <span className="absolute inset-y-[-3px] w-px bg-viz-axis" style={{ left: `${z}%` }} />}
                      {v != null && (
                        <span
                          className="absolute inset-y-0 rounded-[3px]"
                          style={{
                            left: `${Math.min(z, e)}%`,
                            width: `${Math.max(0.6, Math.abs(e - z))}%`,
                            background: p.color,
                            opacity: hover && !isHover ? 0.45 : 1,
                          }}
                        />
                      )}
                    </div>
                    <span className="hidden w-11 shrink-0 text-right text-[11px] tabular sm:block">{fmt(p, v)}</span>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
        <span>
          {mode === "change"
            ? "Changes are per day vs the same number of days before — observed, not adjusted for the market trend."
            : mode === "perDay"
              ? "Per day, so promos of different lengths compare fairly. One scale for all three charts."
              : "One scale for all three charts. Before and after cover the same number of days as the promo."}
          {withData.length < list.length && ` ${list.length - withData.length} without GGR yet not shown.`}
        </span>
        {sorted.length > limit && (
          <button onClick={() => setAll((v) => !v)} className="text-primary hover:underline">
            {all ? "Show fewer" : `Show all ${sorted.length}`}
          </button>
        )}
      </div>

      {hovered && hover && (
        <div
          className="pointer-events-none absolute z-20 w-60 rounded-lg border border-border bg-popover p-2.5 text-xs shadow-lg"
          style={{ left: Math.min(hover.x + 14, (box.current?.clientWidth ?? 600) - 250), top: hover.y + 14 }}
        >
          <p className="font-semibold text-foreground">{hovered.promo.name}</p>
          <p className="mb-1.5 text-[11px] text-muted-foreground">
            {hovered.promo.operator} · {formatRange(hovered.promo.startDate, hovered.promo.endDate)} · {hovered.promoDays} d
          </p>
          {(["before", "during", "after"] as const).map((k) => {
            const tot = k === "before" ? hovered.ggrBefore : k === "during" ? hovered.ggrDuring : hovered.ggrAfter;
            const days = k === "during" ? hovered.promoDays : hovered.windowDays;
            return (
              <p key={k} className="flex items-center justify-between gap-2 tabular">
                <span className="flex items-center gap-1.5 capitalize text-muted-foreground">
                  <span className="size-2 rounded-sm" style={{ background: PHASE_COLORS[k] }} />
                  {k}
                </span>
                <span title={tot == null ? undefined : moneyFull(tot, currency)}>
                  {money(tot, currency)} <span className="text-muted-foreground">· {money(per(tot, days), currency)}/d</span>
                </span>
              </p>
            );
          })}
          <p className="mt-1 flex justify-between border-t border-border pt-1 tabular">
            <span className="text-muted-foreground">During vs before</span>
            <span className="font-medium">{pct(hovered.duringVsBefore)}</span>
          </p>
          <p className="flex justify-between tabular">
            <span className="text-muted-foreground">After vs before</span>
            <span className="font-medium">{pct(hovered.afterVsBefore)}</span>
          </p>
        </div>
      )}
    </div>
  );
}
