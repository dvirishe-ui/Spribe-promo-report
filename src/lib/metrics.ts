import { addDays, daysBetween, monthOf, prevMonth, todayIso } from "./dates";
import type { Dataset, MonthlyRecord, PromoRecord } from "./types";

/**
 * All report math lives here so the dashboard, the per-promo report and any
 * future export agree on every number.
 *
 * Windows can have different lengths (e.g. a 3-day promo compared with the 7
 * days before), so every comparison is made on GGR *per day*. When the windows
 * are the same length — the default — that is identical to comparing totals.
 */

export type Verdict = "strong" | "positive" | "unprofitable" | "flat" | "negative" | "pending";

export interface PromoMetrics {
  promo: PromoRecord;
  promoDays: number;
  windowDays: number;
  beforeStart: string;
  beforeEnd: string;
  afterStart: string;
  afterEnd: string;

  ggrBefore: number | null;
  ggrDuring: number | null;
  ggrAfter: number | null;
  /** A window total was computed from a daily series that doesn't cover the whole window yet */
  partialDuring: boolean;
  partialAfter: boolean;
  status: PromoStatus;

  perDayBefore: number | null;
  perDayDuring: number | null;
  perDayAfter: number | null;

  /** During vs before, per day (0.24 = +24%) */
  duringVsBefore: number | null;
  /** After vs before, per day — did the lift stick? */
  afterVsBefore: number | null;
  /** After vs during, per day */
  afterVsDuring: number | null;
  /** Share of the during-uplift still there after the promo (after−before)/(during−before) */
  upliftRetained: number | null;

  /** Extra GGR the promo period produced over the baseline run-rate */
  incrementalGgr: number | null;
  /** Extra GGR in the after window over the baseline run-rate (halo) */
  haloGgr: number | null;
  /** incremental + halo − prize pool */
  netImpact: number | null;
  /** netImpact / prize pool */
  roi: number | null;

  /** Indexed to before = 100 */
  index: { before: number; during: number | null; after: number | null } | null;

  playersDuringVsBefore: number | null;
  playersAfterVsBefore: number | null;

  /** Comparison-group change over the same windows (market trend), if a comparison group exists */
  controlChange: number | null;
  /** During vs before with the market trend removed — the incremental estimate */
  adjustedChange: number | null;
  /** The headline change: adjusted when a comparison group exists, otherwise raw during vs before */
  primaryChange: number | null;
  /** True when primaryChange is adjusted for the market trend */
  isAdjusted: boolean;

  participants: number | null;
  /** participants ÷ active players during */
  participationRate: number | null;
  /** new participants ÷ participants */
  newShare: number | null;
  /** participants active again after ÷ participants */
  retentionRate: number | null;
  betsPerParticipant: number | null;
  costPerParticipant: number | null;

  turnoverBefore: number | null;
  turnoverDuring: number | null;
  turnoverAfter: number | null;
  /** Turnover during vs before, per day */
  turnoverChange: number | null;
  /** GGR ÷ turnover per window (hold) */
  marginBefore: number | null;
  marginDuring: number | null;

  missions: MissionFunnel | null;
  leaderboard: LeaderboardSummary | null;

  month: string;
  monthGgr: number | null;
  prevMonthGgr: number | null;
  /** The promo month's total GGR vs the previous month */
  monthVsPrev: number | null;

  verdict: Verdict;
}

function ratio(a: number | null, b: number | null): number | null {
  if (a == null || b == null || !Number.isFinite(a) || !Number.isFinite(b) || b <= 0) return null;
  return a / b - 1;
}

function sumDaily(promo: PromoRecord, from: string, to: string): { total: number; days: number } | null {
  if (!promo.daily?.length) return null;
  let total = 0;
  let days = 0;
  for (const p of promo.daily) {
    if (p.date >= from && p.date <= to) {
      total += p.ggr;
      days++;
    }
  }
  return days ? { total, days } : null;
}

