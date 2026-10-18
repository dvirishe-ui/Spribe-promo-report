import type { MonthlyRecord } from "./types";
import { median, type PromoMetrics } from "./metrics";
import { formatMetric, rollup, type MetricFormat, type Rollup } from "./rollup";
import { formatRange, monthLabel, prevMonth, todayIso } from "./dates";
import { outcomeFor } from "./verdict";

/**
 * "Ask" — answers plain-language questions about the promos using the same
 * numbers as the rest of the site. It runs entirely in the browser with
 * fixed rules (no AI service, no API calls, nothing to pay for): it picks out
 * promo names, operators, markets, types, games and months from the question,
 * works out which metric is meant and whether it's a comparison, a ranking,
 * a total, a count or a lookup, then answers from the data.
 *
 * It never invents a number: anything missing is said to be missing, and
 * changes are labelled observed (before vs during) like everywhere else.
 */

export interface AnswerTable {
  head: string[];
  rows: string[][];
  /** Promo id per row, to make the row clickable */
  ids?: Array<string | null>;
}

export interface Answer {
  /** Paragraphs; **text** is shown in bold */
  text: string[];
  table?: AnswerTable;
  /** A short caveat under the answer */
  note?: string;
  /** Follow-up questions to offer */
  followUps?: string[];
  /** Promo reports to open */
  links?: Array<{ label: string; id: string }>;
  understood: boolean;
}

interface MetricDef {
  key: keyof Rollup;
  label: string;
  format: MetricFormat;
  per: (m: PromoMetrics) => number | null;
  /** Lower is better (for "best"/"worst") */
  lowerIsBetter?: boolean;
}

const extraOf = (m: PromoMetrics) => (m.incrementalGgr == null ? null : m.incrementalGgr + (m.haloGgr ?? 0));

const METRICS: Record<string, MetricDef> = {
  during: { key: "during", label: "GGR during", format: "money", per: (m) => m.ggrDuring },
  before: { key: "before", label: "GGR before", format: "money", per: (m) => m.ggrBefore },
  after: { key: "after", label: "GGR after", format: "money", per: (m) => m.ggrAfter },
  dvb: { key: "dvb", label: "GGR during vs before", format: "change", per: (m) => m.duringVsBefore },
  avb: { key: "avb", label: "GGR after vs before", format: "change", per: (m) => m.afterVsBefore },
  contribution: { key: "contribution", label: "promo contribution", format: "money", per: (m) => m.promo.prizePool, lowerIsBetter: true },
  wager: { key: "wager", label: "total wager", format: "money", per: (m) => m.turnoverDuring },
  participants: { key: "participants", label: "players who took part", format: "count", per: (m) => m.participants },
  part: { key: "part", label: "participation rate", format: "rate", per: (m) => m.participationRate },
  rtp: { key: "rtp", label: "RTP", format: "rate", per: (m) => m.rtp },
  extra: { key: "extra", label: "extra GGR", format: "money", per: extraOf },
  roi: { key: "roi", label: "Promo ROI", format: "roi", per: (m) => m.promoRoi },
};

/** Phrase → metric, checked in order (specific phrases first). */
const METRIC_WORDS: Array<[RegExp, string]> = [
  [/\broi\b|return on|worth it|pay(?:ed)? ?back|paid off|profitab/, "roi"],
  [/\brtp\b|return to player/, "rtp"],
  [/participation|part\.? ?rate|share of (?:active )?players/, "part"],
  [/after (?:vs|versus|compared (?:to|with)) before|after the promo|after it ended|\blast(?:ed|ing)\b|stick|retain/, "avb"],
  [/during (?:vs|versus|compared (?:to|with)) before|uplift|\blift\b|grow|grew|growth|increase|change|improv|impact|perform|vs before|compared to before/, "dvb"],
  [/\bextra\b|incremental|additional/, "extra"],
  [/wager|turnover|\bbets?\b|staked|handle/, "wager"],
  [/contribution|\bcosts?\b|spent|spend|prize|budget|reward|expensive|cheap/, "contribution"],
  [/\bplayers?\b|participants?|people|users/, "participants"],
  [/ggr before|before the promo|baseline/, "before"],
  [/ggr after/, "after"],
  [/\bggr\b|revenue|\bmade\b|\bmake\b|\bearn|generat|income|money/, "during"],
];

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const MONTH_SHORT = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const STOP = new Set(["the", "a", "an", "of", "in", "on", "for", "and", "or", "vs", "to", "did", "do", "does", "how", "much", "what", "which", "was", "is", "it", "with", "by", "promo", "promotion", "promos", "promotions"]);

