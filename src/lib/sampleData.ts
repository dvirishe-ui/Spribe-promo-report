import { addDays, daysBetween, parseDay } from "./dates";
import type { Dataset, DailyPoint, MonthlyRecord, PromoRecord } from "./types";
import { marketInfo } from "./markets";
import { DEFAULT_RATES_TO_EUR } from "./fx";

/**
 * SAMPLE NUMBERS ONLY. Generated deterministically so the site has something
 * to draw before real data is entered or the backoffice is connected. The
 * operators are placeholders, not real partners.
 */

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Spec {
  name: string;
  type: string;
  operator: string;
  games: string[];
  market: string;
  start: string;
  end: string;
  base: number; // baseline daily GGR
  lift: number; // uplift during
  keep: number; // share of lift retained after
  prize: number;
  players: number;
  notes?: string;
  live?: boolean;
}

const SPECS: Spec[] = [
  { name: "Aviator Spring Sky Race", type: "Network Tournament", operator: "Operator Alpha", games: ["Aviator"], market: "Brazil", start: "2026-04-06", end: "2026-04-19", base: 48000, lift: 0.27, keep: 0.35, prize: 60000, players: 21000 },
  { name: "Mines Cashback Week", type: "Regional Promotion", operator: "Operator Bravo", games: ["Mines"], market: "Mexico", start: "2026-04-20", end: "2026-04-26", base: 14000, lift: 0.09, keep: 0.1, prize: 9000, players: 5200 },
  { name: "Plinko Drops Festival", type: "Collection Campaign", operator: "Operator Charlie", games: ["Plinko", "Dice"], market: "Peru", start: "2026-05-04", end: "2026-05-17", base: 9500, lift: 0.18, keep: 0.25, prize: 14000, players: 3900 },
  { name: "Aviator Rain Weekend", type: "Regional Promotion", operator: "Operator Alpha", games: ["Aviator"], market: "Brazil", start: "2026-05-22", end: "2026-05-24", base: 52000, lift: 0.14, keep: 0.05, prize: 12000, players: 22500 },
  { name: "Turbo Games Missions", type: "Missions", operator: "Operator Delta", games: ["Mines", "Goal", "Hilo"], market: "Nigeria", start: "2026-06-01", end: "2026-06-14", base: 11000, lift: 0.22, keep: 0.4, prize: 10000, players: 6100 },
  { name: "World Cup Aviator Cup", type: "Seasonal Promotion", operator: "Operator Echo", games: ["Aviator"], market: "Colombia", start: "2026-06-11", end: "2026-07-19", base: 36000, lift: 0.33, keep: 0.3, prize: 150000, players: 16800, notes: "Ran alongside the World Cup. Strongest week was the knockout stage." },
  { name: "Goal Penalty Leaderboard", type: "Leaderboard", operator: "Operator Bravo", games: ["Goal"], market: "Mexico", start: "2026-06-15", end: "2026-06-28", base: 6800, lift: 0.2, keep: 0.15, prize: 8000, players: 2600 },
  { name: "Keno Free Bets Drop", type: "Regional Promotion", operator: "Operator Foxtrot", games: ["Keno"], market: "Kenya", start: "2026-07-06", end: "2026-07-12", base: 5200, lift: -0.04, keep: 0, prize: 6000, players: 2100, notes: "Free bets were mostly redeemed by existing players; no measurable lift." },
  { name: "Summer Aviator Rain", type: "Seasonal Promotion", operator: "Operator Alpha", games: ["Aviator"], market: "Brazil", start: "2026-07-17", end: "2026-07-26", base: 55000, lift: 0.16, keep: 0.2, prize: 30000, players: 23800 },
  { name: "Mini Roulette Cashback", type: "Regional Promotion", operator: "Operator Golf", games: ["Mini Roulette"], market: "Spain", start: "2026-08-03", end: "2026-08-09", base: 7400, lift: 0.06, keep: 0.05, prize: 4200, players: 2900 },
  { name: "Mines Diamond Hunt", type: "Missions", operator: "Operator Charlie", games: ["Mines"], market: "Peru", start: "2026-08-10", end: "2026-08-23", base: 10500, lift: 0.24, keep: 0.45, prize: 11000, players: 4300 },
  { name: "Aviator Night Tournament", type: "Network Tournament", operator: "Operator Delta", games: ["Aviator"], market: "Nigeria", start: "2026-08-24", end: "2026-09-06", base: 29000, lift: 0.19, keep: 0.25, prize: 40000, players: 14200 },
  { name: "Hotline Hot Streak", type: "Leaderboard", operator: "Operator Golf", games: ["Hotline"], market: "Italy", start: "2026-09-07", end: "2026-09-13", base: 4800, lift: 0.01, keep: 0, prize: 5000, players: 1800 },
  { name: "Turbo Rush Multi-game", type: "Cross-Game Challenge", operator: "Operator Echo", games: ["Plinko", "Mines", "Dice", "Goal"], market: "Colombia", start: "2026-09-14", end: "2026-09-27", base: 17000, lift: 0.21, keep: 0.3, prize: 24000, players: 7800 },
  { name: "Aviator Payday Rain", type: "Regional Promotion", operator: "Operator Bravo", games: ["Aviator"], market: "Mexico", start: "2026-09-25", end: "2026-09-28", base: 31000, lift: 0.12, keep: 0.1, prize: 9000, players: 13100 },
  { name: "Balloon Pop Missions", type: "New Game Launch", operator: "Operator Foxtrot", games: ["Balloon"], market: "Kenya", start: "2026-10-05", end: "2026-10-18", base: 4100, lift: 0.17, keep: 0.2, prize: 5000, players: 1700, notes: "Still live — after-window numbers arrive once it ends.", live: true },
];

