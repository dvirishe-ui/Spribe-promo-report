import { useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { formatRange } from "@/lib/dates";
import { money, moneySigned, multiple, pct } from "@/lib/format";
import type { PromoMetrics } from "@/lib/metrics";
import { cn } from "@/lib/utils";
import { StatusBadge, VerdictBadge } from "./bits";

type SortKey = "name" | "start" | "before" | "during" | "after" | "dvb" | "avb" | "extra" | "roi";

const COLS: Array<{ key: SortKey; label: string; num?: boolean; get: (m: PromoMetrics) => number | string | null }> = [
  { key: "name", label: "Promo", get: (m) => m.promo.name.toLowerCase() },
  { key: "start", label: "Dates", get: (m) => m.promo.startDate },
  { key: "before", label: "GGR before", num: true, get: (m) => m.ggrBefore },
  { key: "during", label: "GGR during", num: true, get: (m) => m.ggrDuring },
  { key: "after", label: "GGR after", num: true, get: (m) => m.ggrAfter },
  { key: "dvb", label: "During vs before", num: true, get: (m) => m.duringVsBefore },
  { key: "avb", label: "After vs before", num: true, get: (m) => m.afterVsBefore },
  { key: "extra", label: "Extra GGR", num: true, get: (m) => (m.incrementalGgr == null ? null : m.incrementalGgr + (m.haloGgr ?? 0)) },
  { key: "roi", label: "ROI", num: true, get: (m) => m.roi },
];

function PctCell({ v }: { v: number | null }) {
  return (
    <span className={cn(v == null ? "text-muted-foreground" : v >= 0 ? "text-good-ink" : "text-bad-ink")}>{pct(v)}</span>
  );
}

export function PromoTable({ metrics, currency, onOpen }: { metrics: PromoMetrics[]; currency: string; onOpen: (id: string) => void }) {
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "start", dir: -1 });
  const col = COLS.find((c) => c.key === sort.key)!;
  const sorted = [...metrics].sort((a, b) => {
    const va = col.get(a);
    const vb = col.get(b);
    if (va == null && vb == null) return 0;
    if (va == null) return 1;
    if (vb == null) return -1;
    return (va < vb ? -1 : va > vb ? 1 : 0) * sort.dir;
  });

  if (!metrics.length) return <p className="py-6 text-center text-sm text-muted-foreground">No promos match this view.</p>;

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full min-w-[980px] text-sm">
        <thead className="bg-surface-raised text-xs text-muted-foreground">
          <tr>
            {COLS.map((c) => (
              <th key={c.key} className={cn("px-3 py-2.5 font-medium", c.num ? "text-right" : "text-left")}>
                <button
                  onClick={() => setSort((s) => ({ key: c.key, dir: s.key === c.key ? (s.dir === 1 ? -1 : 1) : c.num ? -1 : 1 }))}
                  className={cn("inline-flex items-center gap-1 hover:text-foreground", sort.key === c.key && "text-foreground")}
                >
                  {c.label}
                  {sort.key === c.key && (sort.dir === 1 ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />)}
                </button>
              </th>
            ))}
            <th className="px-3 py-2.5 text-left font-medium">Verdict</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((m) => (
            <tr
              key={m.promo.id}
              onClick={() => onOpen(m.promo.id)}
              className="cursor-pointer border-t border-border transition-colors hover:bg-surface-raised/70"
            >
              <td className="max-w-[260px] px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium">{m.promo.name}</span>
                  <StatusBadge status={m.status} />
                </div>
                <div className="truncate text-xs text-muted-foreground">
                  {[m.promo.operator, m.promo.type, m.promo.games.join(", "), m.promo.market].filter(Boolean).join(" · ")}
                </div>
              </td>
              <td className="px-3 py-2.5 whitespace-nowrap text-xs text-muted-foreground">
                {formatRange(m.promo.startDate, m.promo.endDate)}
                <div>{m.promoDays} days</div>
              </td>
              <td className="px-3 py-2.5 text-right tabular">{money(m.ggrBefore, currency)}</td>
              <td className="px-3 py-2.5 text-right tabular">
                {money(m.ggrDuring, currency)}
                {m.partialDuring && <div className="text-[10px] text-muted-foreground">so far</div>}
              </td>
              <td className="px-3 py-2.5 text-right tabular">{money(m.ggrAfter, currency)}</td>
              <td className="px-3 py-2.5 text-right tabular font-medium">
                <PctCell v={m.duringVsBefore} />
              </td>
              <td className="px-3 py-2.5 text-right tabular">
                <PctCell v={m.afterVsBefore} />
              </td>
              <td className="px-3 py-2.5 text-right tabular">
                {moneySigned(m.incrementalGgr == null ? null : m.incrementalGgr + (m.haloGgr ?? 0), currency)}
              </td>
              <td className="px-3 py-2.5 text-right tabular">{multiple(m.roi)}</td>
              <td className="px-3 py-2.5">
                <VerdictBadge verdict={m.verdict} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
