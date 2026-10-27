import type { PromoMetrics } from "../metrics";
import { formatDay } from "../dates";
import { money, num } from "../format";

/**
 * Calculated metrics + normalization layer for the insights.
 *
 * Flow metrics (GGR, wager, number of bets) accumulate over time, so windows of
 * different lengths are only compared per day: €700K over 7 days before vs
 * €250K over 2 days during is +25% per day, not −64%. Unique active players do
 * not add up per day, so they are only compared when the windows have the same
 * length. Ratios (average bet, hold, bets per player) are taken within each
 * window, so they need no normalization.
 *
 * Every value keeps the raw total and the day count it came from, so the UI can
 * show the calculation behind any number.
 */

export type MetricKey = "ggr" | "wager" | "bets" | "players" | "avgBet" | "hold" | "betsPerPlayer" | "wagerPerPlayer";
export type PhaseKey = "before" | "during" | "after";
export type MetricKind = "flow" | "level" | "ratio";

export interface PhasePoint {
  /** Raw window total (flows), level (players) or ratio value */
  total: number | null;
  days: number;
  /** The value that is compared: per day for flows, the raw value otherwise */
  value: number | null;
}

export interface MetricFacts {
  key: MetricKey;
  label: string;
  kind: MetricKind;
  before: PhasePoint;
  during: PhasePoint;
  after: PhasePoint;
  /** Change of the compared value, during vs before (0.18 = +18%) */
  duringVsBefore: number | null;
  afterVsBefore: number | null;
  /** True when flows are compared per day because the windows differ in length */
  normalized: boolean;
  /** Why this metric can't be compared, when it can't */
  unavailable?: string;
}

export interface PromoFacts {
  m: PromoMetrics;
  currency: string;
  /** Before / after windows have a different number of days than the promo */
  unequalWindows: boolean;
  /** The after window is not over yet (or has no data), so after comparisons are skipped */
  afterFinal: boolean;
  metrics: Record<MetricKey, MetricFacts>;
  dates: Record<PhaseKey, string>;
}

const LABEL: Record<MetricKey, string> = {
  ggr: "GGR",
  wager: "Wager",
  bets: "Number of bets",
  players: "Active players",
  avgBet: "Average bet",
  hold: "Hold (GGR ÷ wager)",
  betsPerPlayer: "Bets per active player",
  wagerPerPlayer: "Wager per active player",
};

const ok = (v: number | null | undefined): v is number => v != null && Number.isFinite(v);

/** (to − from) ÷ from; null when the base is missing or not positive (no division by zero). */
export function change(from: number | null | undefined, to: number | null | undefined): number | null {
  if (!ok(from) || !ok(to) || from <= 0) return null;
  return to / from - 1;
}

function point(total: number | null | undefined, days: number, perDay: boolean): PhasePoint {
  const t = ok(total) ? total : null;
  return { total: t, days, value: t == null ? null : perDay ? t / days : t };
}

function build(key: MetricKey, kind: MetricKind, b: PhasePoint, d: PhasePoint, a: PhasePoint, normalized: boolean, afterFinal: boolean, unavailable?: string): MetricFacts {
  return {
    key,
    label: LABEL[key],
    kind,
    before: b,
    during: d,
    after: a,
    duringVsBefore: unavailable ? null : change(b.value, d.value),
    afterVsBefore: unavailable || !afterFinal ? null : change(b.value, a.value),
    normalized,
    unavailable,
  };
}

function ratioPoint(num: PhasePoint, den: PhasePoint, days: number): PhasePoint {
  const v = num.total != null && den.total != null && den.total > 0 ? num.total / den.total : null;
  return { total: v, days, value: v };
}

