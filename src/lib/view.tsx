import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { emptyFilters, applyFilters, normalizeFilters, type FilterState } from "./filters";
import type { PromoMetrics } from "./metrics";

/**
 * What the user is looking at — filters and period — shared by Overview,
 * Promotions and Calendar so moving between them keeps the same selection.
 * Remembered in this browser.
 */

export type PeriodMode = "month" | "all" | "range";

export interface ViewState {
  filters: FilterState;
  mode: PeriodMode;
  /** YYYY-MM, null = latest month with finished promos */
  month: string | null;
  /** YYYY-MM-DD, for mode "range" */
  from: string;
  to: string;
  filtersOpen: boolean;
  group: "none" | "market" | "aggregator" | "operator" | "type";
  sort: "newest" | "change" | "ggr" | "name";
  /** Explore → Promotions: compact list, full metrics table, or grouped cards */
  layout: "compact" | "table" | "grouped";
  /** Metrics shown in the Explore promo charts */
  promoCharts: string[];
  /** Overview → metrics comparison (Before / During / After) */
  phaseMetrics: string[];
  /** Promos picked for comparison — kept while moving between pages */
  selected: string[];
  /** Main GGR charts: totals, per day, or % change */
  ggrMode: "total" | "perDay" | "change";
}

const KEY = "spribe-report-view-v2";

const DEFAULTS: ViewState = { filters: emptyFilters, mode: "month", month: null, from: "", to: "", filtersOpen: true, group: "none", sort: "newest", layout: "compact", promoCharts: ["bda"], phaseMetrics: ["wager", "ggr", "rtp"], selected: [], ggrMode: "total" };

function load(): ViewState {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "null");
    if (raw && typeof raw === "object")
      return {
        ...DEFAULTS,
        ...raw,
        filters: normalizeFilters(raw.filters),
        promoCharts: Array.isArray(raw.promoCharts) ? raw.promoCharts : typeof raw.promoChartMetric === "string" ? [raw.promoChartMetric] : ["bda"],
        selected: Array.isArray(raw.selected) ? raw.selected.filter((x: unknown) => typeof x === "string") : [],
        // The old Promotions "list" layout is now "grouped"
        layout: raw.layout === "list" ? "grouped" : raw.layout === "table" || raw.layout === "compact" || raw.layout === "grouped" ? raw.layout : "compact",
      };
  } catch {
    // defaults
  }
  return DEFAULTS;
}

interface ViewValue {
  view: ViewState;
  set: (patch: Partial<ViewState>) => void;
  /** Add or remove one promo from the comparison selection */
  toggleSelect: (id: string) => void;
  setSelected: (ids: string[]) => void;
}

const Ctx = createContext<ViewValue | null>(null);

export function ViewProvider({ children }: { children: ReactNode }) {
  const [view, setView] = useState<ViewState>(load);
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(view));
    } catch {
      // convenience only
    }
  }, [view]);
  return (
    <Ctx.Provider
      value={{
        view,
        set: (patch) => setView((v) => ({ ...v, ...patch })),
        toggleSelect: (id) => setView((v) => ({ ...v, selected: v.selected.includes(id) ? v.selected.filter((x) => x !== id) : [...v.selected, id] })),
        setSelected: (ids) => setView((v) => ({ ...v, selected: [...new Set(ids)] })),
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useView() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useView must be used within ViewProvider");
  return ctx;
}

/** Promos that overlap the date range (any day in common). */
export function inRange(m: PromoMetrics, from: string, to: string): boolean {
  if (from && m.promo.endDate < from) return false;
  if (to && m.promo.startDate > to) return false;
  return true;
}

/** Filters + period applied, plus the matching "previous period" for comparisons. */
export function selectPeriod(all: PromoMetrics[], view: ViewState, month: string) {
  const filtered = applyFilters(all, view.filters);
  if (view.mode === "all") return { filtered, shown: filtered, previous: null as PromoMetrics[] | null };
  if (view.mode === "range") {
    return { filtered, shown: filtered.filter((m) => inRange(m, view.from, view.to)), previous: null };
  }
  const prev = (() => {
    const [y, mo] = month.split("-").map(Number);
    return new Date(Date.UTC(y, mo - 2, 1)).toISOString().slice(0, 7);
  })();
  return { filtered, shown: filtered.filter((m) => m.month === month), previous: filtered.filter((m) => m.month === prev) };
}
