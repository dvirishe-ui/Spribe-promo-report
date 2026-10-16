import { aggregate, type PromoMetrics } from "./metrics";
import { money, multiple, num, pct, pctPlain } from "./format";

/**
 * Combined numbers for a group of promos (a month, a filter, a table footer).
 * Money is summed; rates are recalculated from the sums, never averaged, and
 * only over promos that report both parts. Display currency throughout.
 */
export interface Rollup {
  count: number;
  contribution: number | null;
  before: number | null;
  during: number | null;
  after: number | null;
  dvb: number | null;
  avb: number | null;
  wager: number | null;
  part: number | null;
  rtp: number | null;
  roi: number | null;
  participants: number | null;
  extra: number | null;
}

export function rollup(list: PromoMetrics[]): Rollup {
  const sum = (f: (m: PromoMetrics) => number | null | undefined) => {
    const xs = list.map(f).filter((x): x is number => x != null && Number.isFinite(x));
    return xs.length ? xs.reduce((a, b) => a + b, 0) : null;
  };
  const ratio = (f: (m: PromoMetrics) => [number | null | undefined, number | null | undefined]) => {
    const pairs = list.map(f).filter((p): p is [number, number] => p[0] != null && p[1] != null && p[1] > 0);
    const den = pairs.reduce((s, [, d]) => s + d, 0);
    return pairs.length && den > 0 ? pairs.reduce((s, [n]) => s + n, 0) / den : null;
  };
  const a = aggregate(list);
  const rtpRatio = ratio((m) => [m.ggrDuring, m.turnoverDuring]);
  const extra = (m: PromoMetrics) => (m.incrementalGgr == null ? null : m.incrementalGgr + (m.haloGgr ?? 0));
  return {
    count: list.length,
    contribution: sum((m) => m.promo.prizePool),
    before: sum((m) => m.ggrBefore),
    during: sum((m) => m.ggrDuring),
    after: sum((m) => m.ggrAfter),
    dvb: a.duringVsBefore,
    avb: a.afterVsBefore,
    wager: sum((m) => m.turnoverDuring),
    part: ratio((m) => [m.participants, m.promo.playersDuring]),
    rtp: rtpRatio == null ? null : 1 - rtpRatio,
    roi: ratio((m) => (m.promoRoi == null ? [null, null] : [extra(m), m.promo.prizePool])),
    participants: sum((m) => m.participants),
    extra: sum(extra),
  };
}

export type MetricFormat = "money" | "change" | "rate" | "roi" | "count";

export function formatMetric(kind: MetricFormat, v: number | null | undefined, cur: string, full = false): string {
  if (v == null || !Number.isFinite(v)) return "—";
  if (kind === "money") return full ? new Intl.NumberFormat("en-US", { style: "currency", currency: cur, maximumFractionDigits: 0 }).format(v) : money(v, cur);
  if (kind === "change") return pct(v);
  if (kind === "rate") return pctPlain(v, full ? 2 : 1);
  if (kind === "roi") return multiple(v);
  return num(v);
}

/** Axis tick labels: shorter than values. */
export function formatTick(kind: MetricFormat, v: number, cur: string): string {
  if (kind === "change") return `${v > 0 ? "+" : ""}${Math.round(v * 100)}%`;
  if (kind === "rate") {
    const p = Math.round(v * 1000) / 10;
    return `${Number.isInteger(p) ? p.toFixed(0) : p.toFixed(1)}%`;
  }
  if (kind === "roi") return `${v}×`;
  if (kind === "money") return money(v, cur);
  return num(v);
}

export interface ChartMetric {
  key: keyof Rollup | "monthGgr";
  label: string;
  /** One line under the chart title */
  about: string;
  format: MetricFormat;
  /**
   * Bars when the value is a quantity read from zero; a line on a fitted
   * axis for rates that sit in a narrow band (RTP ≈ 96–97%), where bars from
   * zero would all look the same.
   */
  shape: "bar" | "line";
  /** Reference line, e.g. 1.0× = break-even */
  ref?: { value: number; label: string };
  /** Per-promo value, for charts that show one bar per promo */
  perPromo?: (m: PromoMetrics) => number | null;
}

/** Every metric that can be charted, in the order the picker lists them. */
export const CHART_METRICS: ChartMetric[] = [
  { key: "monthGgr", label: "Total GGR (all operators)", about: "Total monthly GGR across all operators, promos or not.", format: "money", shape: "bar" },
  { key: "count", label: "Number of promotions", about: "Promotions that started in the month.", format: "count", shape: "bar" },
  {
    key: "contribution",
    label: "Promo Contribution",
    about: "Prize fund contributed to promos that started in the month.",
    format: "money",
    shape: "bar",
    perPromo: (m) => m.promo.prizePool,
  },
  { key: "before", label: "GGR Before", about: "GGR in the comparison days before each promo, added up.", format: "money", shape: "bar", perPromo: (m) => m.ggrBefore },
  { key: "during", label: "GGR During", about: "GGR while the promos ran, added up.", format: "money", shape: "bar", perPromo: (m) => m.ggrDuring },
  { key: "after", label: "GGR After", about: "GGR in the comparison days after each promo, added up.", format: "money", shape: "bar", perPromo: (m) => m.ggrAfter },
  {
    key: "dvb",
    label: "During vs Before",
    about: "GGR per day during vs before, weighted by each promo's before GGR. Observed — not adjusted for the market trend.",
    format: "change",
    shape: "bar",
    perPromo: (m) => m.duringVsBefore,
  },
  { key: "avb", label: "After vs Before", about: "GGR per day after vs before — whether the change lasted.", format: "change", shape: "bar", perPromo: (m) => m.afterVsBefore },
  { key: "wager", label: "Total Wager", about: "Amount wagered during the promos, added up.", format: "money", shape: "bar", perPromo: (m) => m.turnoverDuring },
  {
    key: "participants",
    label: "Players took part",
    about: "Unique participants per promo, added up (a player in two promos counts twice).",
    format: "count",
    shape: "bar",
    perPromo: (m) => m.participants,
  },
  {
    key: "part",
    label: "Part. Rate",
    about: "Participants ÷ active players during, from the summed counts.",
    format: "rate",
    shape: "bar",
    perPromo: (m) => m.participationRate,
  },
  {
    key: "rtp",
    label: "RTP",
    about: "(Total wager − GGR during) ÷ total wager, from the summed numbers. Axis is zoomed in — RTP moves in a narrow band.",
    format: "rate",
    shape: "line",
    perPromo: (m) => m.rtp,
  },
  {
    key: "extra",
    label: "Extra GGR",
    about: "GGR above the before run-rate, during and after the promos.",
    format: "money",
    shape: "bar",
    perPromo: (m) => (m.incrementalGgr == null ? null : m.incrementalGgr + (m.haloGgr ?? 0)),
  },
  {
    key: "roi",
    label: "Promo ROI (x)",
    about: "Extra GGR ÷ promo contribution, from the summed numbers. The dashed line is break-even (1.0×).",
    format: "roi",
    shape: "bar",
    ref: { value: 1, label: "break-even" },
    perPromo: (m) => m.promoRoi,
  },
];
