import { toCsv } from "./csv";
import { STATUS_LABEL, type PromoMetrics } from "./metrics";
import { PHASE_METRICS, phaseValues } from "./phases";

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

/** One row per promo and metric: Before / During / After and the changes — the Explore promo tables as CSV. */
export function phaseCsv(list: PromoMetrics[], currency: string): string {
  const rows: unknown[][] = [];
  for (const m of list)
    for (const metric of PHASE_METRICS) {
      const v = phaseValues(metric, [m]);
      if (!v.n) continue;
      const val = (x: number | null) => (x == null ? "" : metric.unit === "pct" ? (x * 100).toFixed(2) : metric.unit === "avg" ? x.toFixed(2) : Math.round(x));
      const ch = (x: number | null) => (x == null || v.before == null ? "" : metric.unit === "pct" ? ((x - v.before) * 100).toFixed(2) : v.before > 0 ? ((x / v.before - 1) * 100).toFixed(1) : "");
      rows.push([m.promo.name, m.promo.operator, m.promo.market, m.promo.startDate, m.promo.endDate, metric.label, val(v.before), val(v.during), val(v.after), ch(v.during), ch(v.after)]);
    }
  return toCsv(
    ["Promotion", "Operator", "Market", "Start date", "End date", "Metric", `Before (${currency} / count / %)`, "During", "After", "During vs Before (% or pts for RTP)", "After vs Before (% or pts for RTP)"],
    rows,
  );
}
