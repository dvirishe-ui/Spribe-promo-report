import { parseDay } from "./dates";
import { pctPlain } from "./format";
import type { MissionDayRow, PromoMetrics } from "./metrics";

/**
 * Possible explanations for a mission day that underperformed. These are
 * hypotheses built from the numbers — each one names the evidence it rests on
 * and none of them is presented as the proven cause.
 */

export interface Explanation {
  text: string;
  evidence: string;
}

export interface DayInvestigation {
  problem: string;
  lostPlayers: number;
  explanations: Explanation[];
  history: Array<{ promo: PromoMetrics; day: MissionDayRow; why: string }>;
  nextStep: string;
}

const multiplier = (req: string) => {
  const m = req.match(/×\s?(\d+)/);
  return m ? Number(m[1]) : null;
};

export function investigateDay(m: PromoMetrics, day: number, all: PromoMetrics[]): DayInvestigation | null {
  const s = m.missionDays;
  if (!s) return null;
  const d = s.days.find((x) => x.day === day);
  if (!d) return null;
  const prev = s.days.find((x) => x.day === day - 1) ?? null;
  const next = s.days.find((x) => x.day === day + 1) ?? null;
  const others = s.days.filter((x) => x.day !== day);
  const typicalRate = others.reduce((a, x) => a + x.completed, 0) / Math.max(1, others.reduce((a, x) => a + x.started, 0));

  const problem =
    d.rateChange != null && d.rateChange < 0
      ? `Day ${d.day} completion was ${pctPlain(d.rate)}, down ${Math.round(-d.rateChange * 100)} points from Day ${d.day - 1}.`
      : `Day ${d.day} completion was ${pctPlain(d.rate)} vs ${pctPlain(typicalRate)} on the other days.`;

  const ex: Explanation[] = [];
  if (d.medianMinutes != null && s.typicalMinutes != null && d.medianMinutes > s.typicalMinutes * 2) {
    ex.push({
      text: "The mission may have been too hard or too long for one day.",
      evidence: `Players who finished took a median ${d.medianMinutes} min vs ${Math.round(s.typicalMinutes)} min on a typical day.`,
    });
  }
  const mult = multiplier(d.requirement);
  const otherMults = others.map((x) => multiplier(x.requirement)).filter((v): v is number => v != null);
  if (mult != null && mult >= 20 && (otherMults.length === 0 || mult > Math.max(...otherMults) * 3)) {
    ex.push({
      text: "Success depended on a rare outcome rather than on effort.",
      evidence: `It required a ×${mult} win; the other days needed at most ×${otherMults.length ? Math.max(...otherMults) : "—"}.`,
    });
  }
  if (prev && prev.game !== d.game) {
    const gameDays = all.flatMap((x) => x.missionDays?.days.filter((y) => y.game === d.game && !(x.promo.id === m.promo.id && y.day === d.day)) ?? []);
    if (gameDays.length >= 2) {
      const gr = gameDays.reduce((a, y) => a + y.completed, 0) / gameDays.reduce((a, y) => a + y.started, 0);
      if (gr < typicalRate - 0.05)
        ex.push({
          text: `Switching to ${d.game} may have lost players.`,
          evidence: `Day ${d.day - 1} was ${prev.game}; ${d.game} missions complete at ${pctPlain(gr)} across ${gameDays.length} other mission days.`,
        });
    }
  }
  const dow = m.promo.startDate ? new Date(parseDay(m.promo.startDate) + (day - 1) * 86_400_000).getUTCDay() : null;
  if (dow === 0 || dow === 6) ex.push({ text: "It fell on a weekend, when play patterns differ.", evidence: `Day ${day} was a ${dow === 0 ? "Sunday" : "Saturday"}.` });

  const lostPlayers = d.started - d.completed;
  if (next && next.started < d.started * 0.85)
    ex.push({ text: "Failing this day appears to have pushed players out of the promo.", evidence: `${Math.round((1 - next.started / d.started) * 100)}% fewer players opened Day ${next.day}.` });

  // Historical: similar requirements or the same game elsewhere.
  const history = all
    .filter((x) => x.promo.id !== m.promo.id && x.missionDays)
    .flatMap((x) =>
      x.missionDays!.days
        .filter((y) => (mult != null && multiplier(y.requirement) === mult) || y.requirement === d.requirement)
        .map((y) => ({ promo: x, day: y, why: y.requirement === d.requirement ? "same requirement" : `same ×${mult} target` })),
    )
    .slice(0, 4);

  const nextStep =
    ex[0]?.text.startsWith("Success depended") || (mult != null && mult >= 20)
      ? `Consider a lower target (e.g. ×${Math.max(5, Math.round((mult ?? 20) / 5))}) or giving players two days for this mission.`
      : d.medianMinutes != null && s.typicalMinutes != null && d.medianMinutes > s.typicalMinutes * 2
        ? "Consider shortening the mission or splitting it across two days."
        : "Review the requirement wording and how it was communicated to players.";

  return { problem, lostPlayers, explanations: ex, history, nextStep };
}
