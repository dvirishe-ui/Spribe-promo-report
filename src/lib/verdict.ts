import { formatDay } from "./dates";
import { currencySymbol, money, pct, pctPlain } from "./format";
import type { PromoMetrics } from "./metrics";

/**
 * The one-glance answer to "how did this promo go?" — for executives and
 * partners. Built only from the promo's own numbers with fixed thresholds,
 * and worded so it never claims more than the data supports: an unadjusted
 * change is described as "GGR went up", only an adjusted one as "it worked".
 */

export type OutcomeTone = "good" | "mixed" | "neutral" | "bad" | "pending";

export interface Outcome {
  tone: OutcomeTone;
  /** One or two words for chips and lists */
  label: string;
  /** The headline sentence */
  headline: string;
  /** One supporting sentence */
  sub: string;
  /** Rule-based suggestions tied to a number on the page (max 3) */
  nextSteps: string[];
}

const FLAT = 0.03;

/** €3.50 — for "per €1" amounts, where the cents matter. */
function moneyCents(v: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
  } catch {
    return `${v.toFixed(2)} ${currency}`;
  }
}

export function outcomeFor(m: PromoMetrics, currency: string): Outcome {
  const c = m.primaryChange;
  const cost = m.promo.prizePool;
  const extra = m.incrementalGgr == null ? null : m.incrementalGgr + (m.haloGgr ?? 0);
  const payback = cost && cost > 0 && extra != null ? extra / cost : null;
  const caveat = m.isAdjusted ? "" : " (before vs during — not adjusted for the market trend)";

  if (m.status === "upcoming")
    return { tone: "pending", label: "Not started", headline: "This promo hasn't started yet", sub: `It starts on ${formatDay(m.promo.startDate, true)}.`, nextSteps: [] };

  if (c == null)
    return {
      tone: "pending",
      label: "No data yet",
      headline: "Not enough data to judge this promo yet",
      sub: "GGR for the before and during periods is needed.",
      nextSteps: [],
    };

  if (m.status === "live" || m.status === "measuring") {
    const when = m.status === "live" ? "so far" : "while it ran";
    return {
      tone: "pending",
      label: "Early read",
      headline: `Early read: GGR ${c >= 0 ? "up" : "down"} ${pctPlain(Math.abs(c), 1)} ${when}`,
      sub: `Final results on ${formatDay(m.afterEnd, true)}, once the after period is measured.`,
      nextSteps: [],
    };
  }

  const steps: string[] = [];
  let out: Omit<Outcome, "nextSteps">;
  if (c >= FLAT && (payback == null || payback >= 1)) {
    out = {
      tone: "good",
      label: m.isAdjusted ? "Worked" : "GGR up",
      headline: m.isAdjusted ? `It worked: GGR ${pct(c)} from the promo itself` : `GGR went up ${pctPlain(c, 1)} during the promo`,
      sub:
        payback != null
          ? `Every ${currencySymbol(currency)}1 of promo contribution brought back ${moneyCents(payback, currency)} in extra GGR${caveat}.`
          : `Compared with the ${m.windowDays} days before${caveat}.`,
    };
    if (m.afterVsBefore != null && m.afterVsBefore >= FLAT) steps.push(`The lift lasted after it ended (${pct(m.afterVsBefore)}) — a strong candidate to run again.`);
    else steps.push("Worth repeating; the lift faded once it ended, so plan the next one close behind.");
  } else if (c > 0 && payback != null && payback < 1) {
    out = {
      tone: "mixed",
      label: "Didn't pay back",
      headline: `GGR went up ${pctPlain(c, 1)}, but the promo didn't pay back its cost`,
      sub: `It brought ${money(extra, currency)} extra GGR on a ${money(cost, currency)} cost${caveat}.`,
    };
    steps.push(`To break even at this lift, the promo contribution would need to be under ${money(Math.max(0, extra ?? 0), currency)}.`);
  } else if (Math.abs(c) < FLAT) {
    out = {
      tone: "neutral",
      label: "No clear effect",
      headline: "No clear change in GGR",
      sub: `GGR moved ${pct(c)} compared with the ${m.windowDays} days before${caveat}.`,
    };
    steps.push("Review the mechanic or audience before running it again.");
  } else {
    out = {
      tone: "bad",
      label: "GGR down",
      headline: `GGR went down ${pctPlain(Math.abs(c), 1)} during the promo`,
      sub: `Compared with the ${m.windowDays} days before${caveat}.`,
    };
    steps.push("Check what else changed in that period before repeating this format.");
  }

  const f = m.missions;
  if (f && f.hardestStep != null) {
    const st = f.steps[f.hardestStep];
    if (st.dropFromPrev != null && st.dropFromPrev >= 0.45) steps.push(`${pctPlain(st.dropFromPrev)} of players stopped at “${st.name}” — consider making that step easier.`);
  }
  if (!m.isAdjusted) steps.push("Add a comparison group next time to confirm the promo itself caused the change.");
  return { ...out, nextSteps: steps.slice(0, 3) };
}

export const TONE_ORDER: OutcomeTone[] = ["good", "mixed", "neutral", "bad", "pending"];

const TONE_PHRASE: Record<OutcomeTone, (n: number) => string> = {
  good: (n) => `${n} raised GGR and paid back`,
  mixed: (n) => `${n} didn't pay back ${n === 1 ? "its" : "their"} cost`,
  neutral: (n) => `${n} had no clear effect`,
  bad: (n) => `${n} saw GGR fall`,
  pending: (n) => `${n} ${n === 1 ? "is" : "are"} still being measured`,
};

/** "3 promos ran: 2 raised GGR and paid back, 1 didn't pay back its cost." */
export function periodSummary(list: PromoMetrics[], currency: string) {
  const counts = new Map<OutcomeTone, number>();
  for (const m of list) {
    const t = outcomeFor(m, currency).tone;
    counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  const parts = TONE_ORDER.filter((t) => counts.get(t)).map((t) => ({ tone: t, count: counts.get(t)!, text: TONE_PHRASE[t](counts.get(t)!) }));
  return { total: list.length, parts };
}
