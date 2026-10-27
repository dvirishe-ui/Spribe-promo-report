import { isMissionType, type PromoMetrics } from "../metrics";
import { monthLabel } from "../dates";
import { num, pctPlain } from "../format";
import type { InsightConfig } from "./config";
import { change, fmtValue, pp, signed, size, type MetricFacts, type MetricKey, type PromoFacts } from "./facts";
import type { ComparableMetric, MarketContext, MarketSource } from "./market";

/**
 * The rule engine. Each rule reads the calculated facts and returns zero or
 * more structured insights; none of them invents a cause. Wording follows two
 * rules:
 *  - a relationship the numbers prove is stated as fact ("average bet fell
 *    from €2.40 to €1.80, so players placed more but smaller bets");
 *  - anything else is labelled as a possibility, with what would confirm it.
 *
 * To add a rule: write a function with the `Rule` signature and add it to
 * RULES (order matters only for `covered` — earlier rules can claim a metric
 * so the generic movement rule doesn't repeat it).
 */

export type Severity = "positive" | "mixed" | "negative" | "neutral";
export type InsightType = "market_relative" | "movement" | "cross_metric" | "pattern" | "participation" | "contribution" | "game";

export interface CalcBlock {
  title: string;
  rows: Array<{ label: string; value: string }>;
  formula?: string;
}

export interface PromoInsight {
  id: string;
  type: InsightType;
  severity: Severity;
  /** Higher = more important; used for ranking */
  priority: number;
  title: string;
  /** The finding with its supporting numbers */
  message: string;
  /** A short reading of what it means — or what can't be concluded */
  interpretation?: string;
  /** One sentence for the automatic summary */
  summary: string;
  /** The numbers behind it (percentages as percent, e.g. 18 = +18%) */
  facts: Record<string, number | null>;
  /** Plain-language reason the rule fired */
  why: string;
  calc: CalcBlock[];
  /** Where outside numbers came from (market source) */
  source?: string;
  /** "indicative" when two different measures are set side by side */
  confidence?: "indicative";
}

export interface RuleContext {
  f: PromoFacts;
  market: MarketContext;
  /** Every promo in the report, for "previous comparable promo" lookups */
  peers: PromoMetrics[];
  config: InsightConfig;
}

export type Rule = (ctx: RuleContext, covered: Set<MetricKey>) => PromoInsight[];

/* ---------------------------------------------------------------- helpers */

const pc = (v: number | null) => (v == null ? null : Math.round(v * 1000) / 10);
/** Priority bonus for bigger effects, capped so it never jumps a category. */
const bonus = (magnitude: number) => Math.min(9, Math.abs(magnitude));

function name(mf: MetricFacts) {
  return mf.kind === "flow" && mf.normalized ? `${mf.label} per day` : mf.label;
}

function lower(s: string) {
  return s === "GGR" || s.startsWith("GGR ") ? s : s.charAt(0).toLowerCase() + s.slice(1);
}

/** The calculation behind a change, as the UI's "Show calculation" shows it. */
export function changeCalc(f: PromoFacts, key: MetricKey, to: "during" | "after" = "during"): CalcBlock {
  const mf = f.metrics[key];
  const cur = f.currency;
  const v = (x: number | null) => fmtValue(key, x, cur);
  const row = (ph: "before" | "during" | "after") => {
    const pt = mf[ph];
    const label = `${ph[0].toUpperCase()}${ph.slice(1)} (${f.dates[ph]})`;
    if (mf.kind === "flow" && mf.normalized) return { label, value: `${v(pt.total)} ÷ ${pt.days} days = ${v(pt.value)}/day` };
    if (mf.kind === "flow") return { label, value: `${v(pt.total)} over ${pt.days} days` };
    return { label, value: v(pt.value) };
  };
  // Same-length windows: the totals themselves are compared (identical result to per day, and what the rows show).
  const useTotals = mf.kind === "flow" && !mf.normalized;
  const b = useTotals ? mf.before.total : mf.before.value;
  const t = useTotals ? mf[to].total : mf[to].value;
  const ch = to === "during" ? mf.duringVsBefore : mf.afterVsBefore;
  const toName = to === "during" ? "During" : "After";
  return {
    title: `${name(mf)} — ${toName.toLowerCase()} vs before`,
    rows: [row("before"), row(to)],
    formula:
      ch == null
        ? "Can't be calculated (a value is missing or the before value is zero)."
        : `(${toName} − Before) ÷ Before × 100 = (${v(t)} − ${v(b)}) ÷ ${v(b)} × 100 = ${signed(ch)}`,
  };
}

/** The parts a ratio metric is made of, e.g. wager ÷ bets for the average bet. */
function ratioCalc(f: PromoFacts, key: MetricKey): CalcBlock {
  const parts: Partial<Record<MetricKey, [MetricKey, MetricKey]>> = {
    avgBet: ["wager", "bets"],
    hold: ["ggr", "wager"],
    betsPerPlayer: ["bets", "players"],
    wagerPerPlayer: ["wager", "players"],
  };
  const [n, d] = parts[key]!;
  const mf = f.metrics[key];
  const row = (ph: "before" | "during") => ({
    label: `${ph[0].toUpperCase()}${ph.slice(1)}`,
    value: `${fmtValue(n, f.metrics[n][ph].total, f.currency)} ÷ ${fmtValue(d, f.metrics[d][ph].total, f.currency)} = ${fmtValue(key, mf[ph].value, f.currency)}`,
  });
  return {
    title: `${mf.label} = ${f.metrics[n].label.toLowerCase()} ÷ ${f.metrics[d].label.toLowerCase()} (window totals)`,
    rows: [row("before"), row("during")],
    formula: mf.duringVsBefore == null ? undefined : `Change: ${signed(mf.duringVsBefore)}`,
  };
}

