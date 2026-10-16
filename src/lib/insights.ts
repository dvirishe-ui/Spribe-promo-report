import { median, type PromoMetrics } from "./metrics";
import { money, pct, pctPlain } from "./format";
import { findDuplicates } from "./quality";
import type { PromoRecord } from "./types";

/**
 * Smart insights & alerts. Fixed, documented rules — no AI, no guessing.
 * Every insight states:
 *   1. what happened            (title)
 *   2. the metric that fired     (metric)
 *   3. the comparison/threshold  (basis)
 *   4. where the evidence is     (link)
 *   5. a next step, if justified (action)
 * Rules need a minimum amount of data; with too little, they stay silent.
 */

export type InsightLink =
  | { kind: "promo"; id: string; tab?: string; day?: number }
  | { kind: "operator"; operator: string }
  | { kind: "data" }
  | { kind: "promotions" };

export interface Insight {
  id: string;
  severity: 1 | 2 | 3; // 3 = most important
  tone: "good" | "bad" | "warn" | "neutral";
  category: "Performance" | "Participation" | "Missions" | "Cost" | "Data" | "Responsible gaming";
  title: string;
  metric: string;
  basis: string;
  link: InsightLink;
  linkLabel: string;
  action?: string;
  promoId?: string;
  operator?: string;
}

const MIN_PEERS = 4;

const done = (list: PromoMetrics[]) => list.filter((m) => m.status === "complete" || m.status === "measuring");

