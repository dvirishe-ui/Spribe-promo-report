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
