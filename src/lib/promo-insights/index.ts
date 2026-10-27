import type { PromoMetrics } from "../metrics";
import { formatDay } from "../dates";
import { num } from "../format";
import type { MarketTrend } from "../types";
import { DEFAULT_INSIGHT_CONFIG, type InsightConfig } from "./config";
import { promoFacts, type MetricKey, type PromoFacts } from "./facts";
import { marketContext, type MarketContext, type QualityNote } from "./market";
import { RULES, type PromoInsight, type Severity } from "./rules";

/**
 * Automatic promo insights.
 *
 *   report data → calculated metrics (facts.ts, per-day normalization)
 *               → market context (market.ts)
 *               → rule engine (rules.ts)
 *               → structured, ranked insights + data-quality notes
 *               → automatic summary (deterministic sentences)
 *
 * No AI is involved: every number is calculated here and every insight carries
 * the calculation behind it. An AI layer could later re-word or order these,
 * but must never change the numbers.
 */

export type { PromoInsight, Severity, CalcBlock } from "./rules";
export type { MarketContext, MarketSource, QualityNote } from "./market";
export { DEFAULT_INSIGHT_CONFIG, type InsightConfig } from "./config";

export interface InsightReport {
  /** Every insight, most important first */
  insights: PromoInsight[];
  /** The first `maxInsights` */
  top: PromoInsight[];
  /** 3–5 factual sentences */
  summary: string[];
  market: MarketContext;
  quality: QualityNote[];
  facts: PromoFacts;
}

export interface InsightOptions {
  currency: string;
  marketTrends?: MarketTrend[];
  peers?: PromoMetrics[];
  config?: Partial<InsightConfig>;
}

function qualityChecks(f: PromoFacts, config: InsightConfig): QualityNote[] {
  const { m } = f;
  const p = m.promo;
  const out: QualityNote[] = [];
  const add = (id: string, level: QualityNote["level"], text: string) => out.push({ id, level, text });

  if (m.status === "live") add("live", "warn", "The promo is still running: during numbers are so far, and nothing here is final.");
  if (m.status === "measuring") add("measuring", "info", `The after window runs until ${formatDay(m.afterEnd, true)}, so after-promo comparisons are skipped until then.`);
  if (p.fxMissing) add("fx", "warn", `No exchange rate for ${p.currency}: money figures are hidden, so money-based insights are skipped.`);
  if (m.ggrBefore == null) add("ggr-before", "warn", "GGR before the promo is missing, so GGR changes can't be calculated.");
  else if (m.ggrBefore <= 0) add("ggr-before-zero", "warn", "GGR before the promo is zero or negative, so a % change can't be calculated (division by zero).");
  if (m.ggrDuring == null && m.status !== "live") add("ggr-during", "warn", "GGR during the promo is missing.");
  if (m.ggrAfter == null && m.status === "complete") add("ggr-after", "warn", "GGR after the promo is missing, so the after-promo pattern can't be checked.");
  if (m.partialDuring) add("partial-during", "warn", "GGR during the promo comes from a daily series that doesn't cover every day; it's compared per day.");
  if (m.partialAfter) add("partial-after", "info", "The after window's daily GGR is incomplete, so after-promo comparisons are skipped.");
  if (f.unequalWindows)
    add(
      "unequal",
      "info",
      `Before/after windows are ${m.windowDays} days and the promo is ${m.promoDays}: GGR, wager and bets are compared per day (raw totals would mislead), and active players aren't compared.`,
    );
  const missing = [
    m.turnoverBefore == null || m.turnoverDuring == null ? "wager" : null,
    p.totalBetsBefore == null || p.totalBetsDuring == null ? "number of bets" : null,
    p.playersBefore == null || p.playersDuring == null ? "active players" : null,
    m.participants == null ? "participants" : null,
  ].filter(Boolean);
  if (missing.length) add("missing", "info", `Not reported for both before and during: ${missing.join(", ")}. Insights that need them are skipped.`);
  const small = [
    p.playersDuring != null && p.playersDuring < config.minimumSampleSize ? `${num(p.playersDuring)} active players` : null,
    m.participants != null && m.participants < config.minimumSampleSize ? `${num(m.participants)} participants` : null,
  ].filter(Boolean);
  if (small.length) add("small", "warn", `Small sample: only ${small.join(" and ")} during the promo (below ${config.minimumSampleSize}). Percentages can swing a lot on numbers this small.`);
  if (m.participationReported) add("part-reported", "info", "Participation rate is as reported by the Back Office (participants or active players are missing, so it isn't calculated here).");
  return out;
}

/** 3–5 factual sentences, in the order a reader needs them. */
function summarize(list: PromoInsight[]): string[] {
  const first = (pred: (i: PromoInsight) => boolean) => list.find(pred);
  const picks = [
    first((i) => i.type === "participation"),
    first((i) => i.type === "cross_metric"),
    first((i) => i.type === "market_relative" && i.id.startsWith("market-ggr")) ?? first((i) => i.id === "move-ggr"),
    first((i) => i.type === "market_relative" && !i.id.startsWith("market-ggr")),
    first((i) => i.type === "pattern"),
    first((i) => i.type === "game"),
  ].filter((i): i is PromoInsight => !!i);
  return [...new Set(picks)].slice(0, 5).map((i) => i.summary);
}

export function buildPromoInsights(m: PromoMetrics, opts: InsightOptions): InsightReport {
  const config = { ...DEFAULT_INSIGHT_CONFIG, ...opts.config };
  const facts = promoFacts(m, opts.currency);
  const market = marketContext(m, opts.marketTrends ?? [], config);
  const quality = [...qualityChecks(facts, config), ...market.notes];

  if (m.status === "upcoming") {
    return { insights: [], top: [], summary: [], market, quality: [{ id: "upcoming", level: "info", text: "This promo hasn't started yet — insights appear once there are numbers." }], facts };
  }

  const covered = new Set<MetricKey>();
  const insights = RULES.flatMap((rule) => rule({ f: facts, market, peers: opts.peers ?? [], config }, covered)).sort((a, b) => b.priority - a.priority);

  return {
    insights,
    top: insights.slice(0, config.maxInsights),
    summary: summarize(insights),
    market,
    quality,
    facts,
  };
}

export const SEVERITY_LABEL: Record<Severity, string> = {
  positive: "Positive",
  mixed: "Mixed",
  negative: "Negative",
  neutral: "Info",
};
