import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { aggregate, type PromoMetrics } from "@/lib/metrics";
import { formatRange } from "@/lib/dates";
import { money, moneyFull, multiple, pct, pctPlain } from "@/lib/format";
import { cn } from "@/lib/utils";

type Kind = "text" | "money" | "change" | "rate" | "roi";

interface Column {
  key: string;
  label: string;
  /** Definition shown on hover */
  info: string;
  kind: Kind;
  get: (m: PromoMetrics) => string | number | null;
  /** Value came from the Back Office rather than being calculated */
  reported?: (m: PromoMetrics) => boolean;
}

/** The results table, in the column order the team reports in. */
export const RESULT_COLUMNS: Column[] = [
  { key: "name", label: "Promotion", info: "Promotion name — click a row to open its report", kind: "text", get: (m) => m.promo.name },
  { key: "aggregator", label: "Aggregator", info: "Aggregator or platform the operator gets SPRIBE games through", kind: "text", get: (m) => m.promo.aggregator || "—" },
  { key: "operator", label: "Operator", info: "Operator that ran the promo", kind: "text", get: (m) => m.promo.operator },
  { key: "type", label: "Type", info: "Promotion type (Promo Calendar types)", kind: "text", get: (m) => m.promo.type },
  { key: "contribution", label: "Promo Contribution", info: "Prize fund contributed to the promo (rewards paid)", kind: "money", get: (m) => m.promo.prizePool },
  { key: "before", label: "GGR Before", info: "GGR in the same number of days before the promo", kind: "money", get: (m) => m.ggrBefore },
  { key: "during", label: "GGR During", info: "GGR while the promo ran", kind: "money", get: (m) => m.ggrDuring },
  { key: "after", label: "GGR After", info: "GGR in the same number of days after the promo", kind: "money", get: (m) => m.ggrAfter },
  { key: "dvb", label: "During vs Before", info: "GGR per day during ÷ per day before − 1 (observed, not adjusted for the market trend)", kind: "change", get: (m) => m.duringVsBefore },
  { key: "avb", label: "After vs Before", info: "GGR per day after ÷ per day before − 1", kind: "change", get: (m) => m.afterVsBefore },
  { key: "wager", label: "Total Wager", info: "Total amount wagered during the promo", kind: "money", get: (m) => m.turnoverDuring },
  {
    key: "part",
    label: "Part. Rate",
    info: "Participants ÷ active players during the promo",
    kind: "rate",
    get: (m) => m.participationRate,
    reported: (m) => m.participationReported,
  },
  { key: "rtp", label: "RTP", info: "Return to player during the promo: (total wager − GGR during) ÷ total wager", kind: "rate", get: (m) => m.rtp, reported: (m) => m.rtpReported },
  { key: "roi", label: "Promo ROI (x)", info: "Extra GGR (during + after, vs the before run-rate) ÷ promo contribution. 1.0× = break-even", kind: "roi", get: (m) => m.promoRoi },
];

function fmt(kind: Kind, v: string | number | null, cur: string): string {
  if (v == null) return "—";
  if (typeof v === "string") return v;
  if (kind === "money") return money(v, cur);
  if (kind === "change") return pct(v);
  if (kind === "rate") return pctPlain(v, 1);
  if (kind === "roi") return multiple(v);
  return String(v);
}

function tone(kind: Kind, v: string | number | null): string {
  if (typeof v !== "number") return "";
  if (kind === "change") return Math.abs(v) < 0.005 ? "" : v > 0 ? "text-good-ink" : "text-bad-ink";
  if (kind === "roi") return v >= 1 ? "text-good-ink" : "text-bad-ink";
  return "";
}

/** Totals for the footer: money is summed, rates are recalculated from the sums (never averaged). */
function totals(list: PromoMetrics[]): Record<string, number | null> {
  const sum = (f: (m: PromoMetrics) => number | null | undefined) => {
    const xs = list.map(f).filter((x): x is number => x != null && Number.isFinite(x));
    return xs.length ? xs.reduce((a, b) => a + b, 0) : null;
  };
  const both = <T,>(f: (m: PromoMetrics) => [T | null | undefined, T | null | undefined]) => list.map(f).filter(([a, b]) => a != null && b != null) as [T, T][];
  const a = aggregate(list);
  const rtpPairs = both((m) => [m.ggrDuring, m.turnoverDuring]).filter(([, w]) => (w as number) > 0) as [number, number][];
  const partPairs = both((m) => [m.participants, m.promo.playersDuring]).filter(([, p]) => (p as number) > 0) as [number, number][];
  const roiPairs = list
    .filter((m) => m.promoRoi != null)
    .map((m) => [m.incrementalGgr! + (m.haloGgr ?? 0), m.promo.prizePool!] as [number, number]);
  const ratio = (pairs: [number, number][]) => {
    const den = pairs.reduce((s, [, d]) => s + d, 0);
    return pairs.length && den > 0 ? pairs.reduce((s, [n]) => s + n, 0) / den : null;
  };
  const rtpRatio = ratio(rtpPairs);
  return {
    contribution: sum((m) => m.promo.prizePool),
    before: sum((m) => m.ggrBefore),
    during: sum((m) => m.ggrDuring),
    after: sum((m) => m.ggrAfter),
    dvb: a.duringVsBefore,
    avb: a.afterVsBefore,
    wager: sum((m) => m.turnoverDuring),
    part: ratio(partPairs),
    rtp: rtpRatio == null ? null : 1 - rtpRatio,
    roi: ratio(roiPairs),
  };
}

