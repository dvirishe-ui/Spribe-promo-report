import { CheckCircle2, CircleMinus, Clock, DatabaseZap, TrendingDown, TriangleAlert } from "lucide-react";
import type { PromoMetrics } from "@/lib/metrics";
import { outcomeFor, type OutcomeTone } from "@/lib/verdict";
import { cn } from "@/lib/utils";

/**
 * Short result labels with an icon, so the result never depends on colour
 * alone. Criteria (see lib/verdict.ts): Positive = GGR during vs before ≥ +3%
 * and extra GGR covered the promo contribution (when it is known); Mixed = GGR
 * up but it didn't cover the contribution; Flat = within ±3%; Negative = down
 * more than 3%; Pending = not started or not fully measured yet.
 */
export const RESULT: Record<OutcomeTone, { label: string; icon: typeof Clock; cls: string; criterion: string }> = {
  good: { label: "Positive", icon: CheckCircle2, cls: "text-good-ink", criterion: "GGR up ≥3% and extra GGR covered the contribution" },
  mixed: { label: "Mixed", icon: TriangleAlert, cls: "text-accent", criterion: "GGR up, but extra GGR didn't cover the contribution" },
  neutral: { label: "Flat", icon: CircleMinus, cls: "text-muted-foreground", criterion: "GGR within ±3% of before" },
  bad: { label: "Negative", icon: TrendingDown, cls: "text-bad-ink", criterion: "GGR down more than 3%" },
  pending: { label: "Pending", icon: Clock, cls: "text-primary", criterion: "Not started, still running, or not fully measured" },
};

export const RESULT_ORDER: OutcomeTone[] = ["good", "mixed", "neutral", "bad", "pending"];

export function ResultTag({ m, currency, className, showLabel = true }: { m: PromoMetrics; currency: string; className?: string; showLabel?: boolean }) {
  const tone = outcomeFor(m, currency).tone;
  const r = RESULT[tone];
  const Icon = r.icon;
  return (
    <span title={`${r.label}: ${r.criterion}`} className={cn("inline-flex items-center gap-1 whitespace-nowrap text-xs font-medium", r.cls, className)}>
      <Icon className="size-3.5 shrink-0" />
      {showLabel && <span className="hidden sm:inline">{r.label}</span>}
    </span>
  );
}

/** A small marker when core numbers are missing. */
export function MissingDataMark({ m }: { m: PromoMetrics }) {
  if (m.quality.level === "complete" || m.status === "upcoming") return null;
  return (
    <span title={`Missing: ${m.quality.missing.join(", ")}`} className={cn("inline-flex", m.quality.level === "minimal" ? "text-bad-ink" : "text-muted-foreground")}>
      <DatabaseZap className="size-3.5" />
      <span className="sr-only">Missing data: {m.quality.missing.join(", ")}</span>
    </span>
  );
}

/**
 * "6 promotions | ✓ 4 Positive | ⚠ 1 Mixed | – 1 Flat | ↓ 0 Negative | ◷ 0 Pending"
 * with a thin proportional bar. Each segment filters by that result when
 * onPick is given. Criteria are in the info tooltip — a GGR increase alone
 * is never called positive.
 */
export function OutcomeStrip({
  list,
  currency,
  active,
  onPick,
}: {
  list: PromoMetrics[];
  currency: string;
  active?: OutcomeTone | null;
  onPick?: (t: OutcomeTone) => void;
}) {
  const counts = new Map<OutcomeTone, number>();
  for (const m of list) {
    const t = outcomeFor(m, currency).tone;
    counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  const fill: Record<OutcomeTone, string> = {
    good: "var(--good)",
    mixed: "var(--color-accent)",
    neutral: "var(--color-muted-foreground)",
    bad: "var(--bad)",
    pending: "var(--color-primary)",
  };
  return (
    <div className="panel flex flex-wrap items-center gap-x-1 gap-y-1.5 px-3 py-2">
      <span className="mr-1 text-sm font-semibold tabular">
        {list.length} <span className="font-normal text-muted-foreground">promotion{list.length === 1 ? "" : "s"}</span>
      </span>
      {RESULT_ORDER.filter((t) => counts.get(t) || t === "good" || t === "bad").map((t) => {
        const r = RESULT[t];
        const Icon = r.icon;
        const n = counts.get(t) ?? 0;
        return (
          <button
            key={t}
            disabled={!onPick || !n}
            onClick={() => onPick?.(t)}
            title={`${r.label}: ${r.criterion}`}
            className={cn(
              "inline-flex items-center gap-1 rounded-md border-l border-border px-2 py-0.5 text-xs transition-colors enabled:hover:bg-surface-raised",
              active === t && "bg-primary/10 ring-1 ring-primary/40",
              !n && "opacity-50",
            )}
          >
            <Icon className={cn("size-3.5", r.cls)} />
            <span className="font-semibold tabular">{n}</span>
            <span className="text-muted-foreground">{r.label}</span>
          </button>
        );
      })}
      <div className="ml-auto flex h-1.5 w-full overflow-hidden rounded-full bg-surface-raised sm:w-40" aria-hidden>
        {RESULT_ORDER.map((t) => (
          <span key={t} style={{ width: `${((counts.get(t) ?? 0) / Math.max(1, list.length)) * 100}%`, background: fill[t] }} />
        ))}
      </div>
    </div>
  );
}
