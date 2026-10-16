import { aggregate, median, type PromoMetrics, type PromoStatus } from "./metrics";
import { addDays, todayIso } from "./dates";
import type { CalendarCampaign } from "./campaigns";

/**
 * "What happened last time?" for the calendar. Everything here is a lookup
 * over completed promos that have results — no forecasting. Past results are
 * shown as context with their sample size, never as a prediction.
 */

export interface PastMatch {
  m: PromoMetrics;
  /** Why it's considered similar, in words */
  reason: string;
}

const done = (m: PromoMetrics) => m.status === "complete" && m.primaryChange != null;
const shares = (a: string[], b: string[]) => a.some((g) => b.includes(g));

/**
 * Completed promos most like this one that ran before it: same operator and
 * mechanic first, then same mechanic on the same games, then same operator.
 */
export function similarPast(
  target: { type: string; games: string[]; operator?: string; start: string; exclude?: string[] },
  all: PromoMetrics[],
  limit = 4,
): PastMatch[] {
  const scored: Array<PastMatch & { score: number }> = [];
  for (const m of all) {
    const p = m.promo;
    if (!done(m) || p.startDate >= target.start || target.exclude?.includes(p.id)) continue;
    const sameOp = !!target.operator && p.operator === target.operator;
    const sameType = p.type === target.type;
    const sameGame = shares(p.games, target.games);
    let score = 0;
    let reason = "";
    if (sameOp && sameType) [score, reason] = [4, sameGame ? "Same operator, mechanic and game" : "Same operator and mechanic"];
    else if (sameType && sameGame) [score, reason] = [3, "Same mechanic and game"];
    else if (sameType) [score, reason] = [2, "Same mechanic"];
    else if (sameOp && sameGame) [score, reason] = [1, "Same operator and game"];
    if (score) scored.push({ m, reason, score });
  }
  return scored
    .sort((a, b) => b.score - a.score || b.m.promo.startDate.localeCompare(a.m.promo.startDate))
    .slice(0, limit)
    .map(({ m, reason }) => ({ m, reason }));
}

/** Median GGR change of completed promos of one mechanic, with its sample size. */
export function typicalFor(type: string, all: PromoMetrics[], exclude: string[] = []): { change: number | null; n: number } {
  const xs = all.filter((m) => done(m) && m.promo.type === type && !exclude.includes(m.promo.id)).map((m) => m.primaryChange!);
  return { change: median(xs), n: xs.length };
}

export interface CampaignRollup {
  linked: PromoMetrics[];
  status: PromoStatus;
  /** Baseline-weighted GGR change during vs before across operators (observed) */
  change: number | null;
  participants: number;
  withParticipants: number;
}

const STATUS_RANK: PromoStatus[] = ["upcoming", "live", "measuring", "complete"];

/** A network campaign's status and combined result from the operator records linked to it. */
export function campaignRollup(c: CalendarCampaign, linked: PromoMetrics[], today = todayIso()): CampaignRollup {
  let status: PromoStatus;
  if (linked.length) status = linked.map((m) => m.status).sort((a, b) => STATUS_RANK.indexOf(a) - STATUS_RANK.indexOf(b))[0];
  else {
    const len = Math.round((Date.parse(c.end) - Date.parse(c.start)) / 86_400_000) + 1;
    status = today < c.start ? "upcoming" : today <= c.end ? "live" : today <= addDays(c.end, len) ? "measuring" : "complete";
  }
  const a = aggregate(linked);
  return { linked, status, change: a.duringVsBefore, participants: a.participants, withParticipants: a.withParticipants };
}