const t = (ctx: RuleContext) => ctx.config.meaningfulChangeThreshold;
const isUp = (v: number | null, th: number): v is number => v != null && v >= th;
const isDown = (v: number | null, th: number): v is number => v != null && v <= -th;

/* ------------------------------------------------------- market-relative */

function sourcePhrase(src: MarketSource, metricLabel: string): string {
  if (src.kind === "comparison") return `the comparison group's ${lower(metricLabel)}`;
  return `the ${src.market} market's ${lower(metricLabel)}`;
}

function sourceLine(src: MarketSource): string {
  if (src.kind === "comparison") return `Comparison group — ${src.description} (${src.origin}). Period ${src.period} vs ${src.baseline}.`;
  return `${src.provider} (${src.origin}) · ${src.market} · ${src.period} vs ${src.baseline}${src.dateNote ? ` · ${src.dateNote}` : ""}`;
}

function relative(ctx: RuleContext, key: ComparableMetric, src: MarketSource, mkt: number, sameMeasure: boolean, activityLabel?: string): PromoInsight | null {
  const mf = ctx.f.metrics[key];
  const promo = mf.duringVsBefore;
  if (promo == null) return null;
  const rel = (promo - mkt) * 100;
  const tolPp = ctx.config.marketComparisonTolerancePp;
  const th = t(ctx);
  const what = name(mf);
  const them = src.kind === "comparison" ? "the comparison group" : "the market";
  const theirs = sameMeasure ? sourcePhrase(src, mf.label) : `broader market activity in ${src.market} (${activityLabel})`;
  const promoMove = `${what} ${promo >= 0 ? "increased" : "declined"} ${size(promo)}`;
  const mktMove = `${mkt >= 0 ? "increased" : "declined"} ${size(mkt)}`;

  let severity: Severity;
  let title: string;
  let message: string;
  if (Math.abs(rel) < tolPp) {
    severity = "neutral";
    title = sameMeasure ? `In line with ${them}` : "Moved with market activity";
    message = `${promoMove}; ${theirs} ${mktMove} over the same period — a gap of only ${pp(rel)}.`;
  } else if (rel > 0) {
    if (promo >= th) {
      severity = "positive";
      title = sameMeasure ? `Outperformed ${them}` : "Grew faster than market activity";
      message = `${promoMove}, compared with ${signed(mkt)} for ${theirs} — ${pp(rel)} ${sameMeasure ? `ahead of ${them}` : "difference"}.`;
    } else if (promo > -th) {
      severity = "positive";
      title = sameMeasure ? `Held steady while ${them} fell` : "Held steady while market activity fell";
      message = `${what} was about flat (${signed(promo)}) while ${theirs} ${mktMove} — ${pp(rel)} relative to ${them}.`;
    } else {
      severity = "mixed";
      title = sameMeasure ? `Declined, but less than ${them}` : "Declined, but less than market activity";
      message = `${promoMove}, but ${theirs} ${mktMove} over the same period. Relative to ${them}, that's about ${pp(rel)}.`;
    }
  } else if (promo >= th) {
    severity = "mixed";
    title = sameMeasure ? `Grew, but slower than ${them}` : "Grew, but slower than market activity";
    message = `${promoMove}, but ${theirs} grew more, at ${signed(mkt)}: up in absolute terms, ${pp(rel)} relative to ${them}.`;
  } else if (promo > -th) {
    severity = "negative";
    title = sameMeasure ? `Flat while ${them} grew` : "Flat while market activity grew";
    message = `${what} was about flat (${signed(promo)}) while ${theirs} ${mktMove} — ${pp(rel)} relative to ${them}.`;
  } else {
    severity = "negative";
    title = mkt > 0 ? (sameMeasure ? (src.kind === "comparison" ? "Declined while the comparison group grew" : "Declined despite market growth") : "Declined while market activity grew") : `Declined more than ${them}`;
    message = `${promoMove} while ${theirs} ${mktMove} — a ${Math.abs(rel).toFixed(1)} percentage-point relative underperformance.`;
  }

  const summaryLine = sameMeasure
    ? `${what} ${promo >= 0 ? "rose" : "fell"} ${size(promo)} while ${theirs} ${mkt >= 0 ? "rose" : "fell"} ${size(mkt)} (${pp(rel)}).`
    : `${what} ${promo >= 0 ? "rose" : "fell"} ${size(promo)}; broader market activity in ${src.market} ${mkt >= 0 ? "rose" : "fell"} about ${size(mkt)} according to ${src.provider}.`;

  return {
    id: `market-${key}-${src.id}${sameMeasure ? "" : "-activity"}`,
    type: "market_relative",
    severity,
    priority: ({ ggr: 100, wager: 96, bets: 92, players: 90 } as const)[key] - (sameMeasure ? 0 : 6) + bonus(rel / 3),
    title,
    message,
    interpretation: sameMeasure
      ? src.kind === "comparison"
        ? "The comparison group shows what happened without the promo over the same days, so the gap is the closest estimate of the promo's own effect."
        : undefined
      : `${src.provider}'s figure is ${activityLabel}, not ${mf.label}. Treat the gap as a direction check, not a like-for-like comparison.`,
    summary: summaryLine,
    facts: { promoChange: pc(promo), marketChange: pc(mkt), relativePp: Math.round(rel * 10) / 10 },
    why: `Shown because ${sameMeasure ? `${src.kind === "comparison" ? "a comparison group" : "market data"} for ${lower(mf.label)} covers the same dates as this promo` : `${src.provider}'s activity index covers the same dates`}. Relative performance = promo change − market change, in percentage points.`,
    calc: [
      changeCalc(ctx.f, key),
      {
        title: "Relative performance",
        rows: [
          { label: `Promo ${lower(what)}`, value: signed(promo) },
          { label: sameMeasure ? `Market (${src.provider})` : `Market activity (${activityLabel})`, value: signed(mkt) },
        ],
        formula: `Promo change − market change = ${signed(promo)} − (${signed(mkt)}) = ${pp(rel)}`,
      },
    ],
    source: sourceLine(src),
    confidence: sameMeasure ? undefined : "indicative",
  };
}