function tokens(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9.%]+/g, " ")
    .split(" ")
    .filter(Boolean);
}

interface Group {
  label: string;
  list: PromoMetrics[];
  kind: "promo" | "operator" | "market" | "type" | "game" | "aggregator" | "month";
  /** The single promo, when the group is exactly one */
  id?: string;
}

interface Parsed {
  promos: Group[];
  operators: Group[];
  markets: Group[];
  types: Group[];
  games: Group[];
  aggregators: Group[];
  months: string[];
  /** A year on its own ("in 2026") when no month is named */
  year: string | null;
  metric: MetricDef | null;
  intent: "compare" | "rank" | "total" | "count" | "when" | "lookup";
  direction: 1 | -1;
  superWord: string | null;
  groupBy: Group["kind"] | null;
  average: boolean;
}

/** Fraction of a name's meaningful tokens found in the question, and which positions they used. */
/** Words that don't identify anything on their own ("Operator Alpha" is matched by "alpha"). */
const GENERIC = new Set(["operator"]);

function matchName(name: string, qt: string[], used: Set<number>): { score: number; at: number[] } {
  const nt = tokens(name).filter((t) => !STOP.has(t) && !GENERIC.has(t));
  if (!nt.length) return { score: 0, at: [] };
  const at: number[] = [];
  for (const t of nt) {
    const i = qt.findIndex((q, k) => q === t && !used.has(k) && !at.includes(k));
    if (i >= 0) at.push(i);
  }
  return { score: at.length / nt.length, at };
}

function pickEntities(names: string[], qt: string[], used: Set<number>, minTokens: number): Array<{ name: string; at: number[] }> {
  const cands = names
    .map((name) => ({ name, ...matchName(name, qt, used) }))
    .filter((c) => c.score >= 0.99 || (c.score >= 0.6 && c.at.length >= minTokens))
    .sort((a, b) => b.score - a.score || b.at.length - a.at.length);
  const out: Array<{ name: string; at: number[] }> = [];
  for (const c of cands) {
    if (c.at.some((i) => used.has(i))) continue;
    c.at.forEach((i) => used.add(i));
    out.push(c);
  }
  // Keep the order they were mentioned in ("compare A and B" → A first).
  return out.sort((a, b) => Math.min(...a.at) - Math.min(...b.at));
}

/** "september", "sep 2026", "2026-09", "last month", "this month" → YYYY-MM list. */
function parseMonths(q: string, known: string[]): string[] {
  const out = new Set<string>();
  const today = todayIso().slice(0, 7);
  if (/last month|previous month/.test(q)) out.add(prevMonth(today));
  if (/this month|current month/.test(q)) out.add(today);
  for (const m of q.match(/\b20\d\d-[01]\d\b/g) ?? []) out.add(m);
  const yearM = q.match(/\b(20\d\d)\b/);
  const re = new RegExp(`\\b(${[...MONTHS, ...MONTH_SHORT].join("|")})\\b`, "g");
  for (const hit of q.matchAll(re)) {
    const word = hit[1];
    // "may" is also a verb; only take it next to a year or "in"/"of"
    if (word === "may" && !/\b(in|of|during) may\b|\bmay 20\d\d\b/.test(q)) continue;
    const idx = (MONTHS.indexOf(word) + 1 || MONTH_SHORT.indexOf(word) + 1) - 1;
    const mm = String(idx + 1).padStart(2, "0");
    if (yearM) out.add(`${yearM[1]}-${mm}`);
    else {
      const candidates = known.filter((k) => k.endsWith(`-${mm}`)).sort();
      out.add(candidates.length ? candidates[candidates.length - 1] : `${today.slice(0, 4)}-${mm}`);
    }
  }
  return [...out];
}

