import type { PromoMetrics } from "./metrics";

/** Filter values shared by every list and chart. An empty list = no filter on that dimension. */
export interface FilterState {
  q: string;
  market: string[];
  aggregator: string[];
  operator: string[];
  type: string[];
  game: string[];
}

export type FilterKey = Exclude<keyof FilterState, "q">;
export const FILTER_KEYS: FilterKey[] = ["market", "operator", "aggregator", "type", "game"];

export const emptyFilters: FilterState = { q: "", market: [], aggregator: [], operator: [], type: [], game: [] };

/** Accepts the older single-value shape ("all" or one value) saved in browsers. */
export function normalizeFilters(raw: unknown): FilterState {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const list = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : typeof v === "string" && v && v !== "all" ? [v] : []);
  return {
    q: typeof r.q === "string" ? r.q : "",
    market: list(r.market),
    aggregator: list(r.aggregator),
    operator: list(r.operator),
    type: list(r.type),
    game: list(r.game),
  };
}

export function applyFilters(list: PromoMetrics[], f: FilterState): PromoMetrics[] {
  const q = f.q.trim().toLowerCase();
  return list.filter(({ promo: p }) => {
    if (f.market.length && !f.market.includes(p.market)) return false;
    if (f.aggregator.length && !f.aggregator.includes(p.aggregator || "—")) return false;
    if (f.operator.length && !f.operator.includes(p.operator)) return false;
    if (f.type.length && !f.type.includes(p.type)) return false;
    if (f.game.length && !p.games.some((g) => f.game.includes(g))) return false;
    if (q && ![p.name, p.operator, p.aggregator, p.market, p.type, ...p.games].join(" ").toLowerCase().includes(q)) return false;
    return true;
  });
}

export function filterCount(f: FilterState): number {
  return (f.q.trim() ? 1 : 0) + FILTER_KEYS.reduce((n, k) => n + f[k].length, 0);
}

/** Add the value if missing, remove it if present. */
export function toggleValue(f: FilterState, key: FilterKey, value: string): FilterState {
  const cur = f[key];
  return { ...f, [key]: cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value] };
}
