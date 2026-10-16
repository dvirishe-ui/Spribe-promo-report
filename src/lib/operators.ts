import { aggregate, median, type PromoMetrics } from "./metrics";

/**
 * Operator-level views for the AM workspace. Benchmarks always carry their
 * sample size so a comparison against two promos isn't read like one against
 * fifty.
 */

export interface OperatorSummary {
  operator: string;
  aggregators: string[];
  markets: string[];
  promos: PromoMetrics[];
  completed: number;
  live: number;
  upcoming: number;
  change: number | null;
  adjustedCount: number;
  participants: number;
  withParticipants: number;
  cost: number;
  lastStart: string | null;
  nextStart: string | null;
}

export function operatorSummaries(all: PromoMetrics[]): OperatorSummary[] {
  const by = new Map<string, PromoMetrics[]>();
  for (const m of all) if (m.promo.operator) by.set(m.promo.operator, [...(by.get(m.promo.operator) ?? []), m]);
  return [...by.entries()]
    .map(([operator, promos]) => {
      const results = promos.filter((m) => m.status !== "upcoming");
      const a = aggregate(results.filter((m) => m.status === "complete" || m.status === "measuring"));
      const started = results.map((m) => m.promo.startDate).sort();
      const next = promos.filter((m) => m.status === "upcoming").map((m) => m.promo.startDate).sort();
      return {
        operator,
        aggregators: [...new Set(promos.map((m) => m.promo.aggregator).filter(Boolean))],
        markets: [...new Set(promos.map((m) => m.promo.market).filter(Boolean))],
        promos,
        completed: promos.filter((m) => m.status === "complete").length,
        live: promos.filter((m) => m.status === "live" || m.status === "measuring").length,
        upcoming: promos.filter((m) => m.status === "upcoming").length,
        change: a.duringVsBefore,
        adjustedCount: a.adjustedCount,
        participants: a.participants,
        withParticipants: a.withParticipants,
        cost: a.cost,
        lastStart: started[started.length - 1] ?? null,
        nextStart: next[0] ?? null,
      };
    })
    .sort((a, b) => b.promos.length - a.promos.length || a.operator.localeCompare(b.operator));
}

export interface BenchmarkRow {
  label: string;
  format: "pct" | "money" | "num";
  /** higher is better? (null = neither) */
  higherIsBetter: boolean | null;
  mine: { value: number | null; n: number };
  market: { value: number | null; n: number };
  all: { value: number | null; n: number };
}

type Pick = (m: PromoMetrics) => number | null;

function med(list: PromoMetrics[], pick: Pick) {
  const xs = list.map(pick).filter((v): v is number => v != null && Number.isFinite(v));
  return { value: median(xs), n: xs.length };
}

/**
 * This operator vs other operators in the same markets vs everyone, on the
 * median of each metric (robust to one outlier promo). Only completed promos.
 */
export function benchmarks(operator: string, all: PromoMetrics[]): BenchmarkRow[] {
  const done = all.filter((m) => m.status === "complete");
  const mine = done.filter((m) => m.promo.operator === operator);
  const markets = new Set(mine.map((m) => m.promo.market));
  const market = done.filter((m) => m.promo.operator !== operator && markets.has(m.promo.market));
  const others = done.filter((m) => m.promo.operator !== operator);
  const row = (label: string, format: BenchmarkRow["format"], higherIsBetter: boolean | null, pick: Pick): BenchmarkRow => ({
    label,
    format,
    higherIsBetter,
    mine: med(mine, pick),
    market: med(market, pick),
    all: med(others, pick),
  });
  return [
    row("GGR change vs baseline", "pct", true, (m) => m.primaryChange),
    row("Participation (of active players)", "pct", true, (m) => m.participationRate),
    row("Came back after", "pct", true, (m) => m.retentionRate),
    row("Mission completion", "pct", true, (m) => m.missionDays?.overallRate ?? m.missions?.completionRate ?? null),
    row("Reward cost per participant", "money", false, (m) => m.costPerParticipant),
  ].filter((r) => r.mine.n > 0);
}
