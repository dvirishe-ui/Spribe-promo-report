import { useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, PanelLeftClose, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ReportFilters } from "@/components/report/ReportFilters";
import { ActiveFilters } from "@/components/report/PromoListing";
import { filterCount } from "@/lib/filters";
import { formatRange, monthLabel, nextMonth, prevMonth, todayIso } from "@/lib/dates";
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

/**
 * Collapsible filter sidebar + period bar + active filter chips around a page's
 * main content. Filters and period are shared across pages (see lib/view).
 */
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
  /** Number of promos in view, shown next to the period */
  count: number;
  children: ReactNode;
  hidePeriod?: boolean;
}) {
  const { view, set } = useView();
  const [mobileOpen, setMobileOpen] = useState(false);
  const n = filterCount(view.filters);

  return (
    <div className={cn("grid gap-4 lg:items-start", view.filtersOpen ? "lg:grid-cols-[250px_1fr]" : "lg:grid-cols-1")}>
      <aside className={cn("lg:sticky lg:top-20", mobileOpen ? "block" : "hidden", view.filtersOpen ? "lg:block" : "lg:hidden")}>
        <ReportFilters filters={view.filters} onChange={(f) => set({ filters: f })} all={metrics} />
        <button
          onClick={() => set({ filtersOpen: false })}
          className="mt-2 hidden w-full items-center justify-center gap-1.5 rounded-md py-1.5 text-xs text-muted-foreground transition-colors hover:bg-surface-raised hover:text-foreground lg:flex"
        >
          <PanelLeftClose className="size-3.5" /> Hide filters
        </button>
      </aside>

      <div className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {!hidePeriod && view.mode === "month" && (
              <>
                <Button variant="outline" size="icon" aria-label="Previous month" onClick={() => set({ month: prevMonth(month) })}>
                  <ChevronLeft className="size-4" />
                </Button>
                <Button variant="outline" size="icon" aria-label="Next month" onClick={() => set({ month: nextMonth(month) })}>
                  <ChevronRight className="size-4" />
                </Button>
              </>
            )}
            {!hidePeriod && view.mode === "range" && (
              <div className="flex items-center gap-1.5 text-sm">
                <input
                  type="date"
                  aria-label="From"
                  className="h-9 rounded-md border border-border bg-surface-raised px-2"
                  value={view.from}
                  onChange={(e) => set({ from: e.target.value })}
                />
                <span className="text-muted-foreground">to</span>
                <input
                  type="date"
                  aria-label="To"
                  className="h-9 rounded-md border border-border bg-surface-raised px-2"
                  value={view.to}
                  min={view.from || undefined}
                  onChange={(e) => set({ to: e.target.value })}
                />
              </div>
            )}
            {!hidePeriod && view.mode !== "range" && (
              <h2 className="ml-1 font-display text-xl font-semibold">{periodName(view.mode, month, view.from, view.to)}</h2>
            )}
            <span className="text-xs text-muted-foreground">
              {count} promo{count === 1 ? "" : "s"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="lg:hidden" onClick={() => setMobileOpen((v) => !v)}>
              <SlidersHorizontal className="size-3.5" /> Filters{n ? ` (${n})` : ""}
            </Button>
            {!view.filtersOpen && (
              <Button variant="outline" size="sm" className="hidden lg:inline-flex" onClick={() => set({ filtersOpen: true })}>
                <SlidersHorizontal className="size-3.5" /> Filters{n ? ` (${n})` : ""}
              </Button>
            )}
            {!hidePeriod && (
              <Tabs value={view.mode} onValueChange={(v) => set({ mode: v as PeriodMode })}>
                <TabsList>
                  <TabsTrigger value="month">Month</TabsTrigger>
                  <TabsTrigger value="range">Dates</TabsTrigger>
                  <TabsTrigger value="all">All</TabsTrigger>
                </TabsList>
              </Tabs>
            )}
          </div>
        </div>

        {n > 0 && <ActiveFilters filters={view.filters} onChange={(f) => set({ filters: f })} />}

        {children}
      </div>
    </div>
  );
}