function parse(question: string, all: PromoMetrics[]): Parsed {
  const q = question.toLowerCase();
  const qt = tokens(question);
  const used = new Set<number>();
  const uniq = (xs: string[]) => [...new Set(xs.filter(Boolean))];

  const promoNames = uniq(all.map((m) => m.promo.name)).sort((a, b) => b.length - a.length);
  const promoHits = pickEntities(promoNames, qt, used, 2);
  // Operators: full name, or the distinctive part ("Alpha" of "Operator Alpha").
  const opNames = uniq(all.map((m) => m.promo.operator));
  const opHits = pickEntities(opNames, qt, used, 1).filter((h) => h.at.length >= 1);
  const markets = pickEntities(uniq(all.map((m) => m.promo.market)), qt, used, 1);
  const types = pickEntities(uniq(all.map((m) => m.promo.type)), qt, used, 2);
  const aggs = pickEntities(uniq(all.map((m) => m.promo.aggregator)).filter((a) => a !== "Direct"), qt, used, 2);
  const games = pickEntities(uniq(all.flatMap((m) => m.promo.games)), qt, used, 1);
  const months = parseMonths(q, uniq(all.map((m) => m.month)));

  const opFilter = opHits.map((h) => h.name);
  const promos: Group[] = promoHits.map((h) => {
    let list = all.filter((m) => m.promo.name === h.name);
    if (opFilter.length) {
      const narrowed = list.filter((m) => opFilter.includes(m.promo.operator));
      if (narrowed.length) list = narrowed;
    }
    return { label: h.name + (list.length === 1 && all.filter((m) => m.promo.name === h.name).length > 1 ? ` (${list[0].promo.operator})` : ""), list, kind: "promo", id: list.length === 1 ? list[0].promo.id : undefined };
  });
  const group = (kind: Group["kind"], hits: Array<{ name: string }>, f: (m: PromoMetrics, n: string) => boolean): Group[] =>
    hits.map((h) => ({ label: h.name, list: all.filter((m) => f(m, h.name)), kind }));

  // Strip metric phrases containing "vs" before deciding whether the question compares things.
  const qCompare = q.replace(/(during|after) (vs|versus|compared (to|with)) before|vs before/g, "");
  const compareWord = /\bvs\.?\b|versus|compare|compared (to|with)|against|difference|better than|\bor\b/.test(qCompare);
  const superlative = q.match(/\b(best|top|highest|most|biggest|largest|strongest|greatest|worst|lowest|least|smallest|weakest|bottom|cheapest|most expensive)\b/);
  const low = superlative && /worst|lowest|least|smallest|weakest|bottom|cheapest/.test(superlative[1]);

  let metric: MetricDef | null = null;
  for (const [re, key] of METRIC_WORDS) if (re.test(q)) {
    metric = METRICS[key];
    break;
  }

  const entityCount = promos.length + opHits.length + markets.length + types.length + games.length + aggs.length;
  let groupBy: Group["kind"] | null = null;
  if (superlative || /\bby (operator|market|type|mechanic|game|aggregator|month)\b|\beach (operator|market|type|game|aggregator|month)\b/.test(q)) {
    if (/\boperators?\b/.test(q) && !opHits.length) groupBy = "operator";
    else if (/\bmarkets?\b|\bcountr/.test(q) && !markets.length) groupBy = "market";
    else if (/\btypes?\b|mechanic/.test(q) && !types.length) groupBy = "type";
    else if (/\bgames?\b/.test(q) && !games.length) groupBy = "game";
    else if (/aggregators?/.test(q) && !aggs.length) groupBy = "aggregator";
    else if (/\bmonths?\b/.test(q) && !months.length) groupBy = "month";
  }

  let intent: Parsed["intent"] = "lookup";
  const sameKindPairs = [promos, opHits, markets, types, games, aggs].some((g) => g.length >= 2) || months.length >= 2;
  if (/^\s*when\b|what dates|which dates/.test(q) && promos.length) intent = "when";
  else if (compareWord && sameKindPairs) intent = "compare";
  else if (superlative || groupBy) intent = "rank";
  else if (/how many/.test(q) && (!metric || metric.key === "participants") && !/players|participants|people/.test(q)) intent = "count";
  else if (/total|how much|sum|overall|altogether|in total|average|avg|mean|per promo/.test(q) && !promos.length) intent = "total";
  else if (!promos.length && (entityCount || months.length)) intent = "total";

  return {
    promos,
    operators: group("operator", opHits, (m, n) => m.promo.operator === n),
    markets: group("market", markets, (m, n) => m.promo.market === n),
    types: group("type", types, (m, n) => m.promo.type === n),
    games: group("game", games, (m, n) => m.promo.games.includes(n)),
    aggregators: group("aggregator", aggs, (m, n) => m.promo.aggregator === n),
    months,
    year: !months.length ? (q.match(/\b(20\d\d)\b/)?.[1] ?? null) : null,
    metric,
    intent,
    direction: low ? 1 : -1,
    superWord: superlative ? superlative[1] : null,
    groupBy,
    average: /average|avg|mean|per promo/.test(q),
  };
}

