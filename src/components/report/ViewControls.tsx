import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight, RotateCcw, Search, SlidersHorizontal, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { MultiSelect } from "./MultiSelect";
import { FILTER_KEYS, emptyFilters, filterCount, type FilterKey, type FilterState } from "@/lib/filters";
import { formatRange, monthLabel, nextMonth, prevMonth, todayIso } from "@/lib/dates";
import { marketLabel } from "@/lib/markets";
import type { PromoMetrics } from "@/lib/metrics";
import { useView, type PeriodMode } from "@/lib/view";
import { cn } from "@/lib/utils";

/** Latest month with finished promos — the default month to open on. */
export function defaultMonth(metrics: PromoMetrics[]): string {
  return (
    [...metrics].filter((m) => m.status === "complete").sort((a, b) => b.month.localeCompare(a.month))[0]?.month ??
    [...metrics].sort((a, b) => b.month.localeCompare(a.month))[0]?.month ??
    todayIso().slice(0, 7)
  );
}

export function periodName(mode: PeriodMode, month: string, from: string, to: string): string {
  if (mode === "all") return "All time";
  if (mode === "range") return from || to ? formatRange(from || "…", to || "…").replace("…", "start") : "Pick dates";
  return monthLabel(month, "long");
}

const LABEL: Record<FilterKey, string> = { market: "Market", operator: "Operator", aggregator: "Aggregator", type: "Type", game: "Game" };
/** Shown as their own dropdowns on wide screens; inside "More filters" on narrower ones. */
const SECONDARY: FilterKey[] = ["aggregator", "type", "game"];