export function buildInsights(list: PromoMetrics[], allPromos: PromoRecord[], opts: { syncError?: string | null; currency: string }): Insight[] {
  const out: Insight[] = [];
  const cur = opts.currency;
  const measured = done(list).filter((m) => m.primaryChange != null);

  // Baseline summary — the "8 of 12 exceeded their baseline" headline.
  if (measured.length >= 3) {
    const above = measured.filter((m) => m.primaryChange! > 0.03);
    out.push({
      id: "baseline-summary",
      severity: 2,
      tone: above.length >= measured.length / 2 ? "good" : "warn",
      category: "Performance",
      title: `${above.length} of ${measured.length} promotions beat their GGR baseline`,
      metric: "GGR change per day, during vs before",
      basis: "“Beat” = more than +3%; adjusted for market trend where a comparison group exists",
      link: { kind: "promotions" },
      linkLabel: "See promotions",
    });
  }

  // Large GGR swings on a single promo.
  for (const m of measured) {
    if (Math.abs(m.primaryChange!) >= 0.3) {
      const up = m.primaryChange! > 0;
      out.push({
        id: `swing-${m.promo.id}`,
        severity: up ? 1 : 3,
        tone: up ? "good" : "bad",
        category: "Performance",
        title: `${m.promo.name}: GGR ${up ? "up" : "down"} ${pctPlain(Math.abs(m.primaryChange!))}`,
        metric: `GGR change ${pct(m.primaryChange)}${m.isAdjusted ? " (adjusted)" : " (not adjusted)"}`,
        basis: "Threshold: a change of 30% or more vs the before period",
        link: { kind: "promo", id: m.promo.id },
        linkLabel: "Open report",
        action: up ? "Check what was different about this setup before reusing it." : "Look at what changed in that period before running it again.",
        promoId: m.promo.id,
        operator: m.promo.operator,
      });
    }
  }

  // Unusually low participation (vs other promos with the same data).
  const withRate = measured.filter((m) => m.participationRate != null);
  if (withRate.length >= MIN_PEERS) {
    const med = median(withRate.map((m) => m.participationRate!))!;
    for (const m of withRate) {
      if (m.participationRate! < med * 0.6) {
        out.push({
          id: `low-part-${m.promo.id}`,
          severity: 2,
          tone: "warn",
          category: "Participation",
          title: `Low participation in ${m.promo.name}`,
          metric: `${pctPlain(m.participationRate)} of active players took part`,
          basis: `Typical promo: ${pctPlain(med)} (median of ${withRate.length}); flagged below 60% of that`,
          link: { kind: "promo", id: m.promo.id, tab: "players" },
          linkLabel: "See players",
          action: "Review how the promo was announced and who was eligible.",
          promoId: m.promo.id,
          operator: m.promo.operator,
        });
      }
    }
  }

  // Mission drop-off: a day whose completion rate fell sharply.
  for (const m of done(list)) {
    const d = m.missionDays?.biggestDrop;
    if (d && d.rateChange! <= -0.25) {
      out.push({
        id: `dropoff-${m.promo.id}`,
        severity: 3,
        tone: "bad",
        category: "Missions",
        title: `Players dropped off at Day ${d.day} of ${m.promo.name}`,
        metric: `Day ${d.day} completion ${pctPlain(d.rate)} (${Math.round(d.rateChange! * 100)} pts vs Day ${d.day - 1})`,
        basis: "Threshold: completion falls 25 points or more from one day to the next",
        link: { kind: "promo", id: m.promo.id, tab: "missions", day: d.day },
        linkLabel: `Investigate Day ${d.day}`,
        action: `Review the Day ${d.day} requirement (“${d.requirement}”).`,
        promoId: m.promo.id,
        operator: m.promo.operator,
      });
    }
  }

  // Unusually high reward cost per participant.
  const withCpp = measured.filter((m) => m.costPerParticipant != null);
  if (withCpp.length >= MIN_PEERS) {
    const med = median(withCpp.map((m) => m.costPerParticipant!))!;
    for (const m of withCpp) {
      if (m.costPerParticipant! > med * 2.5) {
        out.push({
          id: `cost-${m.promo.id}`,
          severity: 2,
          tone: "warn",
          category: "Cost",
          title: `High reward cost per player in ${m.promo.name}`,
          metric: `${money(m.costPerParticipant, cur)} per participant`,
          basis: `Typical promo: ${money(med, cur)} (median of ${withCpp.length}); flagged above 2.5×`,
          link: { kind: "promo", id: m.promo.id, tab: "financials" },
          linkLabel: "See financials",
          action: "Check the prize structure against the expected audience size.",
          promoId: m.promo.id,
          operator: m.promo.operator,
        });
      }
    }
  }

  // Operator participation decline: latest promo vs that operator's earlier ones.
  const byOp = new Map<string, PromoMetrics[]>();
  for (const m of withRate) byOp.set(m.promo.operator, [...(byOp.get(m.promo.operator) ?? []), m]);
  for (const [op, items] of byOp) {
    if (items.length < 3) continue;
    const sorted = [...items].sort((a, b) => a.promo.startDate.localeCompare(b.promo.startDate));
    const last = sorted[sorted.length - 1];
    const prev = median(sorted.slice(0, -1).map((m) => m.participationRate!))!;
    if (last.participationRate! < prev * 0.7) {
      out.push({
        id: `op-decline-${op}`,
        severity: 2,
        tone: "warn",
        category: "Participation",
        title: `${op}: participation fell in the latest promo`,
        metric: `${pctPlain(last.participationRate)} in ${last.promo.name}`,
        basis: `Their earlier promos: ${pctPlain(prev)} (median of ${sorted.length - 1}); flagged below 70% of that`,
        link: { kind: "operator", operator: op },
        linkLabel: "Open operator",
        action: `Raise participation with ${op} at the next meeting.`,
        operator: op,
      });
    }
  }

  // Responsible gaming: engagement far above normal is a signal to check, not a success.
  const withBets = measured.filter((m) => m.betsPerParticipant != null);
  if (withBets.length >= MIN_PEERS) {
    const med = median(withBets.map((m) => m.betsPerParticipant!))!;
    for (const m of withBets) {
      if (m.betsPerParticipant! > med * 2) {
        out.push({
          id: `rg-${m.promo.id}`,
          severity: 2,
          tone: "warn",
          category: "Responsible gaming",
          title: `Unusually intense play in ${m.promo.name}`,
          metric: `${m.betsPerParticipant!.toFixed(0)} bets per participant`,
          basis: `Typical promo: ${med.toFixed(0)} (median of ${withBets.length}); flagged above 2×`,
          link: { kind: "promo", id: m.promo.id, tab: "players" },
          linkLabel: "See players",
          action: "Ask the operator to review responsible-gaming signals for this promo.",
          promoId: m.promo.id,
          operator: m.promo.operator,
        });
      }
    }
  }

  // Data: incomplete promos, duplicates, sync problems.
  const incomplete = list.filter((m) => m.status === "complete" && m.quality.level !== "complete");
  if (incomplete.length) {
    out.push({
      id: "data-incomplete",
      severity: incomplete.some((m) => m.quality.level === "minimal") ? 2 : 1,
      tone: "neutral",
      category: "Data",
      title: `${incomplete.length} completed promo${incomplete.length === 1 ? " is" : "s are"} missing data`,
      metric: `Missing most often: ${topMissing(incomplete)}`,
      basis: "Checked against the data each promo type needs",
      link: { kind: "data" },
      linkLabel: "Review data",
    });
  }
  const dups = findDuplicates(allPromos);
  if (dups.length) {
    out.push({
      id: "data-duplicates",
      severity: 2,
      tone: "warn",
      category: "Data",
      title: `${dups.length} promo${dups.length === 1 ? " looks" : "s look"} duplicated`,
      metric: dups.map((g) => g[0].name).slice(0, 2).join(", "),
      basis: "Same operator, name and dates entered more than once",
      link: { kind: "data" },
      linkLabel: "Review data",
      action: "Delete the extra copy so totals aren't counted twice.",
    });
  }
  if (opts.syncError) {
    out.push({
      id: "data-sync",
      severity: 3,
      tone: "bad",
      category: "Data",
      title: "Latest numbers couldn't be loaded",
      metric: opts.syncError,
      basis: "The data source returned an error; the last loaded numbers are shown",
      link: { kind: "data" },
      linkLabel: "Check source",
    });
  }

  return out.sort((a, b) => b.severity - a.severity || toneRank(a) - toneRank(b));
}

function toneRank(i: Insight) {
  return { bad: 0, warn: 1, good: 2, neutral: 3 }[i.tone];
}

function topMissing(list: PromoMetrics[]): string {
  const c = new Map<string, number>();
  for (const m of list) for (const x of m.quality.missing) c.set(x, (c.get(x) ?? 0) + 1);
  return [...c.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([k, n]) => `${k} (${n})`)
    .join(", ");
}

/** Up to three for the Overview: at most one per category, most important first. */
export function topInsights(all: Insight[], n = 3): Insight[] {
  const seen = new Set<string>();
  const out: Insight[] = [];
  for (const i of all) {
    if (seen.has(i.category)) continue;
    seen.add(i.category);
    out.push(i);
    if (out.length === n) break;
  }
  return out;
}

