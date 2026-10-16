import { isValidIsoDay, toIsoDay } from "./dates";
import type { Dataset, DailyPoint, MonthlyRecord, PromoRecord } from "./types";

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
  budget: "prizePool",
  playersbefore: "playersBefore",
  playersduring: "playersDuring",
  playersafter: "playersAfter",
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
    type: "Tournament",
    operator: "",
    games: ["Aviator"],
    market: "",
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
    let id = toText(r.id) || newId();
    if (seen.has(id)) id = newId();
    seen.add(id);
    const daily = toDaily(r.daily);
    const promo: PromoRecord = {
      id,
      name: name || "Untitled promo",
      type: toText(r.type) || "Other",
      operator: toText(r.operator),
      games: toGames(r.games),
      market: toText(r.market),
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
    },
    warnings: [...p.warnings, ...m.warnings],
  };
}