function buildDaily(spec: Spec, rand: () => number): DailyPoint[] {
  const days = daysBetween(spec.start, spec.end);
  const from = addDays(spec.start, -days);
  const to = spec.live ? addDays(spec.start, days - 5) : addDays(spec.end, days);
  const out: DailyPoint[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const dow = new Date(parseDay(d)).getUTCDay();
    const weekend = dow === 0 || dow === 6 ? 1.12 : dow === 5 ? 1.05 : 0.96;
    let level = 1;
    if (d >= spec.start && d <= spec.end) {
      // ramp in over the first two days
      const k = Math.min(1, (daysBetween(spec.start, d) + 0.5) / 2);
      level = 1 + spec.lift * k;
    } else if (d > spec.end) {
      const since = daysBetween(spec.end, d) - 1;
      const decay = Math.exp(-since / Math.max(2, days / 2));
      level = 1 + spec.lift * (spec.keep + (1 - spec.keep) * decay * 0.4);
    }
    const noise = 1 + (rand() - 0.5) * 0.16;
    out.push({ date: d, ggr: Math.round(spec.base * level * weekend * noise) });
  }
  return out;
}

/** Placeholder aggregators — not real partners. */
const AGGREGATOR_OF: Record<string, string> = {
  "Operator Alpha": "Direct",
  "Operator Bravo": "Aggregator North",
  "Operator Charlie": "Aggregator South",
  "Operator Delta": "Aggregator East",
  "Operator Echo": "Aggregator North",
  "Operator Foxtrot": "Aggregator East",
  "Operator Golf": "Aggregator South",
};

function buildPromo(spec: Spec, i: number): PromoRecord {
  const rand = rng(1000 + i * 97);
  // Specs are written in EUR; store each promo in its market's own currency like a real operator report.
  const currency = marketInfo(spec.market)?.currency ?? "EUR";
  const toLocal = 1 / (DEFAULT_RATES_TO_EUR[currency] ?? 1);
  const local = { ...spec, base: spec.base * toLocal, prize: Math.round(spec.prize * toLocal) };
  const daily = buildDaily(local, rand);
  const days = daysBetween(spec.start, spec.end);
  const before = addDays(spec.start, -1);
  const afterEnd = addDays(spec.end, days);
  const sum = (a: string, b: string) => daily.filter((p) => p.date >= a && p.date <= b).reduce((s, p) => s + p.ggr, 0);
  const pl = (f: number) => Math.round(spec.players * f * (1 + (rand() - 0.5) * 0.06));
  return {
    id: `sample-${i + 1}`,
    name: spec.name,
    type: spec.type,
    operator: spec.operator,
    aggregator: AGGREGATOR_OF[spec.operator] ?? "Direct",
    games: spec.games,
    market: spec.market,
    currency,
    startDate: spec.start,
    endDate: spec.end,
    windowDays: null,
    ggrBefore: sum(addDays(spec.start, -days), before),
    ggrDuring: spec.live ? null : sum(spec.start, spec.end),
    ggrAfter: spec.live ? null : sum(addDays(spec.end, 1), afterEnd),
    prizePool: local.prize,
    playersBefore: pl(1),
    playersDuring: spec.live ? null : pl(1 + spec.lift * 0.8),
    playersAfter: spec.live ? null : pl(1 + spec.lift * spec.keep * 0.7),
    notes: spec.notes ?? "",
    daily,
  };
}

const MONTHLY: Array<[string, number]> = [
  ["2026-03", 38_400_000],
  ["2026-04", 39_100_000],
  ["2026-05", 40_300_000],
  ["2026-06", 43_800_000],
  ["2026-07", 45_200_000],
  ["2026-08", 43_100_000],
  ["2026-09", 44_600_000],
];

export function sampleDataset(): Dataset {
  const monthly: MonthlyRecord[] = MONTHLY.map(([month, ggr]) => ({ month, ggr, notes: "" }));
  monthly[3].notes = "World Cup month";
  return {
    promos: SPECS.map(buildPromo),
    monthly,
    currency: "EUR",
    isSample: true,
  };
}
