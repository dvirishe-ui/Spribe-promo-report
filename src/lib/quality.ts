import type { PromoRecord } from "./types";

/**
 * Data-quality checks that don't belong to a single promo.
 */

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

/** Promos that look like the same promo entered twice: same operator, name and dates. */
export function findDuplicates(promos: PromoRecord[]): PromoRecord[][] {
  const groups = new Map<string, PromoRecord[]>();
  for (const p of promos) {
    const key = [norm(p.operator), norm(p.name), p.startDate, p.endDate].join("|");
    groups.set(key, [...(groups.get(key) ?? []), p]);
  }
  return [...groups.values()].filter((g) => g.length > 1);
}

/** Hours since a timestamp, or null. */
export function hoursSince(iso: string | null | undefined, now = Date.now()): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : (now - t) / 3_600_000;
}