/** All promos matching every filter the question mentions (except the compared dimension). */
function scope(p: Parsed, all: PromoMetrics[], skip?: Group["kind"] | "months"): PromoMetrics[] {
  let list = all;
  const apply = (groups: Group[], kind: Group["kind"]) => {
    if (groups.length && skip !== kind) {
      const ids = new Set(groups.flatMap((g) => g.list.map((m) => m.promo.id)));
      list = list.filter((m) => ids.has(m.promo.id));
    }
  };
  apply(p.promos, "promo");
  apply(p.operators, "operator");
  apply(p.markets, "market");
  apply(p.types, "type");
  apply(p.games, "game");
  apply(p.aggregators, "aggregator");
  if (p.months.length && skip !== "months") list = list.filter((m) => p.months.includes(m.month));
  if (p.year) list = list.filter((m) => m.month.startsWith(p.year!));
  return list;
}

function scopeName(p: Parsed, skip?: Group["kind"] | "months"): string {
  const parts: string[] = [];
  if (skip !== "operator" && p.operators.length) parts.push(p.operators.map((g) => g.label).join(" + "));
  if (skip !== "market" && p.markets.length) parts.push(`in ${p.markets.map((g) => g.label).join(" + ")}`);
  if (skip !== "type" && p.types.length) parts.push(p.types.map((g) => g.label).join(" + "));
  if (skip !== "game" && p.games.length) parts.push(`on ${p.games.map((g) => g.label).join(" + ")}`);
  if (skip !== "aggregator" && p.aggregators.length) parts.push(`via ${p.aggregators.map((g) => g.label).join(" + ")}`);
  if (skip !== "months" && p.months.length) parts.push(`started ${p.months.map((m) => monthLabel(m, "long")).join(" + ")}`);
  if (p.year) parts.push(`started in ${p.year}`);
  return parts.join(" · ");
}

const fmt = (d: MetricDef, v: number | null | undefined, cur: string) => formatMetric(d.format, v ?? null, cur);

function diffText(d: MetricDef, a: number, b: number, cur: string): string {
  if (d.format === "money" || d.format === "count") {
    const diff = a - b;
    const times = b > 0 ? a / b : null;
    return `${formatMetric(d.format, Math.abs(diff), cur)} ${diff >= 0 ? "more" : "less"}${times != null && times > 0 ? ` (${times >= 1 ? `${times.toFixed(1)}×` : `${Math.round(times * 100)}% of it`})` : ""}`;
  }
  if (d.format === "roi") return `${Math.abs(a - b).toFixed(1)}× ${a >= b ? "higher" : "lower"}`;
  const pts = (a - b) * 100;
  return `${Math.abs(pts).toFixed(1)} pts ${pts >= 0 ? "higher" : "lower"}`;
}

const DEFAULT_SET = ["during", "dvb", "contribution", "roi"];
const FULL_SET = ["contribution", "before", "during", "after", "dvb", "avb", "wager", "participants", "part", "rtp", "roi"];

