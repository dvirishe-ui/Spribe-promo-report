import { ArrowRight, CheckCircle2, CircleMinus, Clock, Lightbulb, TrendingDown, TriangleAlert } from "lucide-react";
import { PHASES } from "@/components/charts/core";
import { money, moneySigned, multiple, num, pct, pctPlain } from "@/lib/format";
import type { PromoMetrics } from "@/lib/metrics";
import { outcomeFor, type OutcomeTone } from "@/lib/verdict";
import { cn } from "@/lib/utils";

const TONE: Record<OutcomeTone, { band: string; chip: string; icon: typeof Clock }> = {
  good: { band: "border-good/40 bg-good/[0.06]", chip: "bg-good text-white", icon: CheckCircle2 },
  mixed: { band: "border-accent/50 bg-accent/[0.08]", chip: "bg-accent text-accent-foreground", icon: TriangleAlert },
  neutral: { band: "border-border bg-surface-raised/60", chip: "bg-muted-foreground text-background", icon: CircleMinus },
  bad: { band: "border-bad/40 bg-bad/[0.06]", chip: "bg-bad text-white", icon: TrendingDown },
  pending: { band: "border-primary/30 bg-primary/[0.06]", chip: "bg-primary text-primary-foreground", icon: Clock },
};

export function OutcomeChip({ m, currency, className }: { m: PromoMetrics; currency: string; className?: string }) {
  const o = outcomeFor(m, currency);
  const t = TONE[o.tone];
  return <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap", t.chip, className)}>{o.label}</span>;
}

/**
 * The answer first: outcome in words, three big numbers, one picture.
 * Everything here is readable in a few seconds by someone who never opens the tabs.
 */
export function ResultHero({ m, currency, showNextSteps = true }: { m: PromoMetrics; currency: string; showNextSteps?: boolean }) {
  const o = outcomeFor(m, currency);
  const t = TONE[o.tone];
  const cost = m.promo.prizePool;
  const extra = m.incrementalGgr == null ? null : m.incrementalGgr + (m.haloGgr ?? 0);
  const payback = cost && cost > 0 && extra != null && m.status === "complete" ? extra / cost : null;
  const change = m.primaryChange;

  return (
    <section className="space-y-4">
      <div className={cn("rounded-2xl border p-5 sm:p-6", t.band)}>
        <div className="flex items-start gap-3">
          <t.icon className={cn("mt-1 size-6 shrink-0", o.tone === "good" ? "text-good-ink" : o.tone === "bad" ? "text-bad-ink" : o.tone === "mixed" ? "text-accent" : o.tone === "pending" ? "text-primary" : "text-muted-foreground")} />
          <div className="min-w-0">
            <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold", t.chip)}>{o.label}</span>
            <h2 className="mt-2 text-balance font-display text-2xl font-bold leading-tight sm:text-3xl">{o.headline}</h2>
            <p className="mt-1.5 text-sm text-muted-foreground sm:text-base">{o.sub}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <BigNumber
          label="GGR change"
          value={change == null ? "—" : pct(change)}
          tone={change == null ? undefined : change >= 0 ? "good" : "bad"}
          sub={change == null ? "needs before and during GGR" : `per day vs the ${m.windowDays} days before · ${m.isAdjusted ? "adjusted for market trend" : "not adjusted"}`}
        />
        {payback != null ? (
          <BigNumber
            label="Return on rewards"
            value={multiple(payback)}
            tone={payback >= 1 ? "good" : "bad"}
            sub={`${moneySigned(extra, currency)} extra GGR on ${money(cost, currency)} rewards`}
          />
        ) : (
          <BigNumber
            label="Extra GGR"
            value={moneySigned(extra, currency)}
            tone={extra == null ? undefined : extra >= 0 ? "good" : "bad"}
            sub={m.status !== "complete" ? "so far — not final" : "over the before run-rate"}
          />
        )}
        {m.participants != null ? (
          <BigNumber
            label="Players took part"
            value={num(m.participants)}
            sub={[m.newShare != null && `${pctPlain(m.newShare)} new`, m.retentionRate != null && `${pctPlain(m.retentionRate)} came back after`].filter(Boolean).join(" · ") || undefined}
          />
        ) : (
          <BigNumber
            label="After it ended"
            value={m.afterVsBefore == null ? "—" : pct(m.afterVsBefore)}
            tone={m.afterVsBefore == null ? undefined : m.afterVsBefore >= 0 ? "good" : "bad"}
            sub="GGR per day vs before"
          />
        )}
      </div>

      <PerDayStrip m={m} currency={currency} />

      {showNextSteps && o.nextSteps.length > 0 && (
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
            <Lightbulb className="size-4 text-primary" /> Suggested next steps
          </p>
          <ul className="space-y-1.5 text-sm text-muted-foreground">
            {o.nextSteps.map((s) => (
              <li key={s} className="flex gap-2">
                <span className="mt-2 size-1 shrink-0 rounded-full bg-muted-foreground" />
                {s}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function BigNumber({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "good" | "bad" }) {
  return (
    <div className="panel min-w-0 p-4 sm:p-5">
      <p className="text-eyebrow">{label}</p>
      <p className={cn("mt-2 font-display text-4xl font-bold tracking-tight", tone === "good" && "text-good-ink", tone === "bad" && "text-bad-ink")}>{value}</p>
      {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

/** Before → During → After as three bars of GGR per day, with the change on the arrows. */
function PerDayStrip({ m, currency }: { m: PromoMetrics; currency: string }) {
  const vals = [m.perDayBefore, m.perDayDuring, m.perDayAfter];
  const max = Math.max(1, ...vals.map((v) => v ?? 0));
  const changes = [null, m.duringVsBefore, m.afterVsBefore];
  return (
    <div className="panel p-4 sm:p-5">
      <p className="text-eyebrow">GGR per day</p>
      <div className="mt-3 grid grid-cols-[1fr_auto_1fr_auto_1fr] items-end gap-2 sm:gap-4">
        {PHASES.map((ph, i) => (
          <div key={ph.key} className="contents">
            {i > 0 && (
              <div className="flex flex-col items-center pb-8 text-xs">
                <span className={cn("font-semibold tabular", changes[i] == null ? "text-muted-foreground" : changes[i]! >= 0 ? "text-good-ink" : "text-bad-ink")}>
                  {changes[i] == null ? "—" : pct(changes[i])}
                </span>
                <ArrowRight className="size-4 text-muted-foreground" />
              </div>
            )}
            <div className="flex min-w-0 flex-col items-center">
              <span className="mb-1 text-sm font-semibold tabular sm:text-base">{vals[i] == null ? "—" : money(vals[i], currency)}</span>
              <div className="flex h-24 w-full max-w-28 items-end rounded-md bg-surface-raised">
                <div className="w-full rounded-t-md transition-[height] duration-700" style={{ height: `${vals[i] == null ? 0 : (vals[i]! / max) * 100}%`, background: ph.color }} />
              </div>
              <span className="mt-1.5 text-xs font-medium">{ph.label}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
