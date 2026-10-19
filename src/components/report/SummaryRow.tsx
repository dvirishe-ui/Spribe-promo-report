import type { ReactNode } from "react";
import { CircleMinus, TrendingDown, TrendingUp } from "lucide-react";
import type { PromoMetrics } from "@/lib/metrics";
import { rollup } from "@/lib/rollup";
import { money, moneyFull, pct } from "@/lib/format";
import { cn } from "@/lib/utils";

function Cell({ label, children, title, className }: { label: string; children: ReactNode; title?: string; className?: string }) {
  return (
    <div title={title} className={cn("min-w-0 border-border px-3 py-2", className)}>
      <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="mt-0.5 truncate text-lg font-bold leading-tight tabular">{children}</div>
    </div>
  );
}

const tone = (v: number | null) => (v == null || Math.abs(v) < 0.005 ? "" : v > 0 ? "text-good-ink" : "text-bad-ink");

/**
 * One row of headline numbers for the promos in view, in the order of the
 * team's promo sheet: promotions, contribution, GGR before / during / after,
 * during vs before, after vs before, GGR vs previous month, GGR impact.
 */
export function SummaryRow({ list, currency, momChange }: { list: PromoMetrics[]; currency: string; momChange: number | null }) {
  const r = rollup(list);
  const impact = r.dvb == null ? null : r.dvb >= 0.03 ? "Positive" : r.dvb <= -0.03 ? "Negative" : "Neutral";
  const ImpactIcon = impact === "Positive" ? TrendingUp : impact === "Negative" ? TrendingDown : CircleMinus;
  return (
    <section className="panel grid grid-cols-3 divide-y divide-border overflow-hidden sm:grid-cols-5 sm:divide-y-0 xl:grid-cols-9 [&>*]:border-r">
      <Cell label="Promotions">{r.count}</Cell>
      <Cell label="Contribution" title={r.contribution == null ? undefined : moneyFull(r.contribution, currency)}>
        {money(r.contribution, currency)}
      </Cell>
      <Cell label="GGR before" title={r.before == null ? undefined : moneyFull(r.before, currency)}>
        {money(r.before, currency)}
      </Cell>
      <Cell label="GGR during" title={r.during == null ? undefined : moneyFull(r.during, currency)}>
        {money(r.during, currency)}
      </Cell>
      <Cell label="GGR after" title={r.after == null ? undefined : moneyFull(r.after, currency)}>
        {money(r.after, currency)}
      </Cell>
      <Cell label="During vs before" title="GGR per day during vs before, weighted by each promo's baseline. Observed.">
        <span className={tone(r.dvb)}>{pct(r.dvb)}</span>
      </Cell>
      <Cell label="After vs before" title="GGR per day after the promos vs before.">
        <span className={tone(r.avb)}>{pct(r.avb)}</span>
      </Cell>
      <Cell label="GGR vs prev. month" title="Total GGR of the month (all operators) vs the month before.">
        <span className={tone(momChange)}>{pct(momChange)}</span>
      </Cell>
      <Cell
        label="GGR impact"
        title="Positive when GGR during is ≥3% above before, negative when ≥3% below. Observed — not proof the promo caused it."
        className={cn(impact === "Positive" && "bg-good/10", impact === "Negative" && "bg-bad/10")}
      >
        {impact ? (
          <span className={cn("inline-flex items-center gap-1", impact === "Positive" ? "text-good-ink" : impact === "Negative" ? "text-bad-ink" : "text-muted-foreground")}>
            <ImpactIcon className="size-4" />
            {impact}
          </span>
        ) : (
          "—"
        )}
      </Cell>
    </section>
  );
}
