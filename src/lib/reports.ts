import { aggregate, median, type PromoMetrics } from "./metrics";
import { formatRange } from "./dates";
import { money, moneySigned, num, pct, pctPlain } from "./format";
import { outcomeFor, periodSummary } from "./verdict";
import type { Insight } from "./insights";
import type { FollowUp } from "./actions";

/**
 * Text reports built from the same metrics as the screens. Three audiences:
 *  - executiveSummary: short, internal, all operators in view
 *  - operatorBrief:    for an AM's meeting; `external` drops everything internal
 *  - engagementReport: one promo in detail
 * Every number states whether it is observed or adjusted; nothing is invented
 * from missing data — absent numbers are left out, not guessed.
 */

const line = (s: string | false | null | undefined) => (s ? s : null);

/** "It worked…" → "it worked…", but leave acronyms like "GGR" alone. */
const lowerFirst = (s: string) => (/^[A-Z][a-z]/.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s);

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

export interface BriefSection {
  title: string;
  items: string[];
}

/**
 * Operator meeting brief. With `external`, it contains only this operator's
 * own promos and results: no other operators, no internal benchmarks by name,
 * no internal follow-ups.
 */
export function operatorBrief(
  operator: string,
  mine: PromoMetrics[],
  everyone: PromoMetrics[],
  actions: FollowUp[],
  cur: string,
  external = false,
): BriefSection[] {
  const done = mine.filter((m) => m.status === "complete" && m.primaryChange != null).sort((a, b) => b.promo.startDate.localeCompare(a.promo.startDate));
  const recent = done.slice(0, 3);
  const sections: BriefSection[] = [];

  sections.push({
    title: "Recent results",
    items: recent.length
      ? recent.map((m) => {
          const o = outcomeFor(m, cur);
          return `${m.promo.name} (${formatRange(m.promo.startDate, m.promo.endDate)}): ${lowerFirst(o.headline)}${m.participants != null ? `; ${num(m.participants)} players took part` : ""}.`;
        })
      : ["No completed promotions with results yet."],
  });

  // Important changes: latest vs their own earlier results.
  const changes: string[] = [];
  if (done.length >= 2) {
    const latest = done[0];
    const earlier = median(done.slice(1).map((m) => m.primaryChange!))!;
    const diff = latest.primaryChange! - earlier;
    if (Math.abs(diff) >= 0.05)
      changes.push(`Latest promo's GGR change (${pct(latest.primaryChange)}) is ${diff > 0 ? "above" : "below"} their typical result (${pct(earlier)}, median of ${done.length - 1}).`);
    const parts = done.filter((m) => m.participationRate != null);
    if (parts.length >= 2) {
      const l = parts[0];
      const typ = median(parts.slice(1).map((m) => m.participationRate!))!;
      if (Math.abs(l.participationRate! - typ) >= 0.08)
        changes.push(`Participation in ${l.promo.name} was ${pctPlain(l.participationRate)} vs a typical ${pctPlain(typ)}.`);
    }
  }
  sections.push({ title: "Important changes", items: changes.length ? changes : ["No large changes vs their earlier promotions."] });

  // What worked: promotion types with their best average result (min 1 promo, say the sample size).
  const byType = new Map<string, PromoMetrics[]>();
  for (const m of done) byType.set(m.promo.type, [...(byType.get(m.promo.type) ?? []), m]);
  const types = [...byType.entries()]
    .map(([t, items]) => ({ t, n: items.length, c: aggregate(items).duringVsBefore }))
    .filter((x) => x.c != null)
    .sort((a, b) => b.c! - a.c!);
  sections.push({
    title: "What worked",
    items: types.length
      ? types.slice(0, 2).map((x) => `${x.t}: ${pct(x.c)} GGR vs baseline (${x.n} promo${x.n === 1 ? "" : "s"}${x.n < 3 ? " — small sample" : ""}).`)
      : ["Not enough completed promotions to compare mechanics yet."],
  });

  // Issues worth discussing.
  const issues: string[] = [];
  for (const m of done) {
    const o = outcomeFor(m, cur);
    if (o.tone === "mixed" || o.tone === "bad") issues.push(`${m.promo.name}: ${o.label.toLowerCase()} (${o.sub.replace(/\.$/, "")}).`);
    const d = m.missionDays?.biggestDrop;
    if (d && d.rateChange! <= -0.25) issues.push(`${m.promo.name}: completion fell to ${pctPlain(d.rate)} on Day ${d.day} (“${d.requirement}”).`);
  }
  sections.push({ title: "Issues worth discussing", items: issues.length ? issues.slice(0, 4) : ["Nothing flagged."] });

  // Opportunities backed by history: mechanics that did well for others in the same market (internal only) or for them.
  const opps: string[] = [];
  if (!external) {
    const markets = new Set(mine.map((m) => m.promo.market));
    const usedTypes = new Set(mine.map((m) => m.promo.type));
    const peers = everyone.filter((m) => markets.has(m.promo.market) && m.promo.operator !== operator && m.status === "complete" && m.primaryChange != null);
    const peerTypes = new Map<string, PromoMetrics[]>();
    for (const m of peers) if (!usedTypes.has(m.promo.type)) peerTypes.set(m.promo.type, [...(peerTypes.get(m.promo.type) ?? []), m]);
    for (const [t, items] of peerTypes) {
      const c = aggregate(items).duringVsBefore;
      if (c != null && c > 0.1) opps.push(`${t} hasn't been tried yet; in the same market it averaged ${pct(c)} (${items.length} promo${items.length === 1 ? "" : "s"} by other operators).`);
    }
  }
  if (types[0] && types[0].c! > 0.1) opps.push(`Repeat ${types[0].t} — their strongest mechanic so far.`);
  sections.push({ title: "Opportunities", items: opps.length ? opps.slice(0, 3) : ["No clear opportunity in the data yet."] });

  // Talking points: short, in order.
  const points: string[] = [];
  if (recent[0]) points.push(`Walk through ${recent[0].promo.name}: ${pct(recent[0].primaryChange)} GGR vs baseline${recent[0].isAdjusted ? " (adjusted)" : ""}.`);
  if (issues[0]) points.push(`Discuss: ${issues[0]}`);
  if (opps[0]) points.push(`Propose: ${opps[0]}`);
  const upcoming = mine.filter((m) => m.status === "upcoming");
  if (upcoming.length) points.push(`Confirm setup for upcoming: ${upcoming.map((m) => `${m.promo.name} (${formatRange(m.promo.startDate, m.promo.endDate)})`).join(", ")}.`);
  sections.push({ title: "Suggested talking points", items: points.length ? points : ["Review results together and agree the next promotion."] });

  if (!external) {
    const open = actions.filter((a) => a.operator === operator && a.status !== "done");
    sections.push({ title: "Open follow-ups (internal)", items: open.length ? open.map((a) => `${a.title}${a.owner ? ` — ${a.owner}` : ""}${a.due ? `, due ${a.due}` : ""}`) : ["None."] });
  }
  return sections;
}

export function briefText(operator: string, sections: BriefSection[], external: boolean): string {
  return [
    `${external ? "Promotion results" : "Meeting brief"}: ${operator}`,
    "",
    ...sections.flatMap((s) => [s.title, ...s.items.map((i) => `• ${i}`), ""]),
    "GGR changes are per day vs the same number of days before each promo; observed unless marked adjusted.",
  ].join("\n");
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