function compare(p: Parsed, all: PromoMetrics[], cur: string): Answer {
  const dims: Array<[Group[], Group["kind"] | "months"]> = [
    [p.promos, "promo"],
    [p.operators, "operator"],
    [p.markets, "market"],
    [p.types, "type"],
    [p.games, "game"],
    [p.aggregators, "aggregator"],
  ];
  const found = dims.find(([g]) => g.length >= 2);
  let sides: Group[];
  let skip: Group["kind"] | "months";
  if (found) {
    skip = found[1];
    const base = scope(p, all, skip);
    sides = found[0].map((g) => ({ ...g, list: g.list.filter((m) => base.includes(m)) }));
  } else {
    skip = "months";
    const base = scope(p, all, "months");
    sides = p.months.map((mo) => ({ label: monthLabel(mo, "long"), list: base.filter((m) => m.month === mo), kind: "month" as const }));
  }
  sides = sides.slice(0, 4);
  const empty = sides.filter((s) => !s.list.length);
  if (empty.length) return { understood: true, text: [`I couldn't find promos for ${empty.map((s) => `**${s.label}**`).join(", ")}${scopeName(p, skip) ? ` (${scopeName(p, skip)})` : ""}.`] };

  const rolls = sides.map((s) => rollup(s.list));
  const keys = p.metric ? [p.metric.key as string, ...DEFAULT_SET.filter((k) => k !== p.metric!.key)].slice(0, 4) : DEFAULT_SET;
  const main = p.metric ?? METRICS.during;
  const a = rolls[0][main.key];
  const b = rolls[1][main.key];
  const text: string[] = [];
  const name = (i: number) => `**${sides[i].label}**`;
  if (a == null || b == null) {
    const missing = [a, b].map((v, i) => (v == null ? sides[i].label : null)).filter(Boolean);
    text.push(`${missing.join(" and ")} ${missing.length === 1 ? "doesn't" : "don't"} have ${main.label} yet, so I can't compare that.`);
  } else if (main.key === "during") {
    const during = sides.every((s) => s.list.length === 1) ? "during the promo" : "during their promos";
    text.push(`${name(0)} made **${fmt(main, a, cur)}** GGR ${during} vs **${fmt(main, b, cur)}** for ${name(1)} — ${diffText(main, a, b, cur)}.`);
  } else {
    text.push(`${main.label[0].toUpperCase()}${main.label.slice(1)}: ${name(0)} **${fmt(main, a, cur)}** vs ${name(1)} **${fmt(main, b, cur)}** — ${diffText(main, a, b, cur)}.`);
  }
  for (let i = 2; i < sides.length; i++) {
    const v = rolls[i][main.key];
    if (v != null) text.push(`${name(i)}: **${fmt(main, v, cur)}**.`);
  }

  // Totals depend on length: give the per-day view for GGR totals of single promos.
  let note: string | undefined;
  if (main.format === "money" && sides.every((s) => s.list.length === 1)) {
    const days = sides.map((s) => s.list[0].promoDays);
    if (new Set(days).size > 1) {
      const perDay = sides.map((s) => {
        const v = main.per(s.list[0]);
        return v == null ? "—" : `${formatMetric("money", v / s.list[0].promoDays, cur)}/day over ${s.list[0].promoDays} days`;
      });
      text.push(`They ran for different lengths, so per day: ${perDay.map((x, i) => `${sides[i].label} ${x}`).join("; ")}.`);
    }
  }
  const markets = new Set(sides.flatMap((s) => s.list.map((m) => m.promo.market)));
  if (markets.size > 1) note = "Different markets and audiences — useful context, not a like-for-like test. Changes are observed (before vs during), not adjusted for the market trend.";
  else note = "Changes are observed (before vs during), not adjusted for the market trend.";

  return {
    understood: true,
    text,
    table: {
      head: ["", ...sides.map((s) => s.label)],
      rows: [...new Set(keys)].map((k) => [cap(METRICS[k].label), ...rolls.map((r) => fmt(METRICS[k], r[METRICS[k].key], cur))]),
    },
    note,
    followUps: sides[0].id ? [`How did ${sides[0].label} do?`, `Which promo had the best Promo ROI?`] : undefined,
  };
}

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

