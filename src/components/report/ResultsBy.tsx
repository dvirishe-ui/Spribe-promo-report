import { useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { aggregate, type PromoMetrics } from "@/lib/metrics";
import { marketLabel } from "@/lib/markets";
import { money, pct } from "@/lib/format";
import { cn } from "@/lib/utils";

export type Dimension = "market" | "aggregator" | "operator" | "type";

export const DIMENSION_LABEL: Record<Dimension, string> = {
  market: "Market",
  aggregator: "Aggregator",
  operator: "Operator",
  type: "Promotion type",
};

export function groupKey(m: PromoMetrics, d: Dimension): string {
  return m.promo[d] || "—";
}

export function displayKey(k: string, d: Dimension): string {
  return d === "market" ? marketLabel(k) : k;
}

export function groupBy(list: PromoMetrics[], d: Dimension) {
  const map = new Map<string, PromoMetrics[]>();
  for (const m of list) {
    const k = groupKey(m, d);
    map.set(k, [...(map.get(k) ?? []), m]);
  }
  return [...map.entries()].map(([key, items]) => ({ key, items, agg: aggregate(items) }));
}

/**
 * Ranks markets / aggregators / operators / promotion types by how much GGR
 * went up during their promos. Click a row to filter the whole page to it.
 */
export function ResultsBy({
  list,
  currency,
  active,
  onPick,
}: {
  list: PromoMetrics[];
  currency: string;
  /** Currently filtered value per dimension, to highlight it */
  active: Partial<Record<Dimension, string>>;
  onPick: (d: Dimension, key: string) => void;
}) {
  const [dim, setDim] = useState<Dimension>("market");
  const rows = groupBy(list, dim).sort((a, b) => (b.agg.duringVsBefore ?? -Infinity) - (a.agg.duringVsBefore ?? -Infinity));
  const max = Math.max(0.01, ...rows.map((r) => Math.abs(r.agg.duringVsBefore ?? 0)));
  const hasNeg = rows.some((r) => (r.agg.duringVsBefore ?? 0) < 0);

  return (
    <section className="panel min-w-0 p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-display text-base font-semibold">Results by {DIMENSION_LABEL[dim].toLowerCase()}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">GGR during vs before. Click a row to filter by it.</p>
        </div>
        <Tabs value={dim} onValueChange={(v) => setDim(v as Dimension)}>
          <TabsList className="h-8">
            <TabsTrigger value="market" className="h-6 px-2 text-xs">Market</TabsTrigger>
            <TabsTrigger value="aggregator" className="h-6 px-2 text-xs">Aggregator</TabsTrigger>
            <TabsTrigger value="operator" className="h-6 px-2 text-xs">Operator</TabsTrigger>
            <TabsTrigger value="type" className="h-6 px-2 text-xs">Type</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      {rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">No promos in this view.</p>
      ) : (
        <div className="space-y-1">
          {rows.map((r) => {
            const v = r.agg.duringVsBefore;
            const w = v == null ? 0 : (Math.abs(v) / max) * (hasNeg ? 50 : 100);
            const isActive = active[dim] === r.key;
            return (
              <button
                key={r.key}
                onClick={() => onPick(dim, r.key)}
                className={cn(
                  "grid w-full grid-cols-[minmax(0,9rem)_1fr_4.5rem] items-center gap-3 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-surface-raised sm:grid-cols-[minmax(0,11rem)_1fr_4.5rem]",
                  isActive && "bg-primary/10",
                )}
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium">{displayKey(r.key, dim)}</span>
                  <span className="block truncate text-[11px] text-muted-foreground">
                    {r.agg.count} promo{r.agg.count === 1 ? "" : "s"} · {money(r.agg.ggrDuring, currency)} during
                  </span>
                </span>
                <span className="relative h-2.5 rounded-full bg-surface-raised">
                  {hasNeg && <span className="absolute inset-y-[-3px] left-1/2 w-px bg-viz-axis" />}
                  {v != null && (
                    <span
                      className="absolute inset-y-0 rounded-full"
                      style={{
                        width: `${w}%`,
                        left: hasNeg ? (v >= 0 ? "50%" : `${50 - w}%`) : 0,
                        background: v >= 0 ? "var(--good)" : "var(--bad)",
                      }}
                    />
                  )}
                </span>
                <span className={cn("text-right text-sm font-semibold tabular", v == null ? "text-muted-foreground" : v >= 0 ? "text-good-ink" : "text-bad-ink")}>
                  {pct(v)}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
