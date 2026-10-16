import { aggregate, type PromoMetrics } from "./metrics";
import { moneySigned, multiple, pct } from "./format";

/**
 * Key findings: up to three short, rule-based observations about the promos
 * currently shown. No AI and no guessing — every rule needs a minimum amount
 * of data, and each finding carries the evidence it is based on.
 */

export type FindingAction =
  | { kind: "filter"; dimension: "type" | "market" | "aggregator" | "operator"; value: string }
  | { kind: "promo"; id: string };

export interface Finding {
  id: string;
  tone: "good" | "bad" | "neutral";
  text: string;
  evidence: string;
  action?: FindingAction;
}

const MIN_PER_GROUP = 2;

function bestSegment(list: PromoMetrics[], overall: number | null): Finding | null {
  const dims = [
    ["type", "promotion type"],
    ["market", "market"],
    ["aggregator", "aggregator"],
  ] as const;
  for (const [dim, word] of dims) {
    const groups = new Map<string, PromoMetrics[]>();
    for (const m of list) {
      if (m.primaryChange == null || !m.promo[dim]) continue;
      groups.set(m.promo[dim], [...(groups.get(m.promo[dim]) ?? []), m]);
    }
    const ranked = [...groups.entries()]
      .filter(([, items]) => items.length >= MIN_PER_GROUP)
      .map(([key, items]) => ({ key, items, change: aggregate(items).duringVsBefore }))
      .filter((g) => g.change != null)
      .sort((a, b) => b.change! - a.change!);
    // Only meaningful when there are at least two groups to compare.
    if (ranked.length < 2) continue;
    const top = ranked[0];
    const adjusted = top.items.filter((m) => m.isAdjusted).length;
    return {
      id: `segment-${dim}`,
      tone: "neutral",
      text: `${top.key} had the biggest GGR change of any ${word}: ${pct(top.change)}${overall != null ? ` vs ${pct(overall)} overall` : ""}.`,
      evidence: `${top.items.length} promos · before vs during per day${adjusted < top.items.length ? " · not fully adjusted for market trend" : ""}`,
      action: { kind: "filter", dimension: dim, value: top.key },
    };
  }
  return null;
}

function afterEffect(list: PromoMetrics[]): Finding | null {
  const withAfter = list.filter((m) => m.afterVsBefore != null && m.status === "complete");
  if (withAfter.length < 3) return null;
  const a = aggregate(withAfter).afterVsBefore;
  if (a == null) return null;
  const evidence = `${withAfter.length} completed promos · after vs before per day`;
  if (a >= 0.03)
    return { id: "after", tone: "good", text: `Once promos ended, GGR stayed ${pct(a)} above the before period.`, evidence };
  if (a <= -0.03)
    return {
      id: "after",
      tone: "bad",
      text: `Once promos ended, GGR fell ${pct(a)} below the before period — promos may be pulling play forward.`,
      evidence,
    };
  return { id: "after", tone: "neutral", text: "Once promos ended, GGR went back to about the before level.", evidence };
}

function costCoverage(list: PromoMetrics[], currency: string): Finding | null {
  const priced = list.filter((m) => m.netImpact != null && m.promo.prizePool && m.status === "complete");
  if (priced.length < 2) return null;
  const losing = priced.filter((m) => m.netImpact! < 0);
  if (losing.length) {
    const worst = [...losing].sort((a, b) => a.netImpact! - b.netImpact!)[0];
    return {
      id: "cost",
      tone: "bad",
      text: `${losing.length} of ${priced.length} promos didn't earn back their cost in extra GGR — the biggest gap was ${worst.promo.name} (${moneySigned(worst.netImpact, currency)}).`,
      evidence: `${priced.length} completed promos with cost and GGR data`,
      action: { kind: "promo", id: worst.promo.id },
    };
  }
  const best = [...priced].sort((a, b) => (b.roi ?? 0) - (a.roi ?? 0))[0];
  return {
    id: "cost",
    tone: "good",
    text: `Every promo earned back its cost; ${best.promo.name} did best with ${multiple((best.roi ?? 0) + 1)} its cost in extra GGR.`,
    evidence: `${priced.length} completed promos with cost and GGR data`,
    action: { kind: "promo", id: best.promo.id },
  };
}

export function keyFindings(list: PromoMetrics[], currency: string): Finding[] {
  const overall = aggregate(list).duringVsBefore;
  return [bestSegment(list, overall), costCoverage(list, currency), afterEffect(list)].filter((f): f is Finding => f != null).slice(0, 3);
}