/** A typed-in total wins; otherwise fall back to the daily series (which may cover only part of the window). */
function windowTotal(
  typed: number | null,
  promo: PromoRecord,
  from: string,
  to: string,
  length: number,
): { total: number | null; days: number; partial: boolean } {
  if (typed != null) return { total: typed, days: length, partial: false };
  const d = sumDaily(promo, from, to);
  if (!d) return { total: null, days: length, partial: false };
  return { total: d.total, days: d.days, partial: d.days < length };
}

/**
 * upcoming → live → measuring (ended, after window still running) → complete.
 * Results are only final once a promo is complete.
 */
export type PromoStatus = "upcoming" | "live" | "measuring" | "complete";

export const STATUS_LABEL: Record<PromoStatus, string> = {
  upcoming: "Upcoming",
  live: "Live",
  measuring: "Measuring",
  complete: "Complete",
};

export function promoStatus(promo: PromoRecord, afterEnd: string, today = todayIso()): PromoStatus {
  if (today < promo.startDate) return "upcoming";
  if (today <= promo.endDate) return "live";
  if (today <= afterEnd) return "measuring";
  return "complete";
}

export interface MissionFunnel {
  steps: Array<{ name: string; reached: number; ofStart: number; dropFromPrev: number | null }>;
  /** Last step ÷ first step */
  completionRate: number | null;
  /** Index of the step that loses the largest share of players from the step before */
  hardestStep: number | null;
}

export interface LeaderboardSummary {
  bands: Array<{ band: string; winners: number; prize: number; share: number }>;
  winners: number;
  totalPrize: number;
  /** Winners ÷ participants */
  winRate: number | null;
}

function missionFunnel(steps: PromoRecord["missions"]): MissionFunnel | null {
  const clean = (steps ?? []).filter((s) => s.name && Number.isFinite(s.reached) && s.reached >= 0);
  if (clean.length < 2 || clean[0].reached <= 0) return null;
  const start = clean[0].reached;
  let hardest: number | null = null;
  let worst = -1;
  const out = clean.map((st, i) => {
    const prev = i > 0 ? clean[i - 1].reached : null;
    const drop = prev && prev > 0 ? 1 - st.reached / prev : null;
    if (drop != null && drop > worst) {
      worst = drop;
      hardest = i;
    }
    return { name: st.name, reached: st.reached, ofStart: st.reached / start, dropFromPrev: drop };
  });
  return { steps: out, completionRate: clean[clean.length - 1].reached / start, hardestStep: hardest };
}

function leaderboardSummary(bands: PromoRecord["leaderboard"], participants: number | null): LeaderboardSummary | null {
  const clean = (bands ?? []).filter((b) => b.band && b.winners >= 0 && b.prize >= 0);
  if (!clean.length) return null;
  const totalPrize = clean.reduce((s, b) => s + b.prize, 0);
  const winners = clean.reduce((s, b) => s + b.winners, 0);
  return {
    bands: clean.map((b) => ({ ...b, share: totalPrize > 0 ? b.prize / totalPrize : 0 })),
    winners,
    totalPrize,
    winRate: participants && participants > 0 ? winners / participants : null,
  };
}

function share(a: number | null | undefined, b: number | null | undefined): number | null {
  return a != null && b != null && b > 0 ? a / b : null;
}

export function monthlyMap(monthly: MonthlyRecord[]): Map<string, number | null> {
  return new Map(monthly.map((m) => [m.month, m.ggr]));
}

