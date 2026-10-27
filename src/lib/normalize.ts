import { isValidIsoDay, toIsoDay } from "./dates";
import type { Dataset, DailyPoint, GameShare, MarketMetricKey, MarketTrend, MissionDay, MissionStep, MonthlyRecord, PromoRecord, RankBand } from "./types";
import { marketInfo } from "./markets";

/**
 * Turns whatever comes in — a backoffice JSON payload, a CSV export, an Excel
 * paste — into clean `PromoRecord` / `MonthlyRecord` objects.
 *
 * Column / field names are matched loosely ("GGR Before", "ggr_before" and
 * "ggrBefore" all work) and a user-supplied field map (set on the Connect
 * page) can rename anything the backoffice calls differently.
 */

type Raw = Record<string, unknown>;

const PROMO_ALIASES: Record<string, keyof PromoRecord> = {
  id: "id",
  promoid: "id",
  campaignid: "id",
  name: "name",
  promo: "name",
  promoname: "name",
  promotion: "name",
  title: "name",
  campaign: "name",
  campaignname: "name",
  type: "type",
  promotype: "type",
  mechanic: "type",
  operator: "operator",
  operatorname: "operator",
  brand: "operator",
  partner: "operator",
  casino: "operator",
  client: "operator",
  aggregator: "aggregator",
  aggregatorname: "aggregator",
  platform: "aggregator",
  provider: "aggregator",
  hub: "aggregator",
  currency: "currency",
  ccy: "currency",
  currencycode: "currency",
  games: "games",
  game: "games",
  gamename: "games",
  market: "market",
  country: "market",
  region: "market",
  geo: "market",
  jurisdiction: "market",
  startdate: "startDate",
  start: "startDate",
  from: "startDate",
  datefrom: "startDate",
  enddate: "endDate",
  end: "endDate",
  to: "endDate",
  dateto: "endDate",
  windowdays: "windowDays",
  comparisondays: "windowDays",
  window: "windowDays",
  ggrbefore: "ggrBefore",
  before: "ggrBefore",
  beforeggr: "ggrBefore",
  ggrduring: "ggrDuring",
  during: "ggrDuring",
  duringggr: "ggrDuring",
  ggrpromo: "ggrDuring",
  ggrafter: "ggrAfter",
  after: "ggrAfter",
  afterggr: "ggrAfter",
  prizepool: "prizePool",
  prize: "prizePool",
  prizes: "prizePool",
  cost: "prizePool",
  promocost: "prizePool",
  promocontribution: "prizePool",
  contribution: "prizePool",
  promofund: "prizePool",
  budget: "prizePool",
  playersbefore: "playersBefore",
  playersduring: "playersDuring",
  playersafter: "playersAfter",
  participants: "participants",
  uniqueparticipants: "participants",
  eligibleplayers: "eligiblePlayers",
  eligible: "eligiblePlayers",
  eligibleaudience: "eligiblePlayers",
  participantcount: "participants",
  newparticipants: "newParticipants",
  newplayers: "newParticipants",
  retainedparticipants: "retainedParticipants",
  retainedplayers: "retainedParticipants",
  returningparticipants: "retainedParticipants",
  betsduring: "betsDuring",
  bets: "betsDuring",
  participantwager: "participantWagerDuring",
  participantwagerduring: "participantWagerDuring",
  participantturnover: "participantWagerDuring",
  participantggr: "participantGgrDuring",
  participantggrduring: "participantGgrDuring",
  turnoverbefore: "turnoverBefore",
  turnoverduring: "turnoverDuring",
  totalwager: "turnoverDuring",
  totalbetsbefore: "totalBetsBefore",
  numberofbetsbefore: "totalBetsBefore",
  betsbefore: "totalBetsBefore",
  totalbetsduring: "totalBetsDuring",
  numberofbetsduring: "totalBetsDuring",
  numberofbets: "totalBetsDuring",
  totalbetsafter: "totalBetsAfter",
  numberofbetsafter: "totalBetsAfter",
  betsafter: "totalBetsAfter",
  totalwagered: "turnoverDuring",
  wager: "turnoverDuring",
  wagerduring: "turnoverDuring",
  rtp: "reportedRtp",
  rtpduring: "reportedRtp",
  reportedrtp: "reportedRtp",
  partrate: "reportedParticipationRate",
  participationrate: "reportedParticipationRate",
  reportedparticipationrate: "reportedParticipationRate",
  turnoverafter: "turnoverAfter",
  controlggrbefore: "controlGgrBefore",
  controlbefore: "controlGgrBefore",
  controlggrduring: "controlGgrDuring",
  controlduring: "controlGgrDuring",
  controllabel: "controlLabel",
  controlgroup: "controlLabel",
  missions: "missions",
  missionsteps: "missions",
  funnel: "missions",
  missiondays: "missionDays",
  dailymissions: "missionDays",
  gameggr: "gameGgr",
  ggrbygame: "gameGgr",
  calendarid: "calendarId",
  calendarpromoid: "calendarId",
  networkcampaignid: "calendarId",
  leaderboard: "leaderboard",
  rankbands: "leaderboard",
  prizedistribution: "leaderboard",
  notes: "notes",
  note: "notes",
  comment: "notes",
  comments: "notes",
  daily: "daily",
  dailyggr: "daily",
};