export function promoFacts(m: PromoMetrics, currency: string): PromoFacts {
  const p = m.promo;
  const wd = m.windowDays;
  const pd = m.promoDays;
  const unequal = wd !== pd;
  const afterFinal = m.status === "complete" && !m.partialAfter && m.ggrAfter != null;

  // GGR windows can come from a daily series that only covers part of a window; per-day values are already right then.
  const ggrDays = (total: number | null, perDay: number | null, fallback: number) => (total != null && perDay ? Math.round(total / perDay) : fallback);
  const ggr = build(
    "ggr",
    "flow",
    point(m.ggrBefore, ggrDays(m.ggrBefore, m.perDayBefore, wd), true),
    point(m.ggrDuring, ggrDays(m.ggrDuring, m.perDayDuring, pd), true),
    point(m.ggrAfter, ggrDays(m.ggrAfter, m.perDayAfter, wd), true),
    unequal || m.partialDuring || m.partialAfter,
    afterFinal,
  );
  const flow = (key: MetricKey, b: number | null | undefined, d: number | null | undefined, a: number | null | undefined) =>
    build(key, "flow", point(b, wd, true), point(d, pd, true), point(a, wd, true), unequal, afterFinal);
  const wager = flow("wager", m.turnoverBefore, m.turnoverDuring, m.turnoverAfter);
  const bets = flow("bets", p.totalBetsBefore, p.totalBetsDuring, p.totalBetsAfter);

  const playersWhy = unequal ? `Active players are unique counts, so they're only compared when every window has the same length (here ${wd} vs ${pd} days).` : undefined;
  const players = build("players", "level", point(p.playersBefore, wd, false), point(p.playersDuring, pd, false), point(p.playersAfter, wd, false), false, afterFinal, playersWhy);

  const ratio = (key: MetricKey, n: MetricFacts, d: MetricFacts, why?: string) =>
    build(key, "ratio", ratioPoint(n.before, d.before, wd), ratioPoint(n.during, d.during, pd), ratioPoint(n.after, d.after, wd), false, afterFinal, why);

  return {
    m,
    currency,
    unequalWindows: unequal,
    afterFinal,
    dates: {
      before: `${formatDay(m.beforeStart)} – ${formatDay(m.beforeEnd)}`,
      during: `${formatDay(p.startDate)} – ${formatDay(p.endDate)}`,
      after: `${formatDay(m.afterStart)} – ${formatDay(m.afterEnd)}`,
    },
    metrics: {
      ggr,
      wager,
      bets,
      players,
      avgBet: ratio("avgBet", wager, bets),
      hold: ratio("hold", ggr, wager),
      betsPerPlayer: ratio("betsPerPlayer", bets, players, playersWhy),
      wagerPerPlayer: ratio("wagerPerPlayer", wager, players, playersWhy),
    },
  };
}

/* ------------------------------------------------------------ formatting */

/** A metric value in its own unit: money, count, average bet or hold %. */
export function fmtValue(key: MetricKey, v: number | null, cur: string): string {
  if (v == null) return "—";
  if (key === "hold") return `${(v * 100).toFixed(2)}%`;
  if (key === "avgBet" || key === "wagerPerPlayer")
    return new Intl.NumberFormat("en-US", { style: "currency", currency: cur, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
  if (key === "betsPerPlayer") return v.toFixed(1);
  if (key === "ggr" || key === "wager") return money(v, cur);
  return num(v);
}

/** "18.2%" — size of a change without the sign, for prose ("rose 18.2%"). */
export function size(v: number): string {
  return `${Math.abs(v * 100).toFixed(1)}%`;
}

/** "+5.0 pp" / "−22.0 pp" — always percentage points. */
export function pp(v: number): string {
  const s = Math.abs(v).toFixed(1);
  return v > 0.05 ? `+${s} pp` : v < -0.05 ? `−${s} pp` : `${(0).toFixed(1)} pp`;
}

/** "+18.2%" / "−7.0%" */
export function signed(v: number): string {
  const s = Math.abs(v * 100).toFixed(1);
  return v > 0.0005 ? `+${s}%` : v < -0.0005 ? `−${s}%` : "0.0%";
}

export const up = (v: number) => (v >= 0 ? "rose" : "fell");