function rank(p: Parsed, all: PromoMetrics[], cur: string): Answer {
  const base = scope(p, all);
  const where = scopeName(p);
  // "best" with no metric = the headline result (GGR during vs before); "most"/"biggest" = GGR during.
  const metric = p.metric ?? (/most|biggest|largest|greatest/.test(p.superWord ?? "") ? METRICS.during : METRICS.dvb);
  // For costs, "best" means lowest; "highest"/"most expensive" still mean highest.
  const judged = /best|top|strongest|worst|bottom|weakest/.test(p.superWord ?? "");
  const dir = metric.lowerIsBetter && judged ? (-p.direction as 1 | -1) : p.direction;

  if (p.groupBy && p.groupBy !== "promo") {
    const key = (m: PromoMetrics): string[] =>
      p.groupBy === "operator" ? [m.promo.operator] : p.groupBy === "market" ? [m.promo.market] : p.groupBy === "type" ? [m.promo.type] : p.groupBy === "game" ? m.promo.games : p.groupBy === "aggregator" ? [m.promo.aggregator] : [m.month];
    const groups = new Map<string, PromoMetrics[]>();
    for (const m of base) for (const k of key(m)) groups.set(k, [...(groups.get(k) ?? []), m]);
    const rows = [...groups.entries()]
      .map(([k, list]) => ({ k: p.groupBy === "month" ? monthLabel(k, "long") : k, list, v: rollup(list)[metric.key] }))
      .filter((r) => r.v != null)
      .sort((a, b) => (a.v! - b.v!) * dir);
    if (!rows.length) return { understood: true, text: [`No ${p.groupBy}s${where ? ` (${where})` : ""} have ${metric.label} yet.`] };
    const top = rows[0];
    return {
      understood: true,
      text: [
        `${dir === -1 ? "Highest" : "Lowest"} ${metric.label} by ${p.groupBy}${where ? ` (${where})` : ""}: **${top.k}** with **${fmt(metric, top.v, cur)}** across ${top.list.length} promo${top.list.length === 1 ? "" : "s"}.`,
      ],
      table: {
        head: [cap(p.groupBy), cap(metric.label), "Promos"],
        rows: rows.slice(0, 8).map((r) => [r.k, fmt(metric, r.v, cur), String(r.list.length)]),
      },
      note: rows.some((r) => r.list.length < 3) ? "Groups with fewer than 3 promos are a small sample." : undefined,
    };
  }

  const done = base.filter((m) => metric.per(m) != null && (m.status === "complete" || ["contribution", "before"].includes(metric.key)));
  const rows = [...done].sort((a, b) => (metric.per(a)! - metric.per(b)!) * dir);
  if (!rows.length) return { understood: true, text: [`No completed promos${where ? ` (${where})` : ""} have ${metric.label} yet.`] };
  const top = rows[0];
  return {
    understood: true,
    text: [
      `${dir === -1 ? "Highest" : "Lowest"} ${metric.label}${where ? ` (${where})` : ""}: **${top.promo.name}** (${top.promo.operator}, ${formatRange(top.promo.startDate, top.promo.endDate)}) with **${fmt(metric, metric.per(top), cur)}**.`,
    ],
    table: {
      head: ["Promotion", "Operator", cap(metric.label)],
      rows: rows.slice(0, 6).map((m) => [m.promo.name, m.promo.operator, fmt(metric, metric.per(m), cur)]),
      ids: rows.slice(0, 6).map((m) => m.promo.id),
    },
    note: `Out of ${rows.length} completed promo${rows.length === 1 ? "" : "s"} with this number.${metric.format === "change" ? " Observed change, not adjusted for the market trend." : ""}`,
    followUps: [`How did ${top.promo.name} do?`],
  };
}