const MONTHLY_ALIASES: Record<string, keyof MonthlyRecord> = {
  month: "month",
  period: "month",
  date: "month",
  ggr: "ggr",
  totalggr: "ggr",
  monthggr: "ggr",
  monthlyggr: "ggr",
  notes: "notes",
  note: "notes",
  comment: "notes",
};

export function normKey(k: string): string {
  return k.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Apply a user field map ({ "their_field": "ourField" }) before alias matching. */
export function parseFieldMap(text: string): Record<string, string> {
  if (!text.trim()) return {};
  try {
    const obj = JSON.parse(text);
    if (obj && typeof obj === "object" && !Array.isArray(obj)) {
      const out: Record<string, string> = {};
      for (const [k, v] of Object.entries(obj)) if (typeof v === "string") out[normKey(k)] = v;
      return out;
    }
  } catch {
    // invalid JSON is simply ignored
  }
  return {};
}

function remap<T extends string>(raw: Raw, aliases: Record<string, T>, fieldMap: Record<string, string>) {
  const out: Partial<Record<T, unknown>> = {};
  for (const [key, value] of Object.entries(raw)) {
    const nk = normKey(key);
    const mapped = fieldMap[nk];
    const target = (mapped ? aliases[normKey(mapped)] : undefined) ?? aliases[nk];
    if (target && out[target] === undefined) out[target] = value;
  }
  return out;
}

/** "€1,234.50" → 1234.5 · "1.234,5" → 1234.5 · "(500)" → -500 · "" → null */
export function toNumber(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  let s = String(v).trim();
  if (!s || s === "-" || s === "—" || /^n\/?a$/i.test(s)) return null;
  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  s = s.replace(/[\s€$£₹₺₽R ]|BRL|EUR|USD|MXN/gi, "");
  if (s.startsWith("−")) s = "-" + s.slice(1);
  let multiplier = 1;
  const suffix = s.match(/([kmb])$/i);
  if (suffix) {
    multiplier = { k: 1e3, m: 1e6, b: 1e9 }[suffix[1].toLowerCase() as "k" | "m" | "b"];
    s = s.slice(0, -1);
  }
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma > -1 && lastDot > -1) {
    // Both present: whichever comes last is the decimal separator.
    s = lastComma > lastDot ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  } else if (lastComma > -1) {
    // Only commas: "1,234,567" thousands vs "1234,5" decimal.
    s = /^-?\d{1,3}(,\d{3})+$/.test(s) ? s.replace(/,/g, "") : s.replace(",", ".");
  } else if (lastDot > -1 && /^-?\d{1,3}(\.\d{3}){2,}$/.test(s)) {
    s = s.replace(/\./g, "");
  }
  const n = Number(s) * multiplier;
  if (!Number.isFinite(n)) return null;
  return negative ? -n : n;
}

