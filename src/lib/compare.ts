import type { PromoMetrics } from "./metrics";
import { parseDay } from "./dates";
import { money, multiple, pct, pctPlain } from "./format";

/** Series colour for the i-th compared promo (validated categorical order; 8 slots). */
export const SERIES = ["var(--cat-1)", "var(--cat-2)", "var(--cat-3)", "var(--cat-4)", "var(--cat-5)", "var(--cat-6)", "var(--cat-7)", "var(--cat-8)"];
/** Above this many promos, individual colours stop being readable — show a summary first. */
export const MAX_SERIES = 6;

export function seriesColor(i: number, n: number): string {
  return n <= MAX_SERIES ? SERIES[i % SERIES.length] : "var(--color-muted-foreground)";
}

/** Short, unique labels: the promo name, plus the operator when the same name appears twice. */
export function shortLabels(list: PromoMetrics[]): Map<string, string> {
  const count = new Map<string, number>();
  for (const m of list) count.set(m.promo.name, (count.get(m.promo.name) ?? 0) + 1);
  return new Map(list.map((m) => [m.promo.id, count.get(m.promo.name)! > 1 ? `${m.promo.name} · ${m.promo.operator.replace(/^Operator\s+/i, "")}` : m.promo.name]));
}

export interface Caveat {
  text: string;
  /** Changes how the numbers should be read — shown inline, not only behind the info icon */
  material: boolean;
}

/** Differences that make a side-by-side comparison less fair. Flags, not blockers. */
export function comparability(list: PromoMetrics[]): Caveat[] {
  const out: Caveat[] = [];
  if (list.length < 2) return out;
  const set = (f: (m: PromoMetrics) => string) => new Set(list.map(f));
  if (set((m) => m.promo.currency).size > 1) out.push({ text: "Different currencies — converted with the rates in Settings.", material: true });
  if (list.some((m) => m.promo.fxMissing)) out.push({ text: "Some promos have no exchange rate and are left out of money figures.", material: true });
  if (list.some((m) => m.status !== "complete")) out.push({ text: "Some results aren't final yet.", material: true });
  if (set((m) => String(m.isAdjusted)).size > 1) out.push({ text: "Some GGR changes are adjusted for the market trend, others aren't.", material: true });
  const days = list.map((m) => m.promoDays);
  if (Math.max(...days) > Math.min(...days) * 1.5)
    out.push({ text: `Different lengths (${Math.min(...days)}–${Math.max(...days)} days) — compare per-day figures, not totals.`, material: true });
  if (set((m) => m.promo.market).size > 1) out.push({ text: "Different markets — player behaviour and seasonality differ.", material: false });
  if (set((m) => m.promo.type).size > 1) out.push({ text: "Different mechanics — they aim at different things.", material: false });
  const pops = list.map((m) => m.participants).filter((v): v is number => v != null);
  if (pops.length > 1 && Math.max(...pops) > Math.min(...pops) * 3) out.push({ text: "Very different player numbers — percentages from small promos move more easily.", material: false });
  out.push({ text: "GGR changes are before vs during; they show what happened, not proof the promo caused it.", material: false });
  return out;
}

/** Two to four one-line differences worth knowing, each backed by the numbers on screen. */
export function keyDifferences(list: PromoMetrics[], labels: Map<string, string>, cur: string): string[] {
  const out: string[] = [];
  const L = (m: PromoMetrics) => labels.get(m.promo.id)!;
  const by = (f: (m: PromoMetrics) => number | null) =>
    list.filter((m) => f(m) != null && Number.isFinite(f(m)!)).sort((a, b) => f(b)! - f(a)!);

  const ch = by((m) => m.duringVsBefore);
  if (ch.length >= 2) {
    const hi = ch[0];
    const lo = ch[ch.length - 1];
    out.push(`GGR change: ${L(hi)} ${pct(hi.duringVsBefore)} vs ${L(lo)} ${pct(lo.duringVsBefore)} (${Math.abs((hi.duringVsBefore! - lo.duringVsBefore!) * 100).toFixed(1)} pts apart).`);
  }
  const perDay = by((m) => (m.ggrDuring == null ? null : m.ggrDuring / m.promoDays));
  if (perDay.length >= 2)
    out.push(`Most GGR per day during: ${L(perDay[0])} ${money(perDay[0].ggrDuring! / perDay[0].promoDays, cur)}/day.`);
  const roi = by((m) => m.promoRoi);
  if (roi.length >= 2) out.push(`Promo ROI: best ${L(roi[0])} ${multiple(roi[0].promoRoi)}, lowest ${L(roi[roi.length - 1])} ${multiple(roi[roi.length - 1].promoRoi)}.`);
  const part = by((m) => m.participationRate);
  if (part.length >= 2) out.push(`Highest participation: ${L(part[0])} ${pctPlain(part[0].participationRate, 1)}.`);
  return out.slice(0, 4);
}

export interface TrendSeries {
  id: string;
  points: Array<{ day: number; index: number; value: number }>;
  /** Last day of the promo itself (day 0 = first day) */
  endDay: number;
}

/**
 * Daily GGR lined up by day since each promo started, indexed so the average
 * day before the promo = 100. Different-sized promos then share one scale.
 * Promos without a daily series are left out (and listed by the caller).
 */
export function indexedTrends(list: PromoMetrics[]): TrendSeries[] {
  const out: TrendSeries[] = [];
  for (const m of list) {
    const daily = m.promo.daily;
    if (!daily?.length) continue;
    const start = parseDay(m.promo.startDate);
    const before = daily.filter((d) => d.date < m.promo.startDate);
    const base = before.length ? before.reduce((s, d) => s + d.ggr, 0) / before.length : null;
    if (!base || base <= 0) continue;
    out.push({
      id: m.promo.id,
      endDay: m.promoDays - 1,
      points: daily.map((d) => ({ day: Math.round((parseDay(d.date) - start) / 86_400_000), index: (d.ggr / base) * 100, value: d.ggr })),
    });
  }
  return out;
}