function total(p: Parsed, all: PromoMetrics[], monthly: MonthlyRecord[], cur: string): Answer {
  const list = scope(p, all);
  const where = scopeName(p) || "all promos";
  if (!list.length) return { understood: true, text: [`No promos found (${where}).`] };
  const r = rollup(list);
  const text: string[] = [];
  if (p.metric) {
    const v = r[p.metric.key];
    text.push(`${cap(p.metric.label)} (${where}, ${list.length} promo${list.length === 1 ? "" : "s"}): **${fmt(p.metric, v, cur)}**.`);
    if (p.average && v != null && (p.metric.format === "money" || p.metric.format === "count")) {
      const n = list.filter((m) => p.metric!.per(m) != null).length;
      if (n) text.push(`Average per promo: **${formatMetric(p.metric.format, v / n, cur)}** (over ${n}).`);
    }
  } else {
    text.push(
      `${cap(where)}: **${list.length}** promo${list.length === 1 ? "" : "s"} · GGR during **${formatMetric("money", r.during, cur)}** (${formatMetric("change", r.dvb, cur)} vs before) · contribution **${formatMetric("money", r.contribution, cur)}** · Promo ROI **${formatMetric("roi", r.roi, cur)}**.`,
    );
  }
  // Month-only GGR questions: also give the month's total GGR across all operators.
  if (p.months.length && (!p.metric || p.metric.key === "during") && !p.operators.length && !p.markets.length && !p.types.length && !p.games.length) {
    const tot = monthly.filter((m) => p.months.includes(m.month) && m.ggr != null);
    if (tot.length) text.push(`Total GGR for ${tot.map((m) => monthLabel(m.month, "long")).join(" + ")} across all operators (promos or not): **${formatMetric("money", tot.reduce((s, m) => s + (m.ggr ?? 0), 0), cur)}**.`);
  }
  const best = [...list].filter((m) => m.primaryChange != null && m.status === "complete").sort((a, b) => b.primaryChange! - a.primaryChange!)[0];
  return {
    understood: true,
    text,
    table: {
      head: ["Promotion", "Operator", p.metric ? cap(p.metric.label) : "GGR during"],
      rows: list.slice(0, 8).map((m) => [m.promo.name, m.promo.operator, fmt(p.metric ?? METRICS.during, (p.metric ?? METRICS.during).per(m), cur)]),
      ids: list.slice(0, 8).map((m) => m.promo.id),
    },
    note: `Money is added up; rates are worked out from the totals.${list.length > 8 ? ` Showing 8 of ${list.length}.` : ""}`,
    followUps: best ? [`How did ${best.promo.name} do?`] : undefined,
  };
}

function count(p: Parsed, all: PromoMetrics[]): Answer {
  const list = scope(p, all);
  const where = scopeName(p);
  const by = (s: string) => list.filter((m) => m.status === s).length;
  return {
    understood: true,
    text: [
      `**${list.length}** promo${list.length === 1 ? "" : "s"}${where ? ` (${where})` : ""}: ${by("complete")} completed, ${by("measuring") + by("live")} live or still being measured, ${by("upcoming")} upcoming.`,
    ],
    table: list.length
      ? {
          head: ["Promotion", "Operator", "Dates"],
          rows: list.slice(0, 10).map((m) => [m.promo.name, m.promo.operator, formatRange(m.promo.startDate, m.promo.endDate)]),
          ids: list.slice(0, 10).map((m) => m.promo.id),
        }
      : undefined,
  };
}

