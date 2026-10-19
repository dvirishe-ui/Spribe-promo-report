import { Link } from "@tanstack/react-router";
import { ArrowRight, Check } from "lucide-react";
import { ResultTag } from "./Outcome";
import { formatPhase, phaseChange } from "./PhaseComparison";
import { PHASE_METRICS, phaseValues } from "@/lib/phases";
import type { PromoMetrics } from "@/lib/metrics";
import { formatRange } from "@/lib/dates";
import { flagFor } from "@/lib/markets";
import { money, multiple, num, pctPlain } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Metrics where "up" is simply good for the business; the rest are shown without colour. */
const GOOD_WHEN_UP = new Set(["wager", "ggr", "bets", "players"]);

/**
 * One promotion's own numbers: every phase metric Before / During / After
 * with the change vs before, plus contribution, participation and ROI.
 */
export function PromoPhaseCard({
  m,
  currency,
  selected,
  onToggle,
}: {
  m: PromoMetrics;
  currency: string;
  selected: boolean;
  onToggle: () => void;
}) {
  const p = m.promo;
  const rows = PHASE_METRICS.map((metric) => ({ metric, v: phaseValues(metric, [m]) }));
  const notFinal = m.status !== "complete";
  return (
    <article className={cn("panel min-w-0 overflow-hidden", selected && "ring-1 ring-primary/50")}>
      <header className="flex items-start justify-between gap-3 border-b border-border px-3 py-2.5">
        <div className="min-w-0">
          <p className="flex items-center gap-2">
            <Link to="/promo/$promoId" params={{ promoId: p.id }} className="truncate text-sm font-semibold hover:text-primary">
              {p.name}
            </Link>
            <ResultTag m={m} currency={currency} />
          </p>
          <p className="truncate text-[11px] text-muted-foreground">
            {p.operator} · {flagFor(p.market)} {p.market} · {p.type} · {formatRange(p.startDate, p.endDate)} ({m.promoDays} d)
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            onClick={onToggle}
            aria-pressed={selected}
            title={selected ? "Remove from comparison" : "Add to comparison"}
            className={cn("press inline-flex h-7 items-center gap-1 rounded-md border px-2 text-[11px]", selected ? "border-primary bg-primary/10" : "border-border text-muted-foreground hover:text-foreground")}
          >
            <span className={cn("grid size-3.5 place-items-center rounded-sm border", selected ? "border-primary bg-primary text-primary-foreground" : "border-border")}>
              {selected && <Check className="size-2.5" />}
            </span>
            Compare
          </button>
          <Link to="/promo/$promoId" params={{ promoId: p.id }} className="press inline-flex h-7 items-center gap-1 rounded-md px-2 text-[11px] text-primary hover:bg-primary/10">
            Report <ArrowRight className="size-3" />
          </Link>
        </div>
      </header>

      <table className="w-full table-fixed text-[12.5px]">
        <colgroup>
          <col className="w-[28%]" />
          <col />
          <col />
          <col />
          <col />
          <col />
        </colgroup>
        <thead>
          <tr className="bg-surface-raised text-[10px] uppercase tracking-wide text-muted-foreground">
            <th className="px-3 py-1.5 text-left font-medium">Metric</th>
            <th className="px-2 py-1.5 text-right font-medium">Before</th>
            <th className="px-2 py-1.5 text-right font-medium">During</th>
            <th className="px-2 py-1.5 text-right font-medium">After</th>
            <th className="px-2 py-1.5 text-right font-medium">During vs before</th>
            <th className="px-3 py-1.5 text-right font-medium">After vs before</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/70">
          {rows.map(({ metric, v }) => {
            const has = v.n > 0;
            const d = has ? phaseChange(metric.unit, v.before, v.during) : null;
            const a = has ? phaseChange(metric.unit, v.before, v.after) : null;
            const color = (s: string | null) =>
              !s || !GOOD_WHEN_UP.has(metric.key) ? "text-muted-foreground" : s.startsWith("+") ? "text-good-ink" : s.startsWith("−") || s.startsWith("-") ? "text-bad-ink" : "";
            const cell = (x: number | null) => (has && x != null ? formatPhase(metric.unit, x, currency) : "—");
            return (
              <tr key={metric.key} title={metric.hint}>
                <td className="truncate px-3 py-1.5">{metric.label}</td>
                <td className="px-2 py-1.5 text-right tabular">{cell(v.before)}</td>
                <td className="px-2 py-1.5 text-right font-semibold tabular">{cell(v.during)}</td>
                <td className="px-2 py-1.5 text-right tabular">{cell(v.after)}</td>
                <td className={cn("px-2 py-1.5 text-right tabular", color(d))}>{d ?? "—"}</td>
                <td className={cn("px-3 py-1.5 text-right tabular", color(a))}>{a ?? "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <footer className="flex flex-wrap gap-x-4 gap-y-0.5 border-t border-border bg-surface-raised/50 px-3 py-1.5 text-[11px] text-muted-foreground">
        <span>
          Contribution <span className="font-semibold text-foreground">{money(p.prizePool, currency)}</span>
        </span>
        <span>
          Participants <span className="font-semibold text-foreground">{num(m.participants)}</span>
          {m.participationRate != null && ` (${pctPlain(m.participationRate, 1)})`}
        </span>
        <span>
          Promo ROI <span className="font-semibold text-foreground">{multiple(m.promoRoi)}</span>
        </span>
        {notFinal && <span className="text-accent">{m.status === "upcoming" ? "Not started yet" : "Results not final yet"}</span>}
      </footer>
    </article>
  );
}