/** Accepts 2026-09-14, 2026-09-14T00:00:00Z, 14/09/2026, 14.09.2026 and Excel serials. */
export function toIsoDate(v: unknown): string | null {
  if (v == null || v === "") return null;
  if (typeof v === "number" && v > 20000 && v < 80000) {
    return toIsoDay(Date.UTC(1899, 11, 30) + v * 86_400_000);
  }
  const s = String(v).trim();
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) {
    const out = `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
    return isValidIsoDay(out) ? out : null;
  }
  const dmy = s.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{4})$/);
  if (dmy) {
    const out = `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
    return isValidIsoDay(out) ? out : null;
  }
  const t = Date.parse(s);
  return Number.isNaN(t) ? null : toIsoDay(t);
}

function toMonth(v: unknown): string | null {
  if (v == null || v === "") return null;
  const s = String(v).trim();
  const ym = s.match(/^(\d{4})-(\d{1,2})$/);
  if (ym) return `${ym[1]}-${ym[2].padStart(2, "0")}`;
  const my = s.match(/^(\d{1,2})[/.](\d{4})$/);
  if (my) return `${my[2]}-${my[1].padStart(2, "0")}`;
  const d = toIsoDate(v);
  return d ? d.slice(0, 7) : null;
}

/** "96.5%", "96.5" or "0.965" → 0.965. Values above 1.5 are read as percentages. */
function toRate(v: unknown): number | null {
  const n = toNumber(typeof v === "string" ? v.replace("%", "") : v);
  if (n == null) return null;
  return Math.abs(n) > 1.5 ? n / 100 : n;
}

function toText(v: unknown): string {
  return v == null ? "" : String(v).trim();
}