/** Wager, bets and active players vs the same market source, as one insight instead of three. */
function activityVsMarket(ctx: RuleContext, src: MarketSource, keys: ComparableMetric[]): PromoInsight {
  const tolPp = ctx.config.marketComparisonTolerancePp;
  const rows = keys.map((k) => {
    const mf = ctx.f.metrics[k];
    const promo = mf.duringVsBefore!;
    const mkt = src.changes[k]!;
    return { k, mf, promo, mkt, rel: (promo - mkt) * 100 };
  });
  const ahead = rows.filter((r) => r.rel >= tolPp).length;
  const behind = rows.filter((r) => r.rel <= -tolPp).length;
  const severity: Severity = ahead === rows.length ? "positive" : behind === rows.length ? "negative" : ahead === 0 && behind === 0 ? "neutral" : "mixed";
  const names = rows.map((r) => lower(r.mf.label));
  const list = names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : names[0];
  const them = src.kind === "comparison" ? "the comparison group" : `the ${src.market} market`;
  const title =
    severity === "positive" ? `Activity ahead of ${them}` : severity === "negative" ? `Activity behind ${them}` : severity === "neutral" ? `Activity in line with ${them}` : `Activity vs ${them}: mixed`;
  const avg = rows.reduce((a, r) => a + r.rel, 0) / rows.length;
  return {
    id: `market-activity-${src.id}`,
    type: "market_relative",
    severity,
    priority: 94 + bonus(avg / 3),
    title,
    message:
      rows.map((r, k) => `${k ? lower(r.mf.label) : r.mf.label} ${signed(r.promo)} (${src.kind === "comparison" ? "comparison group" : "market"} ${signed(r.mkt)}, ${pp(r.rel)})`).join("; ") +
      `. Market: ${src.provider}, ${src.market}, same dates.`,
    interpretation:
      severity === "mixed"
        ? `Ahead on ${rows.filter((r) => r.rel >= tolPp).map((r) => lower(r.mf.label)).join(", ") || "none"}, behind on ${rows.filter((r) => r.rel <= -tolPp).map((r) => lower(r.mf.label)).join(", ") || "none"}.`
        : undefined,
    summary: `Against ${them}: ${rows.map((r) => `${lower(r.mf.label)} ${pp(r.rel)}`).join(", ")}.`,
    facts: Object.fromEntries(rows.flatMap((r) => [[`${r.k}Change`, pc(r.promo)], [`${r.k}MarketChange`, pc(r.mkt)], [`${r.k}RelativePp`, Math.round(r.rel * 10) / 10]])),
    why: `Shown because ${src.provider} reports ${list} for the same dates. Relative performance = promo change − market change, in percentage points.`,
    calc: [
      ...rows.map((r) => changeCalc(ctx.f, r.k)),
      {
        title: "Relative performance",
        rows: rows.map((r) => ({ label: r.mf.label, value: `${signed(r.promo)} − (${signed(r.mkt)}) = ${pp(r.rel)}` })),
      },
    ],
    source: sourceLine(src),
  };
}

const marketRelative: Rule = (ctx, covered) => {
  const out: PromoInsight[] = [];
  for (const src of ctx.market.sources) {
    const mkt = src.changes.ggr;
    if (mkt != null) {
      const i = relative(ctx, "ggr", src, mkt, true);
      if (i) {
        out.push(i);
        covered.add("ggr");
      }
    }
    const others = (["wager", "bets", "players"] as ComparableMetric[]).filter(
      (k) => src.changes[k] != null && !ctx.f.metrics[k].unavailable && ctx.f.metrics[k].duringVsBefore != null,
    );
    if (others.length === 1) {
      const i = relative(ctx, others[0], src, src.changes[others[0]]!, true);
      if (i) out.push(i);
    } else if (others.length > 1) out.push(activityVsMarket(ctx, src, others));
    for (const k of others) covered.add(k);
    // An activity index is set against GGR only when no like-for-like GGR comparison exists.
    if (src.activity && !covered.has("ggr")) {
      const i = relative(ctx, "ggr", src, src.activity.change, false, src.activity.label);
      if (i) {
        out.push(i);
        covered.add("ggr");
      }
    }
  }
  return out;
};

/* ---------------------------------------------------------- cross-metric */

