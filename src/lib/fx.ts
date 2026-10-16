import type { Dataset, PromoRecord } from "./types";

/**
 * Exchange rates: how many EUR one unit of each currency is worth.
 *
 * These are rough EXAMPLE rates so mixed-currency promos can be added up out
 * of the box. Update them in Settings (or have the backoffice send numbers
 * already in one currency) before relying on converted totals.
 */
export const DEFAULT_RATES_TO_EUR: Record<string, number> = {
  EUR: 1,
  USD: 0.92,
  GBP: 1.17,
  BRL: 0.16,
  MXN: 0.05,
  ARS: 0.0009,
  CLP: 0.00097,
  COP: 0.00022,
  PEN: 0.25,
  KES: 0.0071,
  NGN: 0.0006,
  ZAR: 0.05,
  TZS: 0.00035,
  UGX: 0.00025,
  MZN: 0.0144,
  RON: 0.2,
  INR: 0.011,
  BDT: 0.0077,
  IDR: 0.000057,
  PHP: 0.016,
  VND: 0.000036,
};

export function rateToEur(currency: string, rates: Record<string, number>): number | null {
  const r = rates[currency] ?? DEFAULT_RATES_TO_EUR[currency];
  return r && r > 0 ? r : null;
}

/** Multiplier to turn an amount in `from` into `to`. null when a rate is missing. */
export function fxFactor(from: string, to: string, rates: Record<string, number>): number | null {
  if (!from || from === to) return 1;
  const a = rateToEur(from, rates);
  const b = rateToEur(to, rates);
  return a && b ? a / b : null;
}

const MONEY_FIELDS = [
  "ggrBefore",
  "ggrDuring",
  "ggrAfter",
  "prizePool",
  "turnoverBefore",
  "turnoverDuring",
  "turnoverAfter",
  "controlGgrBefore",
  "controlGgrDuring",
] as const;

/**
 * The dataset as the report shows it: every promo's money converted into the
 * display currency with one defined method (the rates above, via EUR). The
 * stored data keeps each promo's own currency.
 *
 * A promo whose currency has no rate is never added up unconverted: its money
 * fields are blanked and it is flagged `fxMissing`, so totals leave it out and
 * the UI says why.
 */
export function toDisplayCurrency(dataset: Dataset): Dataset {
  const rates = dataset.fxRates ?? {};
  const promos = dataset.promos.map((p): PromoRecord => {
    const from = p.currency || dataset.currency;
    const f = fxFactor(from, dataset.currency, rates);
    if (f === 1) return p;
    const out: PromoRecord = { ...p };
    for (const k of MONEY_FIELDS) {
      const v = p[k];
      out[k] = v == null || f == null ? null : v * f;
    }
    if (f == null) {
      out.fxMissing = true;
      out.daily = undefined;
      out.leaderboard = p.leaderboard?.map((b) => ({ ...b, prize: Number.NaN }));
      out.gameGgr = undefined;
      return out;
    }
    if (p.daily) out.daily = p.daily.map((d) => ({ ...d, ggr: d.ggr * f }));
    if (p.leaderboard) out.leaderboard = p.leaderboard.map((b) => ({ ...b, prize: b.prize * f }));
    if (p.gameGgr) out.gameGgr = p.gameGgr.map((g) => ({ ...g, ggrDuring: g.ggrDuring * f }));
    return out;
  });
  return { ...dataset, promos };
}
