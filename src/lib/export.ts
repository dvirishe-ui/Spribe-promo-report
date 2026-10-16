import { toCsv } from "./csv";
import { STATUS_LABEL, type PromoMetrics } from "./metrics";

/**
 * Report exports: computed results per promo, in the display currency, using
 * the same calculations as the screen. (The Data page exports the raw inputs.)
 */
export function resultsCsv(list: PromoMetrics[], currency: string): string {
  const r = (v: number | null | undefined, digits = 0) => (v == null || !Number.isFinite(v) ? "" : v.toFixed(digits));
  const pctOut = (v: number | null | undefined, digits = 1) => r(v == null ? null : v * 100, digits);
  return toCsv(
    [
      "Promotion",
      "Aggregator",
      "Operator",
      "Type",
      `Promo Contribution (${currency})`,
      `GGR Before (${currency})`,
      `GGR During (${currency})`,
      `GGR After (${currency})`,
      "During vs Before (%)",
      "After vs Before (%)",
      `Total Wager (${currency})`,
      "Part. Rate (%)",
      "RTP (%)",
      "Promo ROI (x)",
      "Status",
      "Market",
      "Games",
      "Start date",
      "End date",
      "Comparison days",
      "Entered currency",
      "GGR change used in headline (%)",
      "Adjusted for market trend",
      "Participants",
      `Extra GGR (${currency})`,
      `Net impact (${currency})`,
      "Note",
    ],
    list.map((m) => [
      m.promo.name,
      m.promo.aggregator,
      m.promo.operator,
      m.promo.type,
      r(m.promo.prizePool),
      r(m.ggrBefore),
      r(m.ggrDuring),
      r(m.ggrAfter),
      pctOut(m.duringVsBefore),
      pctOut(m.afterVsBefore),
      r(m.turnoverDuring),
      pctOut(m.participationRate),
      pctOut(m.rtp, 2),
      r(m.promoRoi, 2),
      STATUS_LABEL[m.status],
      m.promo.market,
      m.promo.games.join("|"),
      m.promo.startDate,
      m.promo.endDate,
      m.windowDays,
      m.promo.currency || currency,
      pctOut(m.primaryChange),
      m.primaryChange == null ? "" : m.isAdjusted ? "yes" : "no",
      r(m.participants),
      r(m.incrementalGgr == null ? null : m.incrementalGgr + (m.haloGgr ?? 0)),
      r(m.netImpact),
      [
        m.promo.fxMissing ? `no exchange rate for ${m.promo.currency}` : m.status !== "complete" ? "results not final" : "",
        m.rtpReported ? "RTP reported by Back Office" : "",
        m.participationReported ? "Part. rate reported by Back Office" : "",
      ]
        .filter(Boolean)
        .join("; "),
    ]),
  );
}