const crossMetric: Rule = (ctx, covered) => {
  const { metrics: M, currency: cur } = ctx.f;
  const th = t(ctx);
  const out: PromoInsight[] = [];
  const bets = M.bets.duringVsBefore;
  const wager = M.wager.duringVsBefore;
  const ggr = M.ggr.duringVsBefore;
  const players = M.players.duringVsBefore;
  const avg = M.avgBet;
  const v = (k: MetricKey, x: number | null) => fmtValue(k, x, cur);

  // Rule A — more bets, lower wager / Rule A' — fewer bets, higher wager.
  if ((isUp(bets, th) && isDown(wager, th)) || (isDown(bets, th) && isUp(wager, th))) {
    const more = bets! > 0;
    const a = avg.duringVsBefore;
    out.push({
      id: "cross-bets-wager",
      type: "cross_metric",
      severity: "mixed",
      priority: 66 + bonus((bets! - wager!) * 20),
      title: more ? "More bets, smaller stakes" : "Fewer bets, bigger stakes",
      message: `Bet count ${more ? "increased" : "decreased"} ${size(bets!)}, while wager ${more ? "decreased" : "increased"} ${size(wager!)}. Average bet ${a != null && a < 0 ? "fell" : "rose"} from ${v("avgBet", avg.before.value)} to ${v("avgBet", avg.during.value)} (${a == null ? "—" : signed(a)}).`,
      interpretation: more ? "Players placed more frequent but smaller bets." : "Fewer bets were placed, at a higher average stake per bet.",
      summary: `Bets ${more ? "rose" : "fell"} ${size(bets!)} but wager ${more ? "fell" : "rose"} ${size(wager!)}, as the average bet ${a != null && a < 0 ? "fell" : "rose"} ${a == null ? "" : size(a)}.`,
      facts: { betsChange: pc(bets), wagerChange: pc(wager), averageBetChange: pc(a) },
      why: `Shown because the number of bets and wager moved in opposite directions by at least ${pctPlain(th)} each.`,
      calc: [changeCalc(ctx.f, "bets"), changeCalc(ctx.f, "wager"), ratioCalc(ctx.f, "avgBet")],
    });
    covered.add("wager");
    covered.add("bets");
  } else if (wager != null && bets != null && avg.duringVsBefore != null && Math.abs(wager) >= th && Math.sign(wager) === Math.sign(bets)) {
    // Same direction: say whether frequency or stake size drove the wager change (wager = bets × average bet).
    const a = avg.duringVsBefore;
    const fromBets = Math.abs(Math.log1p(bets)) >= Math.abs(Math.log1p(a));
    const driver =
      fromBets && Math.sign(a) !== Math.sign(wager) && Math.abs(a) >= th
        ? `The change came from ${wager > 0 ? "betting more often" : "fewer bets"}, not from stake size — the average bet ${a < 0 ? "fell" : "rose"} ${size(a)}.`
        : fromBets
          ? `Most of it came from the number of bets (${signed(bets)}); the average bet moved ${signed(a)}.`
          : `Most of it came from the average bet (${v("avgBet", avg.before.value)} → ${v("avgBet", avg.during.value)}, ${signed(a)}); the number of bets moved ${signed(bets)}.`;
    out.push({
      id: "cross-wager-driver",
      type: "cross_metric",
      severity: "neutral",
      priority: 60 + bonus(wager * 20),
      title: fromBets ? (wager > 0 ? "Wager growth came from more bets" : "Wager fell with fewer bets") : wager > 0 ? "Wager growth came from bigger stakes" : "Wager fell with smaller stakes",
      message: `Wager ${wager > 0 ? "rose" : "fell"} ${size(wager)}. ${driver}`,
      interpretation: "Wager = number of bets × average bet, so this split is exact, not an estimate.",
      summary: `Wager ${wager > 0 ? "rose" : "fell"} ${size(wager)}, driven mainly by ${fromBets ? "the number of bets" : "the average bet"} (${fromBets ? signed(bets) : signed(a)}).`,
      facts: { wagerChange: pc(wager), betsChange: pc(bets), averageBetChange: pc(a) },
      why: `Shown because wager moved at least ${pctPlain(th)} and the number of bets moved the same way.`,
      calc: [changeCalc(ctx.f, "wager"), changeCalc(ctx.f, "bets"), ratioCalc(ctx.f, "avgBet")],
    });
    covered.add("wager");
    covered.add("bets");
  }

  // Rule B — wager up, GGR down / B' — GGR up, wager down: hold explains it.
  if ((isUp(wager, th) && isDown(ggr, th)) || (isUp(ggr, th) && isDown(wager, th))) {
    const h = M.hold;
    const volumeUp = wager! > 0;
    out.push({
      id: "cross-hold",
      type: "cross_metric",
      severity: "mixed",
      priority: 67 + bonus((wager! - ggr!) * 20),
      title: volumeUp ? "More wager, less GGR — lower hold" : "More GGR on less wager — higher hold",
      message: volumeUp
        ? `Wager increased ${size(wager!)}, but GGR decreased ${size(ggr!)}. Hold fell from ${v("hold", h.before.value)} to ${v("hold", h.during.value)}, offsetting the extra betting volume.`
        : `GGR increased ${size(ggr!)} despite ${size(wager!)} lower wager. Hold rose from ${v("hold", h.before.value)} to ${v("hold", h.during.value)}, which accounts for the GGR gain.`,
      interpretation: volumeUp
        ? "Hold moves with game outcomes (players' wins), so lower GGR here doesn't by itself mean weaker activity."
        : "The gain came from hold (game outcomes), not from more betting — it doesn't by itself show stronger engagement.",
      summary: volumeUp
        ? `Wager rose ${size(wager!)} but lower hold (${v("hold", h.before.value)} → ${v("hold", h.during.value)}) kept GGR ${size(ggr!)} lower.`
        : `GGR rose ${size(ggr!)} on ${size(wager!)} less wager because hold rose (${v("hold", h.before.value)} → ${v("hold", h.during.value)}).`,
      facts: { wagerChange: pc(wager), ggrChange: pc(ggr), holdBefore: pc(h.before.value), holdDuring: pc(h.during.value) },
      why: `Shown because wager and GGR moved in opposite directions by at least ${pctPlain(th)} each. Hold = GGR ÷ wager.`,
      calc: [changeCalc(ctx.f, "wager"), changeCalc(ctx.f, "ggr"), ratioCalc(ctx.f, "hold")],
    });
    covered.add("wager");
  }

  // Rule C — players vs betting frequency per player.
  const bpp = M.betsPerPlayer;
  const c = bpp.duringVsBefore;
  if (!M.players.unavailable && players != null && c != null && Math.abs(players) >= th && Math.abs(c) >= th) {
    const both = players > 0 && c > 0;
    const title =
      players > 0 && c < 0 ? "More players, less betting per player" : players < 0 && c > 0 ? "Fewer players, more betting per player" : both ? "More players, each betting more" : "Fewer players, each betting less";
    const severity: Severity = both ? "positive" : players < 0 && c < 0 ? "negative" : "mixed";
    out.push({
      id: "cross-players-frequency",
      type: "cross_metric",
      severity,
      priority: 64 + bonus(c * 20),
      title,
      message: `Active players ${players > 0 ? "increased" : "decreased"} ${size(players)}${bets != null ? ` and bets ${bets >= 0 ? "increased" : "decreased"} ${size(bets)}` : ""}. Bets per active player ${c < 0 ? "fell" : "rose"} from ${v("betsPerPlayer", bpp.before.value)} to ${v("betsPerPlayer", bpp.during.value)} (${signed(c)}).`,
      interpretation:
        players > 0 && c < 0
          ? "More players took part, but betting frequency per player weakened — the new activity was spread thinner."
          : players < 0 && c > 0
            ? "Fewer players were active, but those who stayed bet more often."
            : both
              ? "Both reach and betting frequency per player grew."
              : "Both reach and betting frequency per player declined.",
      summary: `Active players ${players > 0 ? "rose" : "fell"} ${size(players)} and bets per player ${c > 0 ? "rose" : "fell"} ${size(c)}.`,
      facts: { activePlayersChange: pc(players), betsChange: pc(bets), betsPerPlayerChange: pc(c) },
      why: `Shown because active players and bets per player each moved at least ${pctPlain(th)}.`,
      calc: [changeCalc(ctx.f, "players"), changeCalc(ctx.f, "bets"), ratioCalc(ctx.f, "betsPerPlayer")],
    });
    covered.add("players");
  }
  return out;
};