function options(all: PromoMetrics[], key: FilterKey): string[] {
  const vals = key === "game" ? all.flatMap((m) => m.promo.games) : all.map((m) => (key === "aggregator" ? m.promo.aggregator || "—" : m.promo[key]));
  return [...new Set(vals.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

/** Compact page title row: title on the left, page actions on the right. */
export function PageHeader({ title, children, after }: { title: ReactNode; children?: ReactNode; after?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
      <div className="flex min-w-0 items-center gap-3">
        <h1 className="font-display text-2xl font-bold leading-tight">
          <span className="brand-gradient-text">{title}</span>
        </h1>
        {after}
      </div>
      {children && <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

function PeriodControl({ month, hidePeriod }: { month: string; hidePeriod: boolean }) {
  const { view, set } = useView();
  if (hidePeriod) return null;
  const seg = (m: PeriodMode, label: string) => (
    <button
      onClick={() => set({ mode: m })}
      className={cn("h-6 rounded px-2 text-xs transition-colors", view.mode === m ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
    >
      {label}
    </button>
  );
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex h-8 items-center gap-0.5 rounded-md border border-border bg-surface-raised p-0.5">
        {seg("month", "Month")}
        {seg("range", "Dates")}
        {seg("all", "All")}
      </div>
      {view.mode === "month" && (
        <div className="flex h-8 items-center rounded-md border border-border bg-surface">
          <button aria-label="Previous month" onClick={() => set({ month: prevMonth(month) })} className="grid h-full w-7 place-items-center text-muted-foreground hover:text-foreground">
            <ChevronLeft className="size-4" />
          </button>
          <span className="min-w-[6.5rem] text-center text-xs font-semibold">{monthLabel(month, "long")}</span>
          <button aria-label="Next month" onClick={() => set({ month: nextMonth(month) })} className="grid h-full w-7 place-items-center text-muted-foreground hover:text-foreground">
            <ChevronRight className="size-4" />
          </button>
        </div>
      )}
      {view.mode === "range" && (
        <div className="flex items-center gap-1 text-xs">
          <input type="date" aria-label="From" className="h-8 rounded-md border border-border bg-surface px-1.5" value={view.from} onChange={(e) => set({ from: e.target.value })} />
          <span className="text-muted-foreground">–</span>
          <input type="date" aria-label="To" className="h-8 rounded-md border border-border bg-surface px-1.5" value={view.to} min={view.from || undefined} onChange={(e) => set({ to: e.target.value })} />
        </div>
      )}
    </div>
  );
}

/** Active filters as removable chips, one per chosen value. */
function FilterChips({ filters, onChange }: { filters: FilterState; onChange: (f: FilterState) => void }) {
  const chips: Array<{ key: string; label: string; remove: () => void }> = [];
  if (filters.q.trim()) chips.push({ key: "q", label: `“${filters.q.trim()}”`, remove: () => onChange({ ...filters, q: "" }) });
  for (const k of FILTER_KEYS)
    for (const v of filters[k])
      chips.push({ key: `${k}:${v}`, label: k === "market" ? marketLabel(v) : v, remove: () => onChange({ ...filters, [k]: filters[k].filter((x) => x !== v) }) });
  if (!chips.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-1">
      {chips.map((c) => (
        <button key={c.key} onClick={c.remove} className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[11px] hover:bg-primary/20">
          {c.label}
          <X className="size-3" />
        </button>
      ))}
      <button onClick={() => onChange(emptyFilters)} className="inline-flex items-center gap-1 px-1.5 text-[11px] text-muted-foreground hover:text-foreground">
        <RotateCcw className="size-3" /> Reset
      </button>
    </div>
  );
}

/**
 * One compact bar under the page title: period, search and multi-select
 * filters, with chosen values as chips below. Shared across pages.
 */
export function FilterBar({ metrics, month, count, hidePeriod = false }: { metrics: PromoMetrics[]; month: string; count: number; hidePeriod?: boolean }) {
  const { view, set } = useView();
  const f = view.filters;
  const onChange = (next: FilterState) => set({ filters: next });
  const select = (k: FilterKey, className?: string) => (
    <MultiSelect
      key={k}
      label={LABEL[k]}
      options={options(metrics, k)}
      value={f[k]}
      onChange={(v) => onChange({ ...f, [k]: v })}
      display={k === "market" ? marketLabel : undefined}
      className={className}
    />
  );
  const secondaryActive = SECONDARY.reduce((n, k) => n + f[k].length, 0);

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <PeriodControl month={month} hidePeriod={hidePeriod} />
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            aria-label="Search promos"
            className="h-8 w-36 rounded-md border border-border bg-surface pl-7 pr-2 text-xs outline-none placeholder:text-muted-foreground/70 focus:ring-2 focus:ring-ring lg:w-44"
            placeholder="Search promos"
            value={f.q}
            onChange={(e) => onChange({ ...f, q: e.target.value })}
          />
        </div>
        {select("market")}
        {select("operator")}
        {SECONDARY.map((k) => select(k, "hidden xl:inline-flex"))}
        <Popover>
          <PopoverTrigger asChild>
            <button
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs xl:hidden",
                secondaryActive ? "border-primary/60 bg-primary/10" : "border-border bg-surface text-muted-foreground hover:text-foreground",
              )}
            >
              <SlidersHorizontal className="size-3.5" /> More{secondaryActive ? ` · ${secondaryActive}` : ""}
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="flex w-auto flex-col gap-1.5 p-2">
            {SECONDARY.map((k) => select(k, "max-w-none w-full justify-between"))}
          </PopoverContent>
        </Popover>
        <span className="ml-auto text-xs text-muted-foreground">
          {count} promo{count === 1 ? "" : "s"}
        </span>
      </div>
      {filterCount(f) > 0 && <FilterChips filters={f} onChange={onChange} />}
    </div>
  );
}

/** Filter bar above a page's content (no sidebar — content gets the full width). */
export function FilterLayout({
  metrics,
  month,
  count,
  children,
  hidePeriod = false,
}: {
  /** All promos, to build filter options */
  metrics: PromoMetrics[];
  month: string;
  /** Number of promos in view */
  count: number;
  children: ReactNode;
  hidePeriod?: boolean;
}) {
  return (
    <div className="space-y-3">
      <FilterBar metrics={metrics} month={month} count={count} hidePeriod={hidePeriod} />
      {children}
    </div>
  );
}
