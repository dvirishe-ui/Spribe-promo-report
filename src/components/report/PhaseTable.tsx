import { PHASES } from "@/components/charts/core";
import { formatPhase, phaseChange } from "./PhaseComparison";
import { PHASE_METRICS, phaseValues, type PhaseUnit } from "@/lib/phases";
import type { PromoMetrics } from "@/lib/metrics";
import { formatDay } from "@/lib/dates";
import { cn } from "@/lib/utils";

/** Metrics where "up" is simply good for the business; the others get a neutral pill. */
const GOOD_WHEN_UP = new Set(["wager", "ggr", "bets", "players"]);

function ChangeChip({ text, metric }: { text: string | null; metric: string }) {
  if (!text) return <span className="text-muted-foreground">—</span>;
  const up = text.startsWith("+");
  const down = text.startsWith("−") || text.startsWith("-");
  const tone = !GOOD_WHEN_UP.has(metric) || (!up && !down) ? "bg-muted text-muted-foreground" : up ? "bg-good/12 text-good-ink" : "bg-bad/12 text-bad-ink";
  return <span className={cn("inline-block rounded-full px-2 py-0.5 text-[11.5px] font-medium tabular whitespace-nowrap", tone)}>{text}</span>;
}

/**
 * One promo's numbers by window: every phase metric Before / During / After,
 * with the change vs before as a coloured chip. The During column is tinted so
 * the promo itself stands out.
 */
export function PhaseTable({ m, currency }: { m: PromoMetrics; currency: string }) {
  const p = m.promo;
  // "21–24 Sep", or "29 Sep – 2 Oct" across months
  const short = (a: string, b: string) => (a.slice(0, 7) === b.slice(0, 7) ? `${Number(a.slice(8))}–${formatDay(b)}` : `${formatDay(a)} – ${formatDay(b)}`);
  const dates = { before: short(m.beforeStart, m.beforeEnd), during: short(p.startDate, p.endDate), after: short(m.afterStart, m.afterEnd) };
  const rows = PHASE_METRICS.map((metric) => ({ metric, v: phaseValues(metric, [m]) }));
  // Before/after can be longer than the promo: then amounts are compared per day, and unique players not at all.
  const unequal = m.windowDays !== m.promoDays;
  const duringChange = (unit: PhaseUnit, b: number | null, d: number | null) => {
    if (!unequal || unit === "avg" || unit === "pct") return phaseChange(unit, b, d);
    if (unit === "players") return null;
    return phaseChange(unit, b == null ? null : b / m.windowDays, d == null ? null : d / m.promoDays);
  };
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] text-[13px]">
        <thead>
          <tr className="text-[11px] text-muted-foreground">
            <th className="px-3 pb-2 pt-2.5 text-left font-medium">Metric</th>
            {PHASES.map((ph) => (
              <th key={ph.key} className={cn("px-2 pb-2 pt-2.5 text-right font-medium", ph.key === "during" && "bg-[color-mix(in_oklch,var(--series-during)_7%,transparent)]")}>
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground">
                  <span className="size-2 rounded-full" style={{ background: ph.color }} />
                  {ph.label}
                </span>
                <span className="block whitespace-nowrap font-normal">{dates[ph.key]}</span>
              </th>
            ))}
            <th className="px-2 pb-2 pt-2.5 text-right align-bottom font-medium" title={unequal ? `The promo is ${m.promoDays} days and the before window ${m.windowDays}: amounts are compared per day; active players aren't compared.` : undefined}>
              During vs before{unequal && <span className="block font-normal">per day</span>}
            </th>
            <th className="px-3 pb-2 pt-2.5 text-right align-bottom font-medium">After vs before</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ metric, v }) => {
            const has = v.n > 0;
            const cell = (x: number | null) => (has && x != null ? formatPhase(metric.unit, x, currency) : "—");
            return (
              <tr key={metric.key} title={metric.hint} className="border-t border-border/70 transition-colors hover:bg-surface-raised/60">
                <td className="whitespace-nowrap px-3 py-2 font-medium">{metric.label}</td>
                <td className="px-2 py-2 text-right tabular text-muted-foreground">{cell(v.before)}</td>
                <td className="bg-[color-mix(in_oklch,var(--series-during)_7%,transparent)] px-2 py-2 text-right font-semibold tabular">{cell(v.during)}</td>
                <td className="px-2 py-2 text-right tabular text-muted-foreground">{cell(v.after)}</td>
                <td className="px-2 py-1.5 text-right">
                  <ChangeChip metric={metric.key} text={has ? duringChange(metric.unit, v.before, v.during) : null} />
                </td>
                <td className="px-3 py-1.5 text-right">
                  <ChangeChip metric={metric.key} text={has ? phaseChange(metric.unit, v.before, v.after) : null} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