/* -------------------------------------------------------------- movement */

const movement: Rule = (ctx, covered) => {
  const out: PromoInsight[] = [];
  const th = t(ctx);
  const marketForGgr = ctx.market.sources.some((s) => s.changes.ggr != null || s.activity);
  for (const key of ["ggr", "wager"] as const) {
    if (covered.has(key)) continue;
    const mf = ctx.f.metrics[key];
    const ch = mf.duringVsBefore;
    if (ch == null) continue;
    if (key === "wager" && Math.abs(ch) < th) continue;
    const what = name(mf);
    const severity: Severity = ch >= th ? "positive" : ch <= -th ? "negative" : "neutral";
    const flat = severity === "neutral";
    out.push({
      id: `move-${key}`,
      type: "movement",
      severity,
      priority: (key === "ggr" ? 88 : 80) + bonus(ch * 20),
      title: flat ? `${what} about flat` : `${what} ${ch > 0 ? "up" : "down"} ${size(ch)}`,
      message: `${what} was ${fmtValue(key, mf.during.value, ctx.f.currency)} during the promo vs ${fmtValue(key, mf.before.value, ctx.f.currency)} before (${signed(ch)}).`,
      interpretation: key === "ggr" && !marketForGgr ? "No market data covers these dates, so this is the raw change — it can't be separated from the market trend." : undefined,
      summary: `${what} ${flat ? `was about flat (${signed(ch)})` : `${ch > 0 ? "rose" : "fell"} ${size(ch)}`} during the promo${key === "ggr" && !marketForGgr ? " (not adjusted for the market)" : ""}.`,
      facts: { [`${key}Before`]: mf.before.value, [`${key}During`]: mf.during.value, [`${key}Change`]: pc(ch) },
      why: flat
        ? `${mf.label} moved less than ${pctPlain(th)} — described as about flat, not good or bad.`
        : `Shown because ${mf.label.toLowerCase()} moved by ${pctPlain(th)} or more (the configured threshold).`,
      calc: [changeCalc(ctx.f, key)],
    });
    covered.add(key);
  }
  return out;
};

/* ------------------------------------------------- before / during / after */

const pattern: Rule = (ctx) => {
  const out: PromoInsight[] = [];
  if (!ctx.f.afterFinal) return out;
  const th = t(ctx);
  const tol = ctx.config.baselineTolerance;
  const g = ctx.f.metrics.ggr;
  const d = g.duringVsBefore;
  const a = g.afterVsBefore;
  if (d != null && a != null) {
    const what = name(g);
    let r: { severity: Severity; title: string; text: string; pri: number } | null = null;
    if (d >= th && Math.abs(a) <= tol)
      r = { severity: "neutral", title: "Temporary uplift", pri: 50, text: `${what} rose ${size(d)} during the promo and returned close to the pre-promo level afterwards (${signed(a)} vs before).` };
    else if (d >= th && a > tol)
      r = { severity: "positive", title: "Uplift persisted after the promo", pri: 55, text: `${what} rose ${size(d)} during the promo and stayed ${size(a)} above the before level after it ended.` };
    else if (d >= th && a < -tol)
      r = { severity: "mixed", title: "Dipped below baseline after the promo", pri: 56, text: `${what} rose ${size(d)} during the promo, then fell to ${size(a)} below the before level after it ended.` };
    else if (Math.abs(d) < th && a < -tol)
      r = { severity: "negative", title: "Lower after the promo", pri: 54, text: `${what} was about flat during the promo (${signed(d)}) and ${size(a)} below the before level afterwards.` };
    else if (Math.abs(d) < th && a > tol)
      r = { severity: "neutral", title: "Higher after the promo", pri: 45, text: `${what} was about flat during the promo (${signed(d)}) and ${size(a)} above the before level afterwards.` };
    else if (d <= -th && a >= -tol)
      r = { severity: "mixed", title: "Declined during, recovered after", pri: 54, text: `${what} declined ${size(d)} during the campaign and recovered after it ended (${signed(a)} vs before).` };
    else if (d <= -th && a < -tol)
      r = { severity: "negative", title: "Stayed below baseline", pri: 57, text: `${what} declined ${size(d)} during the promo and was still ${size(a)} below the before level afterwards.` };
    if (r)
      out.push({
        id: "pattern-ggr",
        type: "pattern",
        severity: r.severity,
        priority: r.pri + bonus(a * 20),
        title: r.title,
        message: r.text,
        interpretation: r.title === "Uplift persisted after the promo" ? "The uplift persisted after the promotion; on its own this doesn't show the promotion caused lasting retention." : undefined,
        summary: r.text,
        facts: { duringVsBefore: pc(d), afterVsBefore: pc(a), baselineTolerance: pc(tol) },
        why: `Compares all three windows. "Close to baseline" means within ±${pctPlain(tol)} of the before level (configurable).`,
        calc: [changeCalc(ctx.f, "ggr"), changeCalc(ctx.f, "ggr", "after")],
      });
  }
  const pl = ctx.f.metrics.players;
  const pa = pl.afterVsBefore;
  if (!pl.unavailable && pa != null && Math.abs(pa) >= th) {
    out.push({
      id: "pattern-players",
      type: "pattern",
      severity: pa > 0 ? "positive" : "negative",
      priority: (pa > 0 ? 50 : 53) + bonus(pa * 20),
      title: pa > 0 ? "More active players after the promo" : "Fewer active players after the promo",
      message: `Active players after the campaign were ${size(pa)} ${pa > 0 ? "above" : "below"} the pre-promotion baseline (${num(pl.after.value)} vs ${num(pl.before.value)}).`,
      interpretation: pa > 0 ? "The higher level persisted after the promotion; this alone doesn't prove the promo caused it." : undefined,
      summary: `Active players ended ${size(pa)} ${pa > 0 ? "above" : "below"} the before level after the promo.`,
      facts: { playersBefore: pl.before.value, playersAfter: pl.after.value, afterVsBefore: pc(pa) },
      why: `Shown because active players after the promo differ from before by ${pctPlain(th)} or more.`,
      calc: [changeCalc(ctx.f, "players", "after")],
    });
  }
  return out;
};

