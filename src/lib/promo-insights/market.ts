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

/* ------------------------------------------------------- promo vs market */

export interface MarketComparison {
  source: MarketSource;
  /** The market's change, as a fraction */
  market: number;
  /** What the market figure measures, e.g. "Market GGR" or "Blask Index (search demand)" */
  measure: string;
  /** True when the market figure measures the same thing as the promo's (GGR) */
  sameMeasure: boolean;
}

/**
 * The single best market figure to set against the promo's GGR change: a
 * market GGR trend first, then a market activity index, then the promo's own
 * comparison group.
 */
export function pickMarketComparison(ctx: MarketContext): MarketComparison | null {
  const ggr = ctx.sources.find((s) => s.kind === "market" && s.changes.ggr != null);
  if (ggr) return { source: ggr, market: ggr.changes.ggr!, measure: "Market GGR", sameMeasure: true };
  const act = ctx.sources.find((s) => s.kind === "market" && s.activity);
  if (act) return { source: act, market: act.activity!.change, measure: act.activity!.label, sameMeasure: false };
  const cg = ctx.sources.find((s) => s.kind === "comparison" && s.changes.ggr != null);
  if (cg) return { source: cg, market: cg.changes.ggr!, measure: "Comparison group GGR", sameMeasure: true };
  return null;
}

export type MarketVerdictKind =
  | "market-wide-drop"
  | "held-up"
  | "fell-more"
  | "promo-specific-drop"
  | "grew-while-market-fell"
  | "held-steady"
  | "flat-while-market-grew"
  | "with-market"
  | "beat-growing"
  | "behind-growing";

export interface MarketVerdict {
  kind: MarketVerdictKind;
  tone: "good" | "bad" | "mixed" | "neutral";
  title: string;
  text: string;
  /** Promo change − market change, in percentage points */
  gapPp: number;
}

const pctWord = (v: number) => `${Math.abs(v * 100).toFixed(1)}%`;

/**
 * Is it the promo or the market? Compares the promo's GGR change with the
 * market's over the same days. `tolPp` is how close counts as "the same";
 * `flat` is the smallest promo change treated as a real move. Wording states
 * what the numbers show, never a cause.
 */
export function marketVerdict(promo: number, market: number, sameMeasure: boolean, tolPp: number, flat: number): MarketVerdict {
  const gapPp = (promo - market) * 100;
  const close = Math.abs(gapPp) < tolPp;
  const mk = sameMeasure ? "the market" : "market activity";
  const v = (kind: MarketVerdictKind, tone: MarketVerdict["tone"], title: string, text: string): MarketVerdict => ({ kind, tone, title, text, gapPp });
  if (Math.abs(promo) < flat) {
    if (gapPp >= tolPp) return v("held-steady", "good", `Held steady while ${mk} fell`, `${cap(mk)} fell ${pctWord(market)} over the same days, while this promo's GGR was about flat (${sign(promo)}).`);
    if (gapPp <= -tolPp) return v("flat-while-market-grew", "bad", `Flat while ${mk} grew`, `${cap(mk)} grew ${pctWord(market)}, but this promo's GGR was about flat (${sign(promo)}) — it didn't keep up.`);
    return v("with-market", "neutral", `Moved with ${mk}`, `Both were about flat: promo ${sign(promo)}, ${mk} ${sign(market)}.`);
  }
  if (promo < 0) {
    if (market < 0 && close)
      return v("market-wide-drop", "neutral", "Market-wide drop", `${cap(mk)} fell ${pctWord(market)} and this promo fell ${pctWord(promo)} — about the same, so the drop looks market-wide rather than specific to this promo.`);
    if (market < 0 && gapPp > 0)
      return v("held-up", "mixed", "Market drop — the promo held up better", `${cap(mk)} fell ${pctWord(market)}; this promo fell only ${pctWord(promo)}, ${Math.abs(gapPp).toFixed(1)} pp better than ${mk}.`);
    if (market < 0)
      return v("fell-more", "bad", `Fell more than ${mk}`, `${cap(mk)} fell ${pctWord(market)}, but this promo fell ${pctWord(promo)} — ${Math.abs(gapPp).toFixed(1)} pp worse, so it isn't only the market.`);
    return v(
      "promo-specific-drop",
      "bad",
      "Promo-specific drop",
      `${cap(mk)} ${Math.abs(market) < flat ? `was about flat (${sign(market)})` : `grew ${pctWord(market)}`} while this promo fell ${pctWord(promo)} — the drop isn't explained by ${mk}.`,
    );
  }
  if (market < 0) return v("grew-while-market-fell", "good", `Grew while ${mk} fell`, `${cap(mk)} fell ${pctWord(market)}, but this promo grew ${pctWord(promo)} — ${gapPp.toFixed(1)} pp ahead.`);
  if (close) return v("with-market", "neutral", `Moved with ${mk}`, `This promo grew ${pctWord(promo)} and ${mk} ${pctWord(market)} — about the same, so the growth may be largely market-wide.`);
  if (gapPp > 0) return v("beat-growing", "good", `Beat a growing ${sameMeasure ? "market" : "market activity"}`, `This promo grew ${pctWord(promo)} against ${pctWord(market)} for ${mk} — ${gapPp.toFixed(1)} pp ahead.`);
  return v("behind-growing", "mixed", `Grew, but less than ${mk}`, `This promo grew ${pctWord(promo)}, but ${mk} grew ${pctWord(market)} — ${Math.abs(gapPp).toFixed(1)} pp behind.`);
}

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
const sign = (v: number) => `${v > 0.0005 ? "+" : v < -0.0005 ? "−" : ""}${Math.abs(v * 100).toFixed(1)}%`;
