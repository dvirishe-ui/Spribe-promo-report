import { aggregate, type PromoMetrics } from "./metrics";
import { formatRange } from "./dates";
import { money, moneySigned, num, pct, pctPlain } from "./format";
import { outcomeFor, periodSummary } from "./verdict";
import type { Insight } from "./insights";

/**
 * Text reports built from the same metrics as the screens. Two audiences:
 *  - executiveSummary: short, internal, all operators in view
 *  - engagementReport: one promo in detail
 * Every number states whether it is observed or adjusted; nothing is invented
 * from missing data — absent numbers are left out, not guessed.
 */

const line = (s: string | false | null | undefined) => (s ? s : null);

export function executiveSummary(list: PromoMetrics[], period: string, insights: Insight[], cur: string): string {
  const a = aggregate(list);
  const { parts } = periodSummary(list, cur);
  return [
    `SPRIBE promotions — executive summary (${period})`,
    "",
    `${list.length} promotions: ${parts.map((p) => p.text).join(", ")}.`,
    line(a.duringVsBefore != null && `GGR vs baseline: ${pct(a.duringVsBefore)} (observed, during vs before)${a.adjustedCount ? `; ${pct(a.adjustedChange)} with market trend removed for ${a.adjustedCount} promos` : ""}.`),
    line(a.withParticipants > 0 && `Players took part: ${num(a.participants)} across ${a.withParticipants} promos.`),
    line(a.withCost > 0 && `Reward cost: ${money(a.cost, cur)}; extra GGR over baseline: ${moneySigned(a.netImpact + a.cost, cur)}.`),
    "",
    "What you need to know:",
    ...insights.slice(0, 3).map((i) => `• ${i.title} — ${i.metric} (${i.basis})`),
    "",
    "Figures are observed before/during/after comparisons unless marked adjusted. Aggregate data only.",
  ]
    .filter((l): l is string => l !== null)
    .join("\n");
}

export function engagementReport(m: PromoMetrics, cur: string): string {
  const o = outcomeFor(m, cur);
  const p = m.promo;
  const lines = [
    `${p.name} — engagement report`,
    `${[p.type, p.operator, p.market, p.games.join(", ")].filter(Boolean).join(" · ")} · ${formatRange(p.startDate, p.endDate)}`,
    "",
    `Result: ${o.headline}.`,
    `GGR before/during/after: ${money(m.ggrBefore, cur)} / ${money(m.ggrDuring, cur)} / ${money(m.ggrAfter, cur)} (${pct(m.duringVsBefore)} during, ${pct(m.afterVsBefore)} after; ${m.isAdjusted ? `adjusted: ${pct(m.adjustedChange)}` : "not adjusted for market trend"}).`,
  ];
  if (m.participants != null)
    lines.push(
      `Players: ${num(m.participants)} took part${m.eligibleRate != null ? ` (${pctPlain(m.eligibleRate)} of ${num(m.eligiblePlayers)} eligible)` : ""}${m.newShare != null ? `, ${pctPlain(m.newShare)} new` : ""}${m.retentionRate != null ? `, ${pctPlain(m.retentionRate)} came back after` : ""}.`,
    );
  if (m.missionDays) {
    lines.push("", `Missions: ${pctPlain(m.missionDays.overallRate)} of started missions were completed.`);
    for (const d of m.missionDays.days)
      lines.push(`  Day ${d.day} (${d.game}) “${d.requirement}”: ${num(d.completed)}/${num(d.started)} = ${pctPlain(d.rate)}${d.medianMinutes != null ? `, median ${d.medianMinutes} min` : ""}`);
    if (m.missionDays.biggestDrop) lines.push(`  Biggest drop: Day ${m.missionDays.biggestDrop.day} (${pct(m.missionDays.biggestDrop.rateChange)} pts).`);
  }
  if (m.missions) lines.push("", `Progression: ${m.missions.steps.map((s) => `${s.name} ${num(s.reached)}`).join(" → ")} (${pctPlain(m.missions.completionRate)} completed).`);
  if (m.leaderboard) lines.push("", `Rankings: ${num(m.leaderboard.winners)} winners, ${money(m.leaderboard.totalPrize, cur)} paid.`);
  if (p.prizePool != null) lines.push("", `Reward cost ${money(p.prizePool, cur)}${m.costPerParticipant != null ? ` (${money(m.costPerParticipant, cur)} per participant)` : ""}; net impact ${moneySigned(m.netImpact, cur)}.`);
  if (m.quality.missing.length) lines.push("", `Missing data: ${m.quality.missing.join(", ")}.`);
  lines.push("", "Next steps:", ...o.nextSteps.map((s) => `• ${s}`));
  return lines.join("\n");
}