export function computePromo(promo: PromoRecord, months?: Map<string, number | null>): PromoMetrics {
  const promoDays = Math.max(1, daysBetween(promo.startDate, promo.endDate));
  const windowDays = promo.windowDays && promo.windowDays > 0 ? promo.windowDays : promoDays;
  const beforeStart = addDays(promo.startDate, -windowDays);
  const beforeEnd = addDays(promo.startDate, -1);
  const afterStart = addDays(promo.endDate, 1);
  const afterEnd = addDays(promo.endDate, windowDays);

  const wB = windowTotal(promo.ggrBefore, promo, beforeStart, beforeEnd, windowDays);
  const wD = windowTotal(promo.ggrDuring, promo, promo.startDate, promo.endDate, promoDays);
  const wA = windowTotal(promo.ggrAfter, promo, afterStart, afterEnd, windowDays);
  const ggrBefore = wB.total;
  const ggrDuring = wD.total;
  const ggrAfter = wA.total;

  const perDayBefore = ggrBefore == null ? null : ggrBefore / wB.days;
  const perDayDuring = ggrDuring == null ? null : ggrDuring / wD.days;
  const perDayAfter = ggrAfter == null ? null : ggrAfter / wA.days;

  const duringVsBefore = ratio(perDayDuring, perDayBefore);
  const afterVsBefore = ratio(perDayAfter, perDayBefore);
  const afterVsDuring = ratio(perDayAfter, perDayDuring);

  // Comparison group: the same windows for players/operators without the promo. Its change is the
  // market trend; removing it turns "GGR went up" into an estimate of what the promo itself added.
  const controlChange = ratio(
    promo.controlGgrDuring == null ? null : promo.controlGgrDuring / promoDays,
    promo.controlGgrBefore == null ? null : promo.controlGgrBefore / windowDays,
  );
  const isAdjusted = controlChange != null && duringVsBefore != null;
  const adjustedChange = isAdjusted ? (1 + duringVsBefore!) / (1 + controlChange!) - 1 : null;
  const expectedPerDay = perDayBefore == null ? null : perDayBefore * (1 + (controlChange ?? 0));

  // Extra GGR over what the before run-rate (moved by the market trend, when known) would have produced.
  const incrementalGgr =
    perDayDuring != null && expectedPerDay != null ? (perDayDuring - expectedPerDay) * promoDays : null;
  const haloGgr =
    perDayAfter != null && perDayBefore != null ? (perDayAfter - perDayBefore) * windowDays : null;

  const upliftRetained =
    perDayDuring != null && perDayAfter != null && perDayBefore != null && perDayDuring - perDayBefore > 0
      ? (perDayAfter - perDayBefore) / (perDayDuring - perDayBefore)
      : null;

  const netImpact =
    incrementalGgr == null ? null : incrementalGgr + (haloGgr ?? 0) - (promo.prizePool ?? 0);
  const roi = netImpact != null && promo.prizePool && promo.prizePool > 0 ? netImpact / promo.prizePool : null;

  const index =
    perDayBefore != null && perDayBefore > 0
      ? {
          before: 100,
          during: perDayDuring == null ? null : (perDayDuring / perDayBefore) * 100,
          after: perDayAfter == null ? null : (perDayAfter / perDayBefore) * 100,
        }
      : null;

  // Unique players don't add up per day, so only compare them when the windows are the same length.
  const sameLength = windowDays === promoDays;
  const playersDuringVsBefore = sameLength ? ratio(promo.playersDuring, promo.playersBefore) : null;
  const playersAfterVsBefore = sameLength ? ratio(promo.playersAfter, promo.playersBefore) : null;

  const participants = promo.participants ?? null;
  const turnoverBefore = promo.turnoverBefore ?? null;
  const turnoverDuring = promo.turnoverDuring ?? null;
  const turnoverAfter = promo.turnoverAfter ?? null;

  const month = monthOf(promo.startDate);
  const monthGgr = months?.get(month) ?? null;
  const prevMonthGgr = months?.get(prevMonth(month)) ?? null;
  const monthVsPrev = ratio(monthGgr, prevMonthGgr);

  return {
    promo,
    promoDays,
    windowDays,
    beforeStart,
    beforeEnd,
    afterStart,
    afterEnd,
    ggrBefore,
    ggrDuring,
    ggrAfter,
    partialDuring: wD.partial,
    partialAfter: wA.partial,
    status: promoStatus(promo, afterEnd),
    perDayBefore,
    perDayDuring,
    perDayAfter,
    duringVsBefore,
    afterVsBefore,
    afterVsDuring,
    upliftRetained,
    incrementalGgr,
    haloGgr,
    netImpact,
    roi,
    index,
    playersDuringVsBefore,
    playersAfterVsBefore,
    controlChange,
    adjustedChange,
    primaryChange: adjustedChange ?? duringVsBefore,
    isAdjusted,
    participants,
    participationRate: share(participants, promo.playersDuring),
    newShare: share(promo.newParticipants, participants),
    retentionRate: share(promo.retainedParticipants, participants),
    betsPerParticipant: share(promo.betsDuring, participants),
    costPerParticipant: share(promo.prizePool, participants),
    turnoverBefore,
    turnoverDuring,
    turnoverAfter,
    turnoverChange: ratio(
      turnoverDuring == null ? null : turnoverDuring / promoDays,
      turnoverBefore == null ? null : turnoverBefore / windowDays,
    ),
    marginBefore: share(ggrBefore, turnoverBefore),
    marginDuring: share(ggrDuring, turnoverDuring),
    missions: missionFunnel(promo.missions),
    leaderboard: leaderboardSummary(promo.leaderboard, participants),
    month,
    monthGgr,
    prevMonthGgr,
    monthVsPrev,
    verdict: verdictFor(adjustedChange ?? duringVsBefore, netImpact),
  };
}