function lookup(p: Parsed, all: PromoMetrics[], monthly: MonthlyRecord[], cur: string): Answer {
  const g = p.promos[0];
  if (!g) return total(p, all, monthly, cur);
  const list = g.list;
  if (list.every((m) => m.status === "upcoming"))
    return { understood: true, text: [`**${g.label}** hasn't started yet — it runs ${list.map((m) => `${formatRange(m.promo.startDate, m.promo.endDate)} (${m.promo.operator})`).join(", ")}.`] };

  if (list.length > 1) {
    const r = rollup(list);
    const d = p.metric ?? METRICS.during;
    return {
      understood: true,
      text: [`**${g.label}** ran at ${list.length} operators. ${cap(d.label)} across them: **${fmt(d, r[d.key], cur)}**.`],
      table: {
        head: ["Operator", ...(p.metric ? [cap(d.label)] : ["GGR during", "vs before", "Promo ROI"])],
        rows: list.map((m) => [m.promo.operator, ...(p.metric ? [fmt(d, d.per(m), cur)] : [fmt(METRICS.during, m.ggrDuring, cur), fmt(METRICS.dvb, m.duringVsBefore, cur), fmt(METRICS.roi, m.promoRoi, cur)])]),
        ids: list.map((m) => m.promo.id),
      },
      followUps: [`Which operator had the best Promo ROI for ${g.label}?`],
    };
  }

  const m = list[0];
  if (p.metric) {
    const v = p.metric.per(m);
    const others = all.filter((x) => x.promo.type === m.promo.type && x.promo.id !== m.promo.id && x.status === "complete").map(p.metric.per).filter((x): x is number => x != null);
    const typical = median(others);
    return {
      understood: true,
      text: [
        v == null
          ? `**${m.promo.name}** doesn't report ${p.metric.label} yet.`
          : `${cap(p.metric.label)} for **${m.promo.name}** (${m.promo.operator}): **${fmt(p.metric, v, cur)}**${m.status !== "complete" ? " — not final yet" : ""}.`,
        ...(v != null && typical != null ? [`Typical for ${m.promo.type}: ${fmt(p.metric, typical, cur)} (median of ${others.length}).`] : []),
      ],
      links: [{ label: `Open ${m.promo.name} report`, id: m.promo.id }],
      followUps: [`How did ${m.promo.name} do?`],
    };
  }
  const o = outcomeFor(m, cur);
  return {
    understood: true,
    text: [`**${m.promo.name}** (${m.promo.operator}, ${m.promo.market}, ${formatRange(m.promo.startDate, m.promo.endDate)}): ${o.headline}.`, o.sub],
    table: {
      head: ["Metric", "Value"],
      rows: FULL_SET.map((k) => [cap(METRICS[k].label), fmt(METRICS[k], METRICS[k].per(m), cur)]),
    },
    links: [{ label: `Open ${m.promo.name} report`, id: m.promo.id }],
  };
}

/** Example questions built from the actual data, for the empty state and when a question isn't understood. */
export function suggestions(all: PromoMetrics[]): string[] {
  const done = all.filter((m) => m.status === "complete" && m.ggrDuring != null);
  const names = [...new Set(done.sort((a, b) => b.promo.startDate.localeCompare(a.promo.startDate)).map((m) => m.promo.name))];
  const lastMonth = done[0]?.month;
  const out = [
    names.length >= 2 ? `How much GGR did ${names[0]} make vs ${names[1]}?` : null,
    "Which promo had the best Promo ROI?",
    "Which operator grew GGR the most?",
    lastMonth ? `Total promo contribution in ${monthLabel(lastMonth, "long", false)}` : null,
    names[2] ? `How did ${names[2]} do?` : null,
    lastMonth ? `How many promos started in ${monthLabel(lastMonth, "long", false)}?` : null,
    "Which market had the highest participation rate?",
  ];
  return out.filter((x): x is string => !!x);
}

export function ask(question: string, all: PromoMetrics[], monthly: MonthlyRecord[], cur: string): Answer {
  const q = question.trim();
  if (!q) return { understood: false, text: [] };
  if (!all.length) return { understood: true, text: ["There are no promos in the data yet. Add some in Data & Back Office."] };
  const p = parse(q, all);
  const anything = p.promos.length + p.operators.length + p.markets.length + p.types.length + p.games.length + p.aggregators.length + p.months.length + (p.year ? 1 : 0);
  if (!anything && !p.metric && !p.groupBy && p.intent !== "rank" && p.intent !== "count") {
    return {
      understood: false,
      text: ["I couldn't match that to your promos. I understand promo names, operators, markets, promotion types, games and months, plus metrics like GGR, contribution, wager, players, part. rate, RTP and Promo ROI."],
      followUps: suggestions(all).slice(0, 4),
    };
  }
  switch (p.intent) {
    case "compare":
      return compare(p, all, cur);
    case "rank":
      return rank(p, all, cur);
    case "count":
      return count(p, all);
    case "when":
      return {
        understood: true,
        text: p.promos.map((g) => `**${g.label}**: ${g.list.map((m) => `${formatRange(m.promo.startDate, m.promo.endDate)} (${m.promo.operator}, ${m.promoDays} days)`).join("; ")}.`),
      };
    case "total":
      return total(p, all, monthly, cur);
    default:
      return lookup(p, all, monthly, cur);
  }
}