/* ---------------------------------------------------------- participation */

function previousComparable(m: PromoMetrics, peers: PromoMetrics[]): { prev: PromoMetrics; basis: string } | null {
  const earlier = peers.filter((x) => x.promo.id !== m.promo.id && x.promo.startDate < m.promo.startDate && x.participationRate != null);
  const pick = (list: PromoMetrics[]) => [...list].sort((a, b) => b.promo.startDate.localeCompare(a.promo.startDate))[0];
  const sameOp = earlier.filter((x) => x.promo.operator === m.promo.operator && x.promo.type === m.promo.type);
  if (sameOp.length) return { prev: pick(sameOp), basis: `the previous ${m.promo.type} at ${m.promo.operator}` };
  const sameMarket = earlier.filter((x) => x.promo.market === m.promo.market && x.promo.type === m.promo.type);
  if (sameMarket.length) return { prev: pick(sameMarket), basis: `the previous ${m.promo.type} in ${m.promo.market}` };
  return null;
}

const participation: Rule = (ctx) => {
  const m = ctx.f.m;
  const rate = m.participationRate;
  if (rate == null) return [];
  const p = m.promo;
  const counted = !m.participationReported && m.participants != null && p.playersDuring != null;
  const base = counted
    ? `${num(m.participants)} of ${num(p.playersDuring)} active players took part — a ${pctPlain(rate, 1)} participation rate.`
    : `The Back Office reports a ${pctPlain(rate, 1)} participation rate.`;
  const eligible = m.eligibleRate != null ? ` That's ${pctPlain(m.eligibleRate, 1)} of the ${num(m.eligiblePlayers)} eligible players.` : "";
  const prev = previousComparable(m, ctx.peers);
  const calc: CalcBlock[] = [
    {
      title: "Participation rate",
      rows: counted
        ? [
            { label: "Participants", value: num(m.participants) },
            { label: "Active players during", value: num(p.playersDuring) },
          ]
        : [{ label: "Reported by the Back Office", value: pctPlain(rate, 1) }],
      formula: counted ? `Participants ÷ active players × 100 = ${num(m.participants)} ÷ ${num(p.playersDuring)} × 100 = ${pctPlain(rate, 1)}` : undefined,
    },
  ];
  if (!prev) {
    return [
      {
        id: "participation",
        type: "participation",
        severity: "neutral",
        priority: 40,
        title: `Participation ${pctPlain(rate, 1)}`,
        message: base + eligible,
        interpretation: "There's no earlier comparable promo to compare with, so this isn't called high or low.",
        summary: `Participation reached ${pctPlain(rate, 1)} of active players.`,
        facts: { participants: m.participants, activePlayers: p.playersDuring, participationRate: pc(rate) },
        why: "Participation is shown for every promo that reports participants and active players.",
        calc,
      },
    ];
  }
  const was = prev.prev.participationRate!;
  const diff = (rate - was) * 100;
  const thr = ctx.config.participationChangeThresholdPp;
  const severity: Severity = diff >= thr ? "positive" : diff <= -thr ? "negative" : "neutral";
  let interpretation: string | undefined;
  if (severity === "negative") {
    const f = m.missions;
    interpretation =
      f && f.hardestStep != null
        ? `The mission funnel lost the most players at "${f.steps[f.hardestStep].name}" (${pctPlain(f.steps[f.hardestStep].dropFromPrev, 0)} dropped there) — one place to look; the data doesn't show why.`
        : `${isMissionType(p.type) ? "Mission difficulty, visibility" : "Visibility, eligibility"} and reward attractiveness are possible factors, but this report doesn't contain enough information to determine the cause.`;
  }
  calc.push({
    title: `Compared with ${prev.prev.promo.name} (${monthLabel(prev.prev.month)})`,
    rows: [
      { label: "Earlier promo", value: pctPlain(was, 1) },
      { label: "This promo", value: pctPlain(rate, 1) },
    ],
    formula: `${pctPlain(rate, 1)} − ${pctPlain(was, 1)} = ${pp(diff)}`,
  });
  return [
    {
      id: "participation",
      type: "participation",
      severity,
      priority: 70 + bonus(diff),
      title: severity === "neutral" ? "Participation similar to last time" : `Participation ${diff > 0 ? "up" : "down"} ${Math.abs(diff).toFixed(1)} pp`,
      message: `${base} ${severity === "neutral" ? "About the same as" : diff > 0 ? "Up from" : "Down from"} ${pctPlain(was, 1)} in ${prev.basis} (${prev.prev.promo.name}, ${monthLabel(prev.prev.month)}) — ${pp(diff)}.${eligible}`,
      interpretation,
      summary: `Participation reached ${pctPlain(rate, 1)} of active players (${pp(diff)} vs ${prev.basis}).`,
      facts: { participationRate: pc(rate), previousRate: pc(was), changePp: Math.round(diff * 10) / 10 },
      why: `Compared with ${prev.basis}; a change of ${thr} pp or more is called up or down (configurable). No benchmark is used to call a rate high or low.`,
      calc,
    },
  ];
};