export function verdictFor(uplift: number | null, netImpact: number | null): Verdict {
  if (uplift == null) return "pending";
  if (uplift <= -0.03) return "negative";
  // GGR went up, but not by enough to cover the prizes.
  if (netImpact != null && netImpact < 0 && uplift > 0) return "unprofitable";
  if (uplift >= 0.15) return "strong";
  if (uplift >= 0.03) return "positive";
  if (uplift > -0.03) return "flat";
  return "negative";
}

export const VERDICT_LABEL: Record<Verdict, string> = {
  strong: "Strong uplift",
  positive: "Positive",
  unprofitable: "Didn't pay back",
  flat: "Flat",
  negative: "Negative",
  pending: "Awaiting data",
};

export function computeAll(dataset: Dataset): PromoMetrics[] {
  const months = monthlyMap(dataset.monthly);
  return dataset.promos.map((p) => computePromo(p, months));
}

/** Aggregate a set of promos the fair way: weighted by their baselines, not a mean of percentages. */
export interface Aggregate {
  count: number;
  withData: number;
  ggrBefore: number;
  ggrDuring: number;
  ggrAfter: number;
  incrementalGgr: number;
  haloGgr: number;
  prizePool: number;
  netImpact: number;
  duringVsBefore: number | null;
  afterVsBefore: number | null;
  roi: number | null;
  positiveShare: number | null;
  /** Promos whose change is adjusted with a comparison group */
  adjustedCount: number;
  /** Baseline-weighted adjusted change over the promos that have a comparison group */
  adjustedChange: number | null;
  participants: number;
  /** Promos that report participants */
  withParticipants: number;
  newParticipants: number;
  /** Total promo cost (rewards paid), display currency */
  cost: number;
  withCost: number;
  /** Promos left out of money totals because their currency has no exchange rate */
  fxMissing: number;
  index: { before: number; during: number | null; after: number | null } | null;
}

