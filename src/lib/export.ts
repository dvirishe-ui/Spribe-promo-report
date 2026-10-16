import { toCsv } from "./csv";
import { STATUS_LABEL, type PromoMetrics } from "./metrics";

/**
 * Report exports: computed results per promo, in the display currency, using
 * the same calculations as the screen. (The Data page exports the raw inputs.)
 */
export function resultsCsv(list: PromoMetrics[], currency: string): string {
  const r = (v: number | null | undefined, digits = 0) => (v == null || !Number.isFinite(v) ? "" : v.toFixed(digits));
  return toCsv(
    [
      "promo",
      "status",
      "type",
      "market",
      "operator",
      "aggregator",
      "games",
      "start_date",
      "end_date",
      "comparison_days",
      "entered_currency",
      `ggr_before_${currency}`,
      `ggr_during_${currency}`,
      `ggr_after_${currency}`,
      "ggr_change_pct",
      "change_adjusted_for_market_trend",
      "after_vs_before_pct",
      "participants",
      `promo_cost_${currency}`,
      `extra_ggr_${currency}`,
      `net_impact_${currency}`,
      "roi",
      "note",
    ],
    list.map((m) => [
      m.promo.name,
      STATUS_LABEL[m.status],
      m.promo.type,
      m.promo.market,
      m.promo.operator,
      m.promo.aggregator,
      m.promo.games.join("|"),
      m.promo.startDate,
      m.promo.endDate,
      m.windowDays,
      m.promo.currency || currency,
      r(m.ggrBefore),
      r(m.ggrDuring),
      r(m.ggrAfter),
      r(m.primaryChange == null ? null : m.primaryChange * 100, 1),
      m.primaryChange == null ? "" : m.isAdjusted ? "yes" : "no",
      r(m.afterVsBefore == null ? null : m.afterVsBefore * 100, 1),
      r(m.participants),
      r(m.promo.prizePool),
      r(m.incrementalGgr == null ? null : m.incrementalGgr + (m.haloGgr ?? 0)),
      r(m.netImpact),
      r(m.roi, 2),
      m.promo.fxMissing ? `no exchange rate for ${m.promo.currency}` : m.status !== "complete" ? "results not final" : "",
    ]),
  );
}
