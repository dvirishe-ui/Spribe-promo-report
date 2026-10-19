import type { ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, CircleAlert, Coins, Database, HeartPulse, Target, TrendingDown, TrendingUp, Users } from "lucide-react";
import type { Insight } from "@/lib/insights";
import type { PromoMetrics } from "@/lib/metrics";
import { money, pct, pctPlain } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useOpenLink } from "./InsightCard";

/** Tiny month columns (or a line for changes) for a KPI tile; the current month is emphasised. */
export function Sparkline({ values, focus, line = false }: { values: Array<number | null>; focus: number; line?: boolean }) {
  const w = 84;
  const h = 26;
  const nums = values.filter((v): v is number => v != null);
  if (nums.length < 2) return null;
  const lo = Math.min(0, ...nums);
  const hi = Math.max(0, ...nums) || 1;
  const y = (v: number) => h - 2 - ((v - lo) / (hi - lo || 1)) * (h - 4);
  const step = w / values.length;
  if (line) {
    const pts = values.map((v, i) => (v == null ? null : `${(i + 0.5) * step},${y(v)}`)).filter(Boolean);
    const fv = values[focus];
    return (
      <svg width={w} height={h} aria-hidden className="shrink-0 overflow-visible">
        {lo < 0 && <line x1={0} x2={w} y1={y(0)} y2={y(0)} stroke="var(--viz-grid)" />}
        <polyline points={pts.join(" ")} fill="none" stroke="var(--series-before)" strokeWidth={1.5} strokeLinejoin="round" />
        {fv != null && <circle cx={(focus + 0.5) * step} cy={y(fv)} r={2.5} fill="var(--series-before)" />}
      </svg>
    );
  }
  const bw = Math.max(2, step * 0.62);
  return (
    <svg width={w} height={h} aria-hidden className="shrink-0">
      {values.map((v, i) =>
        v == null ? null : (
          <rect
            key={i}
            x={i * step + (step - bw) / 2}
            y={Math.min(y(v), y(0))}
            width={bw}
            height={Math.max(1, Math.abs(y(0) - y(v)))}
            rx={1}
            fill={i === focus ? "var(--series-before)" : "color-mix(in oklab, var(--series-before) 35%, var(--viz-surface))"}
          />
        ),
      )}
    </svg>
  );
}

/** One KPI: label, big value, change vs the previous period, and the recent trend. */
export function KpiTile({
  icon: Icon,
  label,
  value,
  delta,
  deltaGood,
  sub,
  info,
  spark,
}: {
  icon: typeof Users;
  label: string;
  value: ReactNode;
  /** e.g. "+2 vs Aug" */
  delta?: string | null;
  /** true = good direction, false = bad, null = neutral */
  deltaGood?: boolean | null;
  sub?: ReactNode;
  info: string;
  spark?: ReactNode;
}) {
  return (
    <div className="panel flex items-end justify-between gap-2 px-3 py-2.5" title={info}>
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
          <Icon className="size-3.5 text-primary" />
          {label}
        </p>
        <p className="mt-0.5 font-display text-2xl font-bold leading-none tabular">{value}</p>
        <p className="mt-1 flex items-center gap-1.5 truncate text-[11px] text-muted-foreground">
          {delta && (
            <span className={cn("inline-flex items-center font-medium", deltaGood === true ? "text-good-ink" : deltaGood === false ? "text-bad-ink" : "")}>
              {deltaGood === true ? <ArrowUpRight className="size-3" /> : deltaGood === false ? <ArrowDownRight className="size-3" /> : null}
              {delta}
            </span>
          )}
          {sub && <span className="truncate">{sub}</span>}
        </p>
      </div>
      {spark}
    </div>
  );
}

const CAT_ICON = { Performance: TrendingDown, Participation: Users, Missions: Target, Cost: CircleAlert, Data: Database, "Responsible gaming": HeartPulse } as const;