export function aggregate(list: PromoMetrics[]): Aggregate {
  let ggrBefore = 0,
    ggrDuring = 0,
    ggrAfter = 0,
    incrementalGgr = 0,
    haloGgr = 0,
    prizePool = 0,
    netImpact = 0;
  // Baseline-weighted: Σ(during/day) vs Σ(before/day) over promos that have both.
  let baseD = 0,
    durD = 0,
    baseA = 0,
    aftA = 0,
    withData = 0,
    positive = 0,
    adjBase = 0,
    adjDur = 0,
    adjustedCount = 0,
    participants = 0,
    withParticipants = 0,
    newParticipants = 0,
    withCost = 0,
    fxMissing = 0;

  for (const m of list) {
    if (m.promo.fxMissing) fxMissing++;
    if (m.participants != null) {
      participants += m.participants;
      withParticipants++;
      newParticipants += m.promo.newParticipants ?? 0;
    }
    if (m.promo.prizePool != null) withCost++;
    if (m.isAdjusted && m.perDayBefore != null && m.perDayDuring != null) {
      adjustedCount++;
      // Weight each promo's adjusted change by its baseline, like the raw change.
      adjBase += m.perDayBefore * m.promoDays;
      adjDur += m.perDayBefore * m.promoDays * (1 + m.adjustedChange!);
    }
    ggrBefore += m.ggrBefore ?? 0;
    ggrDuring += m.ggrDuring ?? 0;
    ggrAfter += m.ggrAfter ?? 0;
    prizePool += m.promo.prizePool ?? 0;
    if (m.perDayBefore != null && m.perDayBefore > 0 && m.perDayDuring != null) {
      withData++;
      baseD += m.perDayBefore * m.promoDays;
      durD += m.perDayDuring * m.promoDays;
      incrementalGgr += m.incrementalGgr ?? 0;
      netImpact += m.netImpact ?? 0;
      if ((m.primaryChange ?? 0) > 0) positive++;
      if (m.perDayAfter != null) {
        baseA += m.perDayBefore * m.windowDays;
        aftA += m.perDayAfter * m.windowDays;
        haloGgr += m.haloGgr ?? 0;
      }
    }
  }

  const duringVsBefore = baseD > 0 ? durD / baseD - 1 : null;
  const afterVsBefore = baseA > 0 ? aftA / baseA - 1 : null;
  const pool = list.reduce((s, m) => s + (m.incrementalGgr != null ? (m.promo.prizePool ?? 0) : 0), 0);

  return {
    count: list.length,
    withData,
    ggrBefore,
    ggrDuring,
    ggrAfter,
    incrementalGgr,
    haloGgr,
    prizePool,
    netImpact,
    duringVsBefore,
    afterVsBefore,
    roi: pool > 0 ? netImpact / pool : null,
    positiveShare: withData ? positive / withData : null,
    adjustedCount,
    adjustedChange: adjBase > 0 ? adjDur / adjBase - 1 : null,
    participants,
    withParticipants,
    newParticipants,
    cost: prizePool,
    withCost,
    fxMissing,
    index:
      duringVsBefore == null
        ? null
        : {
            before: 100,
            during: (1 + duringVsBefore) * 100,
            after: afterVsBefore == null ? null : (1 + afterVsBefore) * 100,
          },
  };
}

export interface MonthRow {
  month: string;
  ggr: number | null;
  prevGgr: number | null;
  momChange: number | null;
  promoCount: number;
  prevPromoCount: number;
  incrementalGgr: number;
  /** Incremental promo GGR as a share of the month's total GGR */
  promoShare: number | null;
}

export function monthRows(months: string[], monthly: MonthlyRecord[], metrics: PromoMetrics[]): MonthRow[] {
  const map = monthlyMap(monthly);
  const counts = new Map<string, number>();
  const incr = new Map<string, number>();
  for (const m of metrics) {
    counts.set(m.month, (counts.get(m.month) ?? 0) + 1);
    incr.set(m.month, (incr.get(m.month) ?? 0) + (m.incrementalGgr ?? 0));
  }
  return months.map((month) => {
    const ggr = map.get(month) ?? null;
    const prevGgr = map.get(prevMonth(month)) ?? null;
    const incrementalGgr = incr.get(month) ?? 0;
    return {
      month,
      ggr,
      prevGgr,
      momChange: ratio(ggr, prevGgr),
      promoCount: counts.get(month) ?? 0,
      prevPromoCount: counts.get(prevMonth(month)) ?? 0,
      incrementalGgr,
      promoShare: ggr && ggr > 0 ? incrementalGgr / ggr : null,
    };
  });
}