function toGames(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(toText).filter(Boolean);
  return toText(v)
    .split(/[|;,/]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function toMissions(v: unknown): MissionStep[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out = v
    .map((x) => (x && typeof x === "object" ? (x as Raw) : null))
    .filter((x): x is Raw => x != null)
    .map((x) => ({ name: toText(x.name ?? x.step ?? x.mission), reached: toNumber(x.reached ?? x.players ?? x.count) }))
    .filter((x): x is MissionStep => !!x.name && x.reached != null);
  return out.length ? out : undefined;
}

function toMissionDays(v: unknown): MissionDay[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out = v
    .map((x) => (x && typeof x === "object" ? (x as Raw) : null))
    .filter((x): x is Raw => x != null)
    .map((x) => ({
      day: toNumber(x.day),
      game: toText(x.game ?? x.games),
      requirement: toText(x.requirement ?? x.task ?? x.tasks),
      started: toNumber(x.started ?? x.opened),
      completed: toNumber(x.completed),
      medianMinutes: toNumber(x.medianMinutes ?? x.minutes),
    }))
    .flatMap((x): MissionDay[] =>
      x.day != null && x.started != null && x.completed != null ? [{ ...x, day: x.day, started: x.started, completed: x.completed }] : [],
    );
  return out.length ? out.sort((a, b) => a.day - b.day) : undefined;
}

function toGameShares(v: unknown): GameShare[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out = v
    .map((x) => (x && typeof x === "object" ? (x as Raw) : null))
    .filter((x): x is Raw => x != null)
    .map((x): { game: string; ggrDuring: number | null } & Omit<GameShare, "game" | "ggrDuring"> => ({
      game: toText(x.game),
      ggrDuring: toNumber(x.ggrDuring ?? x.ggr),
      ggrBefore: toNumber(x.ggrBefore),
      wagerBefore: toNumber(x.wagerBefore ?? x.turnoverBefore),
      wagerDuring: toNumber(x.wagerDuring ?? x.turnoverDuring),
      betsBefore: toNumber(x.betsBefore),
      betsDuring: toNumber(x.betsDuring),
      playersBefore: toNumber(x.playersBefore),
      playersDuring: toNumber(x.playersDuring),
    }))
    .filter((x): x is GameShare => !!x.game && x.ggrDuring != null);
  return out.length ? out : undefined;
}

function toBands(v: unknown): RankBand[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out = v
    .map((x) => (x && typeof x === "object" ? (x as Raw) : null))
    .filter((x): x is Raw => x != null)
    .map((x) => ({ band: toText(x.band ?? x.rank ?? x.ranks), winners: toNumber(x.winners ?? x.count) ?? 0, prize: toNumber(x.prize ?? x.amount) }))
    .filter((x): x is RankBand => !!x.band && x.prize != null);
  return out.length ? out : undefined;
}

/** Text form used by the editor: one step per line, "Step name: 1234". */
export function parseStepLines(text: string): MissionStep[] | undefined {
  const out: MissionStep[] = [];
  for (const line of text.split(/\n/)) {
    const m = line.match(/^(.+?)[:\t,]\s*([\d.,\s]+)$/);
    const n = m ? toNumber(m[2]) : null;
    if (m && n != null) out.push({ name: m[1].trim(), reached: n });
  }
  return out.length ? out : undefined;
}

/** Text form used by the editor: one band per line, "4th–10th: 7 winners: 2200". */
export function parseBandLines(text: string): RankBand[] | undefined {
  const out: RankBand[] = [];
  for (const line of text.split(/\n/)) {
    const parts = line.split(/[:\t]/).map((x) => x.trim()).filter(Boolean);
    if (parts.length < 3) continue;
    const winners = toNumber(parts[1].replace(/winners?/i, ""));
    const prize = toNumber(parts[2]);
    if (winners != null && prize != null) out.push({ band: parts[0], winners, prize });
  }
  return out.length ? out : undefined;
}

function toDaily(v: unknown): DailyPoint[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out: DailyPoint[] = [];
  for (const p of v) {
    if (!p || typeof p !== "object") continue;
    const r = p as Raw;
    const date = toIsoDate(r.date ?? r.day);
    const ggr = toNumber(r.ggr ?? r.value);
    if (date && ggr != null) out.push({ date, ggr });
  }
  return out.length ? out.sort((a, b) => a.date.localeCompare(b.date)) : undefined;
}

export function newId(): string {
  return `p_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

export function emptyPromo(partial: Partial<PromoRecord> = {}): PromoRecord {
  return {
    id: newId(),
    name: "",
    type: "Network Tournament",
    operator: "",
    aggregator: "",
    games: ["Aviator"],
    market: "",
    currency: "",
    startDate: "",
    endDate: "",
    windowDays: null,
    ggrBefore: null,
    ggrDuring: null,
    ggrAfter: null,
    prizePool: null,
    playersBefore: null,
    playersDuring: null,
    playersAfter: null,
    notes: "",
    ...partial,
  };
}

export interface NormalizeResult<T> {
  records: T[];
  warnings: string[];
}

export function normalizePromos(rows: unknown[], fieldMap: Record<string, string> = {}): NormalizeResult<PromoRecord> {
  const records: PromoRecord[] = [];
  const warnings: string[] = [];
  const seen = new Set<string>();
  const seenKeys = new Set<string>();
  rows.forEach((row, i) => {
    if (!row || typeof row !== "object") return;
    const r = remap(row as Raw, PROMO_ALIASES, fieldMap);
    const name = toText(r.name);
    const startDate = toIsoDate(r.startDate);
    const endDate = toIsoDate(r.endDate);
    const label = name || `row ${i + 1}`;
    if (!name && !startDate && r.ggrDuring == null) return; // blank row
    if (!startDate || !endDate) {
      warnings.push(`${label}: missing or unreadable start/end date — skipped.`);
      return;
    }
    if (endDate < startDate) {
      warnings.push(`${label}: end date is before start date — skipped.`);
      return;
    }
    const dupKey = [toText(r.operator).toLowerCase(), name.toLowerCase(), startDate, endDate].join("|");
    if (seenKeys.has(dupKey)) {
      warnings.push(`${label}: same operator, name and dates as an earlier row — skipped as a duplicate.`);
      return;
    }
    seenKeys.add(dupKey);
    let id = toText(r.id) || newId();
    if (seen.has(id)) id = newId();
    seen.add(id);
    const daily = toDaily(r.daily);
    const promo: PromoRecord = {
      id,
      name: name || "Untitled promo",
      type: toText(r.type) || "Other",
      operator: toText(r.operator),
      aggregator: toText(r.aggregator),
      games: toGames(r.games),
      market: toText(r.market),
      currency: /^[a-z]{3}$/i.test(toText(r.currency)) ? toText(r.currency).toUpperCase() : marketInfo(toText(r.market))?.currency ?? "",
      startDate,
      endDate,
      windowDays: toNumber(r.windowDays),
      ggrBefore: toNumber(r.ggrBefore),
      ggrDuring: toNumber(r.ggrDuring),
      ggrAfter: toNumber(r.ggrAfter),
      prizePool: toNumber(r.prizePool),
      playersBefore: toNumber(r.playersBefore),
      playersDuring: toNumber(r.playersDuring),
      playersAfter: toNumber(r.playersAfter),
      eligiblePlayers: toNumber(r.eligiblePlayers),
      reportedRtp: toRate(r.reportedRtp),
      reportedParticipationRate: toRate(r.reportedParticipationRate),
      participants: toNumber(r.participants),
      newParticipants: toNumber(r.newParticipants),
      retainedParticipants: toNumber(r.retainedParticipants),
      betsDuring: toNumber(r.betsDuring),
      participantWagerDuring: toNumber(r.participantWagerDuring),
      participantGgrDuring: toNumber(r.participantGgrDuring),
      totalBetsBefore: toNumber(r.totalBetsBefore),
      totalBetsDuring: toNumber(r.totalBetsDuring),
      totalBetsAfter: toNumber(r.totalBetsAfter),
      turnoverBefore: toNumber(r.turnoverBefore),
      turnoverDuring: toNumber(r.turnoverDuring),
      turnoverAfter: toNumber(r.turnoverAfter),
      controlGgrBefore: toNumber(r.controlGgrBefore),
      controlGgrDuring: toNumber(r.controlGgrDuring),
      controlLabel: toText(r.controlLabel),
      missions: toMissions(r.missions),
      missionDays: toMissionDays(r.missionDays),
      gameGgr: toGameShares(r.gameGgr),
      ...(toText(r.calendarId) ? { calendarId: toText(r.calendarId) } : {}),
      leaderboard: toBands(r.leaderboard),
      notes: toText(r.notes),
      ...(daily ? { daily } : {}),
    };
    if (promo.ggrBefore == null && promo.ggrDuring == null && !daily) {
      warnings.push(`${label}: no GGR numbers yet — imported, shown as "awaiting data".`);
    }
    records.push(promo);
  });
  return { records, warnings };
}

export function normalizeMonthly(rows: unknown[], fieldMap: Record<string, string> = {}): NormalizeResult<MonthlyRecord> {
  const byMonth = new Map<string, MonthlyRecord>();
  const warnings: string[] = [];
  rows.forEach((row, i) => {
    if (!row || typeof row !== "object") return;
    const r = remap(row as Raw, MONTHLY_ALIASES, fieldMap);
    const month = toMonth(r.month);
    if (!month) {
      if (r.ggr != null && r.ggr !== "") warnings.push(`Monthly row ${i + 1}: unreadable month — skipped.`);
      return;
    }
    byMonth.set(month, { month, ggr: toNumber(r.ggr), notes: toText(r.notes) });
  });
  return { records: [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month)), warnings };
}

const MARKET_KEYS: Record<string, MarketMetricKey> = {
  ggr: "ggr",
  ggrchange: "ggr",
  wager: "wager",
  wagerchange: "wager",
  turnover: "wager",
  bets: "bets",
  betschange: "bets",
  players: "players",
  activeplayers: "players",
  playerschange: "players",
  activity: "activity",
  activityindex: "activity",
  index: "activity",
  blaskindex: "activity",
};

/**
 * Market trends delivered with the data (`marketTrends: [...]`). Changes are
 * fractions (0.084) or strings with a percent sign ("8.4%") — a bare number is
 * always a fraction, so 1.2 means +120%, never +1.2%. Unknown metrics are
 * dropped rather than guessed. Anything coming through here is labelled as delivered by the
 * data source — typed-in numbers use the site's own form instead.
 */
export function normalizeMarketTrends(v: unknown, origin: MarketTrend["origin"] = "api"): MarketTrend[] {
  if (!Array.isArray(v)) return [];
  const out: MarketTrend[] = [];
  for (const x of v) {
    if (!x || typeof x !== "object") continue;
    const r = x as Raw;
    const from = toIsoDate(r.from ?? r.start ?? r.startDate);
    const to = toIsoDate(r.to ?? r.end ?? r.endDate);
    const baselineFrom = toIsoDate(r.baselineFrom ?? r.baselineStart);
    const baselineTo = toIsoDate(r.baselineTo ?? r.baselineEnd);
    const market = toText(r.market);
    if (!market || !from || !to || !baselineFrom || !baselineTo) continue;
    const changes: MarketTrend["changes"] = {};
    const raw = (r.changes && typeof r.changes === "object" ? r.changes : r) as Raw;
    for (const [k, val] of Object.entries(raw)) {
      const key = MARKET_KEYS[k.toLowerCase().replace(/[^a-z]/g, "")];
      const n = !key ? null : typeof val === "string" && val.includes("%") ? (toNumber(val.replace("%", "")) ?? NaN) / 100 : toNumber(val);
      if (n != null && !Number.isFinite(n)) continue;
      if (key && n != null) changes[key] = n;
    }
    if (!Object.keys(changes).length) continue;
    out.push({
      id: toText(r.id) || newId(),
      market,
      from,
      to,
      baselineFrom,
      baselineTo,
      changes,
      provider: toText(r.provider ?? r.source) || "Unnamed source",
      ...(toText(r.activityLabel) ? { activityLabel: toText(r.activityLabel) } : {}),
      origin,
      enteredAt: toText(r.enteredAt ?? r.retrievedAt) || undefined,
      ...(toText(r.note ?? r.notes) ? { note: toText(r.note ?? r.notes) } : {}),
    });
  }
  return out;
}

/**
 * Accepts `{ promos, monthly, currency }`, `{ data: { … } }`, or a bare array
 * of promos — the shapes a backoffice endpoint is most likely to return.
 */
export function normalizeDataset(input: unknown, fieldMap: Record<string, string> = {}): {
  dataset: Dataset;
  warnings: string[];
} {
  let root: Raw = {};
  if (Array.isArray(input)) root = { promos: input };
  else if (input && typeof input === "object") {
    root = input as Raw;
    if (root.data && typeof root.data === "object") {
      root = Array.isArray(root.data) ? { promos: root.data } : (root.data as Raw);
    }
  }
  const promoRows = (root.promos ?? root.promotions ?? root.campaigns ?? []) as unknown[];
  const monthRows = (root.monthly ?? root.months ?? root.monthlyGgr ?? root.monthly_ggr ?? []) as unknown[];
  const p = normalizePromos(Array.isArray(promoRows) ? promoRows : [], fieldMap);
  const m = normalizeMonthly(Array.isArray(monthRows) ? monthRows : [], fieldMap);
  const currency = typeof root.currency === "string" && /^[A-Z]{3}$/i.test(root.currency) ? root.currency.toUpperCase() : "EUR";
  return {
    dataset: {
      promos: p.records,
      monthly: m.records,
      currency,
      generatedAt: typeof root.generatedAt === "string" ? root.generatedAt : new Date().toISOString(),
      ...(Array.isArray(root.marketTrends) ? { marketTrends: normalizeMarketTrends(root.marketTrends) } : {}),
    },
    warnings: [...p.warnings, ...m.warnings],
  };
}
