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