/* ----------------------------------------------------------- contribution */

const contribution: Rule = (ctx) => {
  const m = ctx.f.m;
  const p = m.promo;
  const playersShare = m.participants != null && p.playersDuring ? m.participants / p.playersDuring : null;
  if (playersShare == null || m.participationReported) return [];
  const shares = [
    { key: "wager", label: "wager", v: p.participantWagerDuring != null && m.turnoverDuring ? p.participantWagerDuring / m.turnoverDuring : null },
    { key: "bets", label: "bets", v: p.betsDuring != null && p.totalBetsDuring ? p.betsDuring / p.totalBetsDuring : null },
    { key: "ggr", label: "GGR", v: p.participantGgrDuring != null && m.ggrDuring && m.ggrDuring > 0 ? p.participantGgrDuring / m.ggrDuring : null },
  ].filter((s): s is { key: string; label: string; v: number } => s.v != null && s.v >= 0 && s.v <= 1);
  if (!shares.length) return [];
  const main = shares[0];
  const x = main.v / playersShare;
  const r = ctx.config.disproportionRatio;
  const high = x >= r;
  const low = x <= 1 / r;
  const rest = shares.slice(1).map((s) => `${pctPlain(s.v, 1)} of ${s.label}`);
  return [
    {
      id: "contribution",
      type: "contribution",
      severity: "neutral",
      priority: high || low ? 46 : 30,
      title: high ? `Participants drove ${pctPlain(main.v, 0)} of ${main.label}` : low ? `Participants: small share of ${main.label}` : `Participants' share in proportion`,
      message: `Promo participants were ${pctPlain(playersShare, 1)} of active players ${high || low ? "but" : "and"} generated ${pctPlain(main.v, 1)} of ${main.label}${rest.length ? ` (and ${rest.join(", ")})` : ""}.`,
      interpretation: high
        ? `That's ${x.toFixed(1)}× their share of players — participants bet disproportionately more than other players.`
        : low
          ? `That's ${x.toFixed(1)}× their share of players — participants wagered less per head than other players.`
          : `That's ${x.toFixed(1)}× their share of players — roughly in proportion.`,
      summary: `Participants were ${pctPlain(playersShare, 1)} of active players and generated ${pctPlain(main.v, 1)} of ${main.label}.`,
      facts: { participantShareOfPlayers: pc(playersShare), [`participantShareOf_${main.key}`]: pc(main.v), ratio: Math.round(x * 100) / 100 },
      why: `Shown when both the participants' share of players and their share of ${main.label} are reported. "Disproportionate" = at least ${r}× (or at most 1/${r}) their share of players (configurable).`,
      calc: [
        {
          title: "Shares during the promo",
          rows: [
            { label: "Participants ÷ active players", value: `${num(m.participants)} ÷ ${num(p.playersDuring)} = ${pctPlain(playersShare, 1)}` },
            ...shares.map((s) => ({ label: `Participants' share of ${s.label}`, value: pctPlain(s.v, 1) })),
          ],
          formula: `${pctPlain(main.v, 1)} ÷ ${pctPlain(playersShare, 1)} = ${x.toFixed(2)}×`,
        },
      ],
    },
  ];
};

/* ------------------------------------------------------------------ games */

