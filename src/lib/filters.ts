import type { PromoMetrics } from "./metrics";

/** Filter values shared by every list and chart. "all" = no filter. */
export interface FilterState {
  q: string;
  market: string;
  aggregator: string;
  operator: string;
  type: string;
  game: string;
}

export const emptyFilters: FilterState = { q: "", market: "all", aggregator: "all", operator: "all", type: "all", game: "all" };

export function applyFilters(list: PromoMetrics[], f: FilterState): PromoMetrics[] {
  const q = f.q.trim().toLowerCase();
  return list.filter(({ promo: p }) => {
    if (f.market !== "all" && p.market !== f.market) return false;
    if (f.aggregator !== "all" && (p.aggregator || "—") !== f.aggregator) return false;
    if (f.operator !== "all" && p.operator !== f.operator) return false;
    if (f.type !== "all" && p.type !== f.type) return false;
    if (f.game !== "all" && !p.games.includes(f.game)) return false;
    if (q && ![p.name, p.operator, p.aggregator, p.market, p.type, ...p.games].join(" ").toLowerCase().includes(q)) return false;
    return true;
  });
}

export function filterCount(f: FilterState): number {
  return (f.q.trim() ? 1 : 0) + (["market", "aggregator", "operator", "type", "game"] as const).filter((k) => f[k] !== "all").length;
}

