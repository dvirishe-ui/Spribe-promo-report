import { GroupedColumns } from "@/components/charts/GroupedColumns";
import { MetricChips } from "./MetricChips";
import { DEFAULT_PHASE_METRICS, PHASE_METRICS, phaseValues, type PhaseMetric, type PhaseUnit } from "@/lib/phases";
import type { PromoMetrics } from "@/lib/metrics";
import { money, num, numCompact, pct } from "@/lib/format";
import { cn } from "@/lib/utils";

const UNIT_TITLE: Record<PhaseUnit, string> = {
  money: "Wager and win",
  ggr: "GGR",
  avg: "Avg bet",
  bets: "Number of bets",
  players: "Active players",
  pct: "RTP",
};

function fmt(unit: PhaseUnit, v: number, cur: string, full = false): string {
  if (unit === "pct") return `${(v * 100).toFixed(full ? 2 : 1)}%`;
  if (unit === "avg") return new Intl.NumberFormat("en-US", { style: "currency", currency: cur, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
  if (unit === "money" || unit === "ggr") return full ? new Intl.NumberFormat("en-US", { style: "currency", currency: cur, maximumFractionDigits: 0 }).format(v) : money(v, cur);
  return full ? num(v) : numCompact(v);
}

/** "+18.2%" for amounts, "+0.4 pts" for RTP. */
function change(unit: PhaseUnit, from: number | null, to: number | null): string | null {
  if (from == null || to == null) return null;
  if (unit === "pct") {
    const pts = (to - from) * 100;
    return `${pts >= 0 ? "+" : "−"}${Math.abs(pts).toFixed(1)} pts`;
  }
  return from > 0 ? pct(to / from - 1) : null;
}

/**
 * Metrics comparison by phase: pick metrics as chips, see them Before /
 * During / After for the promos in view — one chart per unit (money, bets,
 * players, RTP) so different scales never share an axis.
 */
export function PhaseComparison({
  list,
  currency,
  value,
  onChange,
}: {
  list: PromoMetrics[];
  currency: string;
  value: string[];
  onChange: (keys: string[]) => void;
}) {
  const chosen = (value.length ? value : DEFAULT_PHASE_METRICS)
    .map((k) => PHASE_METRICS.find((m) => m.key === k))
    .filter((m): m is PhaseMetric => !!m);
  // Group by unit, in the order the units were first chosen.
  const groups: Array<{ unit: PhaseUnit; metrics: PhaseMetric[] }> = [];
  for (const m of chosen) {
    const g = groups.find((x) => x.unit === m.unit);
    if (g) g.metrics.push(m);
    else groups.push({ unit: m.unit, metrics: [m] });
  }
  const scope = list.length === 1 ? list[0].promo.name : `${list.length} promotions`;

  return (
    <section className="panel min-w-0 p-3 sm:p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide">Metrics comparison</h2>
          <p className="text-[11px] text-muted-foreground">Before · During · After — {scope}. Pick a promotion in the filters to see just that one.</p>
        </div>
        <MetricChips
          label="Metrics"
          options={PHASE_METRICS.map((m) => ({ key: m.key, label: m.label, hint: m.hint }))}
          value={chosen.map((m) => m.key)}
          onChange={onChange}
          max={7}
          className="w-full sm:w-auto sm:max-w-[40rem]"
        />
      </div>
      <div className={cn("grid gap-x-6 gap-y-5", groups.length > 1 && "lg:grid-cols-2", groups.length > 2 && groups.length !== 4 && "xl:grid-cols-3")}>
        {groups.map(({ unit, metrics }) => {
          const vals = metrics.map((m) => ({ m, v: phaseValues(m, list) }));
          const afterMissing = vals.some((x) => x.v.afterMissing);
          const n = Math.min(...vals.map((x) => x.v.n));
          return (
            <div key={unit} className="min-w-0">
              <p className="mb-1 text-xs font-semibold">{UNIT_TITLE[unit]}</p>
              {n === 0 ? (
                <p className="py-10 text-center text-xs text-muted-foreground">Not reported for these promotions yet.</p>
              ) : (
                <>
                  <GroupedColumns
                    categories={(["before", "during", "after"] as const).map((phase) => ({
                      key: phase,
                      label: phase === "before" ? "Before" : phase === "during" ? "During" : "After",
                      values: Object.fromEntries(vals.map(({ m, v }) => [m.key, v[phase]])),
                      extra:
                        phase === "before"
                          ? undefined
                          : vals.map(({ m, v }) => ({ label: `${m.label} vs before`, value: change(unit, v.before, v[phase]) ?? "—" })),
                    }))}
                    series={metrics.map((m) => ({ key: m.key, label: m.label, color: m.color }))}
                    format={(v) => fmt(unit, v, currency)}
                    formatFull={(v) => fmt(unit, v, currency, true)}
                    labelAll
                    maxCol={56}
                    height={210}
                  />
                  <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] text-muted-foreground">
                    {vals.map(({ m, v }) => {
                      const d = change(unit, v.before, v.during);
                      const a = change(unit, v.before, v.after);
                      return (
                        <span key={m.key}>
                          <span className="font-medium text-foreground">{m.label}</span> during {d ?? "—"} · after {a ?? "—"}
                        </span>
                      );
                    })}
                  </div>
                  {(afterMissing || n < list.length) && (
                    <p className="mt-0.5 text-[10px] text-muted-foreground">
                      {n < list.length && `${n} of ${list.length} promotions report this. `}
                      {afterMissing && "After isn't shown until every promo here has finished its after window."}
                    </p>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