const games: Rule = (ctx) => {
  const m = ctx.f.m;
  const list = m.promo.gameGgr ?? [];
  const th = t(ctx);
  const out: PromoInsight[] = [];
  const wd = m.windowDays;
  const pd = m.promoDays;
  // Per day, like the promo totals: games share the promo's windows.
  const ch = (b: number | null | undefined, d: number | null | undefined) => change(b == null ? null : b / wd, d == null ? null : d / pd);
  const share = m.gameContribution;
  const top = share?.[0];
  const topLine = top ? ` ${top.game} was the biggest contributor, with ${pctPlain(top.share, 0)} of promo-period GGR.` : "";

  for (const [metric, label, get] of [
    ["wager", "wager", (g: (typeof list)[number]) => ch(g.wagerBefore, g.wagerDuring)],
    ["ggr", "GGR", (g: (typeof list)[number]) => ch(g.ggrBefore, g.ggrDuring)],
    ["bets", "bet count", (g: (typeof list)[number]) => ch(g.betsBefore, g.betsDuring)],
  ] as const) {
    const rows = list.map((g) => ({ game: g.game, c: get(g) })).filter((x): x is { game: string; c: number } => x.c != null).sort((a, b) => b.c - a.c);
    if (rows.length < 2) continue;
    const best = rows[0];
    const worst = rows[rows.length - 1];
    const spread = (best.c - worst.c) * 100;
    if (spread < ctx.config.outlierThresholdPp) continue;
    out.push({
      id: `games-${metric}`,
      type: "game",
      severity: "neutral",
      priority: 55 + bonus(spread / 5),
      title: `${best.game} led, ${worst.game} trailed`,
      message: `${best.game} recorded the strongest ${label} growth during the promotion at ${signed(best.c)}, while ${worst.game} ${worst.c < 0 ? `declined ${size(worst.c)}` : `grew only ${size(worst.c)}`}.${topLine}`,
      summary: `${best.game} grew ${label} most (${signed(best.c)}); ${worst.game} was weakest (${signed(worst.c)}).`,
      facts: { strongestChange: pc(best.c), weakestChange: pc(worst.c), spreadPp: Math.round(spread * 10) / 10 },
      why: `Shown because the gap between the strongest and weakest game is at least ${ctx.config.outlierThresholdPp} pp (configurable).`,
      calc: [
        {
          title: `${label[0].toUpperCase()}${label.slice(1)} per day by game, during vs before`,
          rows: rows.map((r) => ({ label: r.game, value: signed(r.c) })),
          formula: `Spread: ${signed(best.c)} − (${signed(worst.c)}) = ${pp(spread)}`,
        },
      ],
    });
    break; // one game-growth insight is enough
  }

  // A game gaining players but losing wager per player.
  if (wd === pd) {
    const per = list
      .map((g) => {
        const pl = change(g.playersBefore, g.playersDuring);
        const wpp = change(g.wagerBefore != null && g.playersBefore ? g.wagerBefore / g.playersBefore : null, g.wagerDuring != null && g.playersDuring ? g.wagerDuring / g.playersDuring : null);
        return { g, pl, wpp };
      })
      .filter((x) => isUp(x.pl, th) && isDown(x.wpp, th))
      .sort((a, b) => a.wpp! - b.wpp!);
    const x = per[0];
    if (x)
      out.push({
        id: `games-players-${x.g.game}`,
        type: "game",
        severity: "mixed",
        priority: 50 + bonus(x.wpp! * 20),
        title: `${x.g.game}: more players, less wager each`,
        message: `${x.g.game} active players increased ${size(x.pl!)}, but wager per player decreased ${size(x.wpp!)}.`,
        summary: `${x.g.game} gained players (${signed(x.pl!)}) but wager per player fell ${size(x.wpp!)}.`,
        facts: { playersChange: pc(x.pl), wagerPerPlayerChange: pc(x.wpp) },
        why: `Shown because a game's active players rose and its wager per player fell, each by at least ${pctPlain(th)}.`,
        calc: [
          {
            title: x.g.game,
            rows: [
              { label: "Active players", value: `${num(x.g.playersBefore)} → ${num(x.g.playersDuring)} (${signed(x.pl!)})` },
              { label: "Wager", value: `${fmtValue("wager", x.g.wagerBefore ?? null, ctx.f.currency)} → ${fmtValue("wager", x.g.wagerDuring ?? null, ctx.f.currency)}` },
            ],
            formula: `Wager per player change = ${signed(x.wpp!)}`,
          },
        ],
      });
  }

  // A game gaining bets but losing average stake.
  const stake = list
    .map((g) => ({
      g,
      b: ch(g.betsBefore, g.betsDuring),
      a: change(g.wagerBefore != null && g.betsBefore ? g.wagerBefore / g.betsBefore : null, g.wagerDuring != null && g.betsDuring ? g.wagerDuring / g.betsDuring : null),
    }))
    .filter((x) => isUp(x.b, th) && isDown(x.a, th))
    .sort((a, b) => a.a! - b.a!);
  if (stake[0]) {
    const x = stake[0];
    out.push({
      id: `games-stake-${x.g.game}`,
      type: "game",
      severity: "mixed",
      priority: 48 + bonus(x.a! * 20),
      title: `${x.g.game}: more bets, smaller stakes`,
      message: `${x.g.game} bets rose ${size(x.b!)}, but its average stake fell ${size(x.a!)}.`,
      summary: `${x.g.game} bets rose ${size(x.b!)} at a ${size(x.a!)} lower average stake.`,
      facts: { betsChange: pc(x.b), averageBetChange: pc(x.a) },
      why: `Shown because a game's bets rose and its average bet fell, each by at least ${pctPlain(th)}.`,
      calc: [
        {
          title: x.g.game,
          rows: [
            { label: "Bets", value: `${num(x.g.betsBefore)} → ${num(x.g.betsDuring)}` },
            { label: "Wager", value: `${fmtValue("wager", x.g.wagerBefore ?? null, ctx.f.currency)} → ${fmtValue("wager", x.g.wagerDuring ?? null, ctx.f.currency)}` },
          ],
          formula: `Average bet = wager ÷ bets; change ${signed(x.a!)}`,
        },
      ],
    });
  }

  // Only the GGR split is known: say which game carried the promo.
  if (!out.length && share && share.length > 1 && top) {
    out.push({
      id: "games-share",
      type: "game",
      severity: "neutral",
      priority: 25,
      title: `${top.game} carried ${pctPlain(top.share, 0)} of GGR`,
      message: `${top.game} generated ${pctPlain(top.share, 0)} of GGR during the promo across ${share.length} games${share[1] ? `; next was ${share[1].game} at ${pctPlain(share[1].share, 0)}` : ""}.`,
      interpretation: "Per-game before-promo numbers aren't reported, so game trends can't be compared.",
      summary: `${top.game} generated ${pctPlain(top.share, 0)} of promo-period GGR.`,
      facts: { topShare: pc(top.share) },
      why: "Shown for multi-game promos that report GGR by game.",
      calc: [{ title: "GGR during the promo by game", rows: share.map((s) => ({ label: s.game, value: `${fmtValue("ggr", s.ggr, ctx.f.currency)} (${pctPlain(s.share, 1)})` })) }],
    });
  }
  return out;
};

/** In order: rules that claim a metric run before the generic movement rule. */
export const RULES: Rule[] = [marketRelative, crossMetric, movement, pattern, participation, contribution, games];