/** At most three exceptions worth acting on, each one click from its evidence. */
export function NeedsAttention({ insights }: { insights: Insight[] }) {
  const open = useOpenLink();
  // One per kind of issue first, so three near-identical items don't crowd out the rest.
  const flagged = insights.filter((i) => i.tone === "bad" || i.tone === "warn");
  const seen = new Set<string>();
  const distinct = flagged.filter((i) => (seen.has(i.category) ? false : (seen.add(i.category), true)));
  const items = [...distinct, ...flagged.filter((i) => !distinct.includes(i))].slice(0, 3);
  return (
    <section className="panel min-w-0 px-3 py-2.5">
      <div className="mb-1 flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold">
          <AlertTriangle className="size-3.5 text-accent" /> Needs attention
        </h3>
        <Link to="/explore" search={{ tab: "alerts" }} className="text-[11px] text-primary hover:underline">
          All insights ({insights.length})
        </Link>
      </div>
      {items.length ? (
        <ul>
          {items.map((i) => {
            const Icon = CAT_ICON[i.category] ?? CircleAlert;
            return (
              <li key={i.id}>
                <button onClick={() => open(i.link)} title={`${i.basis}${i.action ? ` · Next: ${i.action}` : ""}`} className="-mx-1.5 flex w-[calc(100%+0.75rem)] items-center gap-2 rounded-md px-1.5 py-1 text-left hover:bg-surface-raised">
                  <Icon className={cn("size-3.5 shrink-0", i.tone === "bad" ? "text-bad-ink" : "text-accent")} />
                  <span className="min-w-0 flex-1 truncate text-xs">{i.title}</span>
                  <span className="shrink-0 text-[11px] font-medium tabular text-muted-foreground">{i.metric}</span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="py-2 text-xs text-muted-foreground">Nothing flagged in this view.</p>
      )}
    </section>
  );
}

interface Highlight {
  key: string;
  label: string;
  icon: typeof Users;
  m: PromoMetrics;
  value: string;
  tone: "good" | "bad" | "neutral";
  tab?: string;
  day?: number;
}

/** Biggest increase / decline, highest participation and contribution, weakest mission day — from the promos in view. */
export function highlights(list: PromoMetrics[], cur: string): Highlight[] {
  const done = list.filter((m) => m.status === "complete" || m.status === "measuring");
  const top = (f: (m: PromoMetrics) => number | null, dir = -1) =>
    done.filter((m) => f(m) != null).sort((a, b) => (f(a)! - f(b)!) * dir)[0];
  const out: Highlight[] = [];
  const up = top((m) => m.duringVsBefore);
  if (up && up.duringVsBefore! > 0) out.push({ key: "up", label: "Top GGR change", icon: TrendingUp, m: up, value: pct(up.duringVsBefore), tone: "good" });
  const down = top((m) => m.duringVsBefore, 1);
  if (down && down !== up)
    out.push({ key: "down", label: down.duringVsBefore! < 0 ? "Biggest decline" : "Lowest GGR change", icon: TrendingDown, m: down, value: pct(down.duringVsBefore), tone: down.duringVsBefore! < 0 ? "bad" : "neutral" });
  const part = top((m) => m.participationRate);
  if (part) out.push({ key: "part", label: "Top participation", icon: Users, m: part, value: pctPlain(part.participationRate, 1), tone: "neutral", tab: "players" });
  const cost = top((m) => m.promo.prizePool);
  if (cost) out.push({ key: "cost", label: "Top contribution", icon: Coins, m: cost, value: money(cost.promo.prizePool, cur), tone: "neutral", tab: "financials" });
  const low = done
    .filter((m) => m.missionDays?.leastCompleted)
    .sort((a, b) => a.missionDays!.leastCompleted!.rate - b.missionDays!.leastCompleted!.rate)[0];
  if (low && low.missionDays!.leastCompleted!.rate < 0.6)
    out.push({
      key: "missions",
      label: "Low completion",
      icon: Target,
      m: low,
      value: `${pctPlain(low.missionDays!.leastCompleted!.rate)} · Day ${low.missionDays!.leastCompleted!.day}`,
      tone: "bad",
      tab: "missions",
      day: low.missionDays!.leastCompleted!.day,
    });
  return out;
}

export function Highlights({ list, currency }: { list: PromoMetrics[]; currency: string }) {
  const navigate = useNavigate();
  const items = highlights(list, currency);
  if (!items.length) return <section className="panel px-3 py-2.5 text-xs text-muted-foreground">Highlights appear once promos in view have results.</section>;
  return (
    <section className="grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
      {items.map((h) => {
        const Icon = h.icon;
        return (
          <button
            key={h.key}
            onClick={() => navigate({ to: "/promo/$promoId", params: { promoId: h.m.promo.id }, search: { tab: h.tab, day: h.day } })}
            className="panel min-w-0 px-2.5 py-2 text-left transition-colors hover:border-primary/50"
            title={`${h.m.promo.name} · ${h.m.promo.operator}`}
          >
            <p className="flex items-center gap-1 truncate text-[10px] uppercase tracking-wide text-muted-foreground">
              <Icon className="size-3 shrink-0" />
              {h.label}
            </p>
            <p className={cn("mt-0.5 text-base font-bold tabular", h.tone === "good" ? "text-good-ink" : h.tone === "bad" ? "text-bad-ink" : "")}>{h.value}</p>
            <p className="truncate text-[11px] text-muted-foreground">{h.m.promo.name}</p>
          </button>
        );
      })}
    </section>
  );
}
