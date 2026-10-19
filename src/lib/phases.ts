import type { PromoMetrics } from "./metrics";

/**
 * Metrics compared across the three windows of a promo — Before, During and
 * After — the way the team's promo sheet does it. Each comes straight from
 * the promo records (no estimates). Totals are summed over the promos in
 * view; ratios (Avg Bet, RTP) are recalculated from those sums.
 *
 * A promo counts towards a metric only when it has that metric both before
 * and during, so a promo with a missing window can't skew the comparison.
 */

export type PhaseUnit = "money" | "ggr" | "avg" | "bets" | "players" | "pct";
type Triple = [number | null | undefined, number | null | undefined, number | null | undefined];

export interface PhaseMetric {
  key: string;
  label: string;
  hint: string;
  unit: PhaseUnit;
  color: string;
  /** Additive metrics: one value per window */
  get?: (m: PromoMetrics) => Triple;
  /** Ratio metrics: numerator and denominator per window, divided after summing */
  ratio?: (m: PromoMetrics) => { num: Triple; den: Triple; transform?: (r: number) => number };
}

const p = (m: PromoMetrics) => m.promo;
const sub = (a: number | null | undefined, b: number | null | undefined) => (a == null || b == null ? null : a - b);

export const PHASE_METRICS: PhaseMetric[] = [
  { key: "wager", label: "Total Wager", hint: "How much was bet", unit: "money", color: "var(--cat-1)", get: (m) => [m.turnoverBefore, m.turnoverDuring, m.turnoverAfter] },
  {
    key: "win",
    label: "Total Win",
    hint: "Paid back to players (wager − GGR)",
    unit: "money",
    color: "var(--cat-5)",
    get: (m) => [sub(m.turnoverBefore, m.ggrBefore), sub(m.turnoverDuring, m.ggrDuring), sub(m.turnoverAfter, m.ggrAfter)],
  },
  { key: "ggr", label: "GGR", hint: "What SPRIBE's games earned", unit: "ggr", color: "var(--cat-4)", get: (m) => [m.ggrBefore, m.ggrDuring, m.ggrAfter] },
  {
    key: "bets",
    label: "Number of Bets",
    hint: "How many bets were placed",
    unit: "bets",
    color: "var(--cat-8)",
    get: (m) => [p(m).totalBetsBefore, p(m).totalBetsDuring, p(m).totalBetsAfter],
  },
  {
    key: "avgBet",
    label: "Avg Bet",
    hint: "Wager ÷ number of bets",
    unit: "avg",
    color: "var(--cat-7)",
    ratio: (m) => ({ num: [m.turnoverBefore, m.turnoverDuring, m.turnoverAfter], den: [p(m).totalBetsBefore, p(m).totalBetsDuring, p(m).totalBetsAfter] }),
  },
  {
    key: "players",
    label: "Overall Active Players",
    hint: "Everyone who played the games",
    unit: "players",
    color: "var(--cat-6)",
    get: (m) => [p(m).playersBefore, p(m).playersDuring, p(m).playersAfter],
  },
  {
    key: "rtp",
    label: "RTP",
    hint: "Share of wagers paid back to players",
    unit: "pct",
    color: "var(--cat-3)",
    ratio: (m) => ({
      num: [sub(m.turnoverBefore, m.ggrBefore), sub(m.turnoverDuring, m.ggrDuring), sub(m.turnoverAfter, m.ggrAfter)],
      den: [m.turnoverBefore, m.turnoverDuring, m.turnoverAfter],
    }),
  },
];

export const DEFAULT_PHASE_METRICS = ["wager", "ggr", "rtp"];

export interface PhaseValues {
  before: number | null;
  during: number | null;
  after: number | null;
  /** Promos counted */
  n: number;
  /** Some counted promos have no after window yet, so After is left empty */
  afterMissing: boolean;
}

export function phaseValues(metric: PhaseMetric, list: PromoMetrics[]): PhaseValues {
  const ok = (v: number | null | undefined): v is number => v != null && Number.isFinite(v);
  if (metric.get) {
    const rows = list.map(metric.get).filter((t) => ok(t[0]) && ok(t[1]));
    const sum = (i: 0 | 1 | 2) => rows.reduce((s, t) => s + (t[i] as number), 0);
    const afterMissing = rows.some((t) => !ok(t[2]));
    return { before: rows.length ? sum(0) : null, during: rows.length ? sum(1) : null, after: rows.length && !afterMissing ? sum(2) : null, n: rows.length, afterMissing };
  }
  const rows = list.map(metric.ratio!).filter((r) => ok(r.num[0]) && ok(r.den[0]) && ok(r.num[1]) && ok(r.den[1]) && (r.den[0] as number) > 0 && (r.den[1] as number) > 0);
  const div = (i: 0 | 1 | 2) => {
    const den = rows.reduce((s, r) => s + (r.den[i] as number), 0);
    return den > 0 ? rows.reduce((s, r) => s + (r.num[i] as number), 0) / den : null;
  };
  const afterMissing = rows.some((r) => !ok(r.num[2]) || !ok(r.den[2]));
  return { before: rows.length ? div(0) : null, during: rows.length ? div(1) : null, after: rows.length && !afterMissing ? div(2) : null, n: rows.length, afterMissing };
}
