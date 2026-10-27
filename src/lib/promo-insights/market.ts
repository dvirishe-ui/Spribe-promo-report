import type { PromoMetrics } from "../metrics";
import { daysBetween, formatDay } from "../dates";
import type { MarketTrend } from "../types";
import type { InsightConfig } from "./config";

/**
 * Market context for one promo: which market numbers cover exactly the promo's
 * windows, where they came from, and — when nothing usable exists — why not.
 *
 * Two kinds of source:
 *  - market trends (e.g. Blask), typed in or delivered by the data source;
 *  - the promo's own comparison group (same games at comparable operators),
 *    which the Back Office already reports as GGR.
 *
 * A trend only counts when its period and baseline match the promo's during and
 * before windows (within `marketPeriodToleranceDays`). Nothing is stretched or
 * guessed to fit.
 */

export type ComparableMetric = "ggr" | "wager" | "bets" | "players";

export interface MarketSource {
  id: string;
  kind: "market" | "comparison";
  /** "Blask", "Comparison group", … */
  provider: string;
  /** How the numbers got here, in words — never "automatic" for typed-in data */
  origin: string;
  market: string;
  period: string;
  baseline: string;
  /** Changes measured on the same metric as ours (directly comparable) */
  changes: Partial<Record<ComparableMetric, number>>;
  /** An activity index — a different measure, compared with care */
  activity?: { change: number; label: string };
  description?: string;
  /** Set when the dates are close but not identical */
  dateNote?: string;
  trendId?: string;
  editable: boolean;
}

export interface QualityNote {
  id: string;
  level: "warn" | "info";
  text: string;
}

export interface MarketContext {
  market: string;
  sources: MarketSource[];
  notes: QualityNote[];
  /** Entries for this market that exist but don't match the promo's dates */
  mismatched: MarketTrend[];
}

export const ORIGIN_LABEL: Record<MarketTrend["origin"], string> = {
  manual: "entered manually",
  api: "delivered by the data source",
  sample: "demo data — fictional",
};

const range = (a: string, b: string) => `${formatDay(a)} – ${formatDay(b, true)}`;
const gap = (a: string, b: string) => Math.abs(daysBetween(a, b) - 1);

export function sameMarket(a: string, b: string) {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

export function marketContext(m: PromoMetrics, trends: MarketTrend[], config: InsightConfig): MarketContext {
  const p = m.promo;
  const sources: MarketSource[] = [];
  const notes: QualityNote[] = [];

  if (m.controlChange != null) {
    sources.push({
      id: "comparison-group",
      kind: "comparison",
      provider: "Comparison group",
      origin: "reported with the promo data",
      market: p.market,
      period: range(p.startDate, p.endDate),
      baseline: range(m.beforeStart, m.beforeEnd),
      changes: { ggr: m.controlChange },
      description: p.controlLabel || "Comparison group (no description)",
      editable: false,
    });
  }

  const candidates = p.market ? trends.filter((t) => sameMarket(t.market, p.market)) : [];
  const scored = candidates
    .map((t) => ({ t, dev: Math.max(gap(t.from, p.startDate), gap(t.to, p.endDate), gap(t.baselineFrom, m.beforeStart), gap(t.baselineTo, m.beforeEnd)) }))
    .sort((a, b) => a.dev - b.dev);
  const matched = scored.filter((x) => x.dev <= config.marketPeriodToleranceDays);
  // One entry per provider: the closest match.
  const seen = new Set<string>();
  for (const { t, dev } of matched) {
    const key = t.provider.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const { activity, ...same } = t.changes;
    const changes = Object.fromEntries(Object.entries(same).filter(([, v]) => v != null && Number.isFinite(v))) as MarketSource["changes"];
    sources.push({
      id: `trend-${t.id}`,
      kind: "market",
      provider: t.provider || "Unnamed source",
      origin: ORIGIN_LABEL[t.origin],
      market: t.market,
      period: range(t.from, t.to),
      baseline: range(t.baselineFrom, t.baselineTo),
      changes,
      activity: activity != null && Number.isFinite(activity) ? { change: activity, label: t.activityLabel || `${t.provider} activity index` } : undefined,
      description: t.note,
      dateNote: dev > 0 ? `Dates are within ${dev} day${dev === 1 ? "" : "s"} of the promo's windows (allowed: ${config.marketPeriodToleranceDays}).` : undefined,
      trendId: t.id,
      editable: t.origin === "manual",
    });
  }

  // Entries far from this promo (another promo's dates) are simply not relevant; only nearby ones get a warning.
  const mismatched = scored
    .filter((x) => x.dev > config.marketPeriodToleranceDays && x.t.from <= m.afterEnd && x.t.to >= m.beforeStart)
    .map((x) => x.t);
  if (!p.market) {
    notes.push({ id: "market-none", level: "info", text: "This promo has no market set, so it can't be compared with a market trend." });
  } else if (!matched.length && mismatched.length) {
    const t = mismatched[0];
    notes.push({
      id: "market-mismatch",
      level: "warn",
      text: `Market comparison unavailable: the ${t.provider} data for ${p.market} covers ${range(t.from, t.to)} (vs ${range(t.baselineFrom, t.baselineTo)}), which doesn't match the promo (${range(p.startDate, p.endDate)} vs ${range(m.beforeStart, m.beforeEnd)}).`,
    });
  } else if (!matched.length) {
    notes.push({
      id: "market-missing",
      level: "info",
      text: `No market trend data for ${p.market} on these dates, so nothing here is compared with the market${m.controlChange != null ? " beyond the comparison group" : ""}.`,
    });
  }
  return { market: p.market, sources, notes, mismatched };
}
