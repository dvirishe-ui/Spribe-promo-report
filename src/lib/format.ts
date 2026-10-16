const compactCache = new Map<string, Intl.NumberFormat>();
const fullCache = new Map<string, Intl.NumberFormat>();

function currencyFmt(currency: string, compact: boolean): Intl.NumberFormat {
  const cache = compact ? compactCache : fullCache;
  let f = cache.get(currency);
  if (!f) {
    try {
      f = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
        notation: compact ? "compact" : "standard",
        maximumFractionDigits: compact ? 1 : 0,
      });
    } catch {
      // Unknown currency code — fall back to a plain number with the code as a prefix.
      f = new Intl.NumberFormat("en-US", {
        notation: compact ? "compact" : "standard",
        maximumFractionDigits: compact ? 1 : 0,
      });
    }
    cache.set(currency, f);
  }
  return f;
}

/** €1.2M — for tiles, labels and axes. */
export function money(v: number | null | undefined, currency = "EUR"): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return currencyFmt(currency, true).format(v);
}

/** €1,234,567 — for tables and tooltips. */
export function moneyFull(v: number | null | undefined, currency = "EUR"): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return currencyFmt(currency, false).format(v);
}

/** Signed money, e.g. +€58K / −€12K. */
export function moneySigned(v: number | null | undefined, currency = "EUR"): string {
  if (v == null || !Number.isFinite(v)) return "—";
  const s = money(Math.abs(v), currency);
  return v > 0 ? `+${s}` : v < 0 ? `−${s}` : s;
}

/** +24.3% / −5.1% */
export function pct(v: number | null | undefined, digits = 1): string {
  if (v == null || !Number.isFinite(v)) return "—";
  const s = `${Math.abs(v * 100).toFixed(digits)}%`;
  return v > 0.00005 ? `+${s}` : v < -0.00005 ? `−${s}` : `${(0).toFixed(digits)}%`;
}

/** 24% unsigned */
export function pctPlain(v: number | null | undefined, digits = 0): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${(v * 100).toFixed(digits)}%`;
}

export function num(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(v);
}

export function numCompact(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(v);
}

export function multiple(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${v >= 0 ? "" : "−"}${Math.abs(v).toFixed(1)}×`;
}

export function currencySymbol(currency: string): string {
  try {
    const parts = new Intl.NumberFormat("en-US", { style: "currency", currency }).formatToParts(0);
    return parts.find((p) => p.type === "currency")?.value ?? currency;
  } catch {
    return currency;
  }
}

/** "just now", "5 min ago", "3 h ago", "2 days ago", then a date. */
export function timeAgo(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return "—";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "—";
  const s = Math.max(0, (now - t) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  if (s < 86400 * 7) return `${Math.round(s / 86400)} day${Math.round(s / 86400) === 1 ? "" : "s"} ago`;
  return new Date(t).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