/**
 * Every promo as one row with the full set of report metrics. Sortable by any
 * column; the footer sums money and recalculates rates from the sums. Values
 * reported by the Back Office (not calculated here) are marked with *.
 */
export function ResultsTable({ list, currency, onSelect }: { list: PromoMetrics[]; currency: string; onSelect: (id: string) => void }) {
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null);
  const rows = useMemo(() => {
    if (!sort) return list;
    const col = RESULT_COLUMNS.find((c) => c.key === sort.key)!;
    return [...list].sort((x, y) => {
      const a = col.get(x);
      const b = col.get(y);
      if (a == null) return 1;
      if (b == null) return -1;
      return (typeof a === "number" && typeof b === "number" ? a - b : String(a).localeCompare(String(b))) * sort.dir;
    });
  }, [list, sort]);
  const t = useMemo(() => totals(list), [list]);
  const anyReported = list.some((m) => m.rtpReported || m.participationReported);
  const toggle = (key: string, kind: Kind) =>
    setSort((s) => (s?.key !== key ? { key, dir: kind === "text" ? 1 : -1 } : s.dir === (kind === "text" ? 1 : -1) ? { key, dir: s.dir === 1 ? -1 : 1 } : null));

  return (
    <div className="space-y-2">
      <div className="panel overflow-x-auto">
        <table className="w-full min-w-[1180px] text-[13px]">
          <thead>
            <tr className="border-b border-border bg-surface-raised text-[11px] uppercase tracking-wide text-muted-foreground">
              {RESULT_COLUMNS.map((c, i) => (
                <th
                  key={c.key}
                  title={c.info}
                  className={cn(
                    "whitespace-nowrap px-2.5 py-2.5 font-medium",
                    c.kind === "text" ? "text-left" : "text-right",
                    i === 0 && "sticky left-0 z-10 bg-surface-raised",
                  )}
                >
                  <button onClick={() => toggle(c.key, c.kind)} className="inline-flex items-center gap-1 hover:text-foreground">
                    {c.label}
                    {sort?.key === c.key && (sort.dir === 1 ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />)}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((m) => (
              <tr key={m.promo.id} onClick={() => onSelect(m.promo.id)} className="group cursor-pointer transition-colors hover:bg-surface-raised">
                {RESULT_COLUMNS.map((c, i) => {
                  const v = c.get(m);
                  if (i === 0)
                    return (
                      <td key={c.key} className="sticky left-0 z-10 max-w-[210px] bg-surface px-2.5 py-2 group-hover:bg-surface-raised">
                        <p className="truncate font-medium">{m.promo.name}</p>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {formatRange(m.promo.startDate, m.promo.endDate)}
                          {m.status !== "complete" && " · not final"}
                        </p>
                      </td>
                    );
                  return (
                    <td
                      key={c.key}
                      title={c.kind === "money" && typeof v === "number" ? moneyFull(v, currency) : undefined}
                      className={cn("whitespace-nowrap px-2.5 py-2", c.kind === "text" ? "text-left text-muted-foreground" : "text-right tabular", tone(c.kind, v))}
                    >
                      {fmt(c.kind, v, currency)}
                      {c.reported?.(m) && <span title="Reported by the Back Office">*</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-border bg-surface-raised font-semibold">
              <td className="sticky left-0 z-10 bg-surface-raised px-3 py-2.5">
                Total <span className="font-normal text-muted-foreground">· {list.length} promos</span>
              </td>
              {RESULT_COLUMNS.slice(1).map((c) => {
                const v = c.kind === "text" ? null : t[c.key];
                return (
                  <td
                    key={c.key}
                    title={c.kind === "money" && v != null ? moneyFull(v, currency) : undefined}
                    className={cn("whitespace-nowrap px-3 py-2.5", c.kind === "text" ? "" : "text-right tabular", tone(c.kind, v))}
                  >
                    {c.kind === "text" ? "" : fmt(c.kind, v, currency)}
                  </td>
                );
              })}
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Money in {currency}. Totals add up money and recalculate rates from the totals, over the promos that report each number. During vs Before is observed — not
        adjusted for the market trend. Live and recently ended promos are marked "not final".
        {anyReported && " * reported by the Back Office (not enough data to calculate it here)."} Hover a column name for its definition.
      </p>
    </div>
  );
}
