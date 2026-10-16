/** Date helpers that work on plain YYYY-MM-DD strings in UTC, so no timezone shifts creep in. */

const DAY = 86_400_000;

export function parseDay(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, (m || 1) - 1, d || 1);
}

export function toIsoDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  return toIsoDay(parseDay(iso) + days * DAY);
}

/** Inclusive number of days between two ISO dates (same day → 1). */
export function daysBetween(start: string, end: string): number {
  return Math.round((parseDay(end) - parseDay(start)) / DAY) + 1;
}

export function isValidIsoDay(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  return toIsoDay(parseDay(s)) === s;
}

export function monthOf(iso: string): string {
  return iso.slice(0, 7);
}

export function prevMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 2, 1));
  return d.toISOString().slice(0, 7);
}

export function nextMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m, 1));
  return d.toISOString().slice(0, 7);
}

/** Every month from `from` to `to` inclusive (YYYY-MM). */
export function monthRange(from: string, to: string): string[] {
  const out: string[] = [];
  let cur = from;
  while (cur <= to && out.length < 240) {
    out.push(cur);
    cur = nextMonth(cur);
  }
  return out;
}

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH_LONG = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function monthLabel(month: string, style: "short" | "long" = "short", withYear = true): string {
  const [y, m] = month.split("-").map(Number);
  const name = (style === "short" ? MONTH_SHORT : MONTH_LONG)[m - 1] ?? month;
  return withYear ? `${name} ${style === "short" ? `'${String(y).slice(2)}` : y}` : name;
}

export function formatDay(iso: string, withYear = false): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTH_SHORT[m - 1] ?? ""}${withYear ? ` ${y}` : ""}`;
}

export function formatRange(start: string, end: string): string {
  if (!start || !end) return "—";
  const sameYear = start.slice(0, 4) === end.slice(0, 4);
  return `${formatDay(start, !sameYear)} – ${formatDay(end, true)}`;
}

export function todayIso(): string {
  return toIsoDay(Date.now());
}
