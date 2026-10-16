import { useMemo, useState } from "react";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { toast } from "sonner";
import { AlertTriangle, ArrowRight, Copy, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { ChangePill, EmptyState, StatusBadge } from "@/components/report/bits";
import { InsightCard } from "@/components/report/InsightCard";
import { OutcomeChip } from "@/components/report/ResultHero";
import { useData } from "@/lib/store";
import { buildInsights, type Insight } from "@/lib/insights";
import { isMissionType, isRankingType, median, type PromoMetrics } from "@/lib/metrics";
import { formatRange, todayIso, addDays, daysBetween } from "@/lib/dates";
import { marketLabel } from "@/lib/markets";
import { money, multiple, num, pct, pctPlain } from "@/lib/format";
import { outcomeFor, type OutcomeTone } from "@/lib/verdict";
import { newId } from "@/lib/normalize";
import { cn } from "@/lib/utils";

export type InsightsTab = "alerts" | "compare" | "rank" | "missions" | "library";

/** Level 2–3 — for investigating across promotions. */
export function InsightsPage() {
  const search = useSearch({ from: "/insights" });
  const navigate = useNavigate();
  const tab: InsightsTab = (search.tab as InsightsTab) ?? "alerts";
  const { metrics, dataset, status, error } = useData();
  const insights = buildInsights(metrics, dataset.promos, { syncError: status === "error" ? error : null, currency: dataset.currency });

  return (
    <main className="mx-auto max-w-[1400px] space-y-4 px-4 py-5 lg:px-8">
      <div>
        <h1 className="font-display text-3xl font-bold sm:text-4xl">
          <span className="brand-gradient-text">Insights</span>
        </h1>
        <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">Compare promotions, rank them on what matters to you, dig into missions and find past examples to reuse.</p>
      </div>
      <Tabs value={tab} onValueChange={(v) => navigate({ to: "/insights", search: { tab: v as InsightsTab, ids: search.ids }, replace: true })}>
        <TabsList className="h-10 max-w-full overflow-x-auto">
          <TabsTrigger value="alerts" className="h-8 px-3">All insights ({insights.length})</TabsTrigger>
          <TabsTrigger value="compare" className="h-8 px-3">Compare</TabsTrigger>
          <TabsTrigger value="rank" className="h-8 px-3">Winners & losers</TabsTrigger>
          <TabsTrigger value="missions" className="h-8 px-3">Missions</TabsTrigger>
          <TabsTrigger value="library" className="h-8 px-3">Library</TabsTrigger>
        </TabsList>
        <TabsContent value="alerts" className="mt-3">
          <AllInsights insights={insights} />
        </TabsContent>
        <TabsContent value="compare" className="mt-3">
          <Compare all={metrics} initial={search.ids?.split(",").filter(Boolean) ?? []} currency={dataset.currency} />
        </TabsContent>
        <TabsContent value="rank" className="mt-3">
          <Rank all={metrics} currency={dataset.currency} />
        </TabsContent>
        <TabsContent value="missions" className="mt-3">
          <MissionAnalysis all={metrics} />
        </TabsContent>
        <TabsContent value="library" className="mt-3">
          <Library all={metrics} currency={dataset.currency} />
        </TabsContent>
      </Tabs>
    </main>
  );
}

/* ------------------------------------------------------------ all insights */

function AllInsights({ insights }: { insights: Insight[] }) {
  const cats = [...new Set(insights.map((i) => i.category))];
  const [cat, setCat] = useState<string>("all");
  const shown = cat === "all" ? insights : insights.filter((i) => i.category === cat);
  return (
    <section className="panel p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">Most important first. Each one shows the metric that triggered it, the threshold, and a link to the evidence.</p>
        <div className="flex flex-wrap gap-1 text-xs">
          {["all", ...cats].map((c) => (
            <button key={c} onClick={() => setCat(c)} className={cn("rounded-full border px-2.5 py-1", cat === c ? "border-primary bg-primary/10" : "border-border text-muted-foreground hover:text-foreground")}>
              {c === "all" ? "All" : c}
            </button>
          ))}
        </div>
      </div>
      {shown.length ? (
        <div className="mt-2 divide-y divide-border">
          {shown.map((i) => (
            <InsightCard key={i.id} insight={i} />
          ))}
        </div>
      ) : (
        <p className="py-6 text-sm text-muted-foreground">Nothing flagged. Insights appear when a rule's threshold is crossed and there's enough data to compare.</p>
      )}
    </section>
  );
}

/* ----------------------------------------------------------------- compare */

function Picker({ all, selected, onToggle, max = 4 }: { all: PromoMetrics[]; selected: string[]; onToggle: (id: string) => void; max?: number }) {
  const [q, setQ] = useState("");
  const list = all
    .filter((m) => m.status !== "upcoming")
    .filter((m) => !q || [m.promo.name, m.promo.operator, m.promo.market, m.promo.type].join(" ").toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => b.promo.startDate.localeCompare(a.promo.startDate))
    .slice(0, 40);
  return (
    <div className="panel p-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input className="h-9 w-full rounded-md border border-border bg-surface-raised pl-8 pr-2 text-sm outline-none focus:ring-2 focus:ring-ring" placeholder="Find promotions to compare" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="mt-2 max-h-64 space-y-0.5 overflow-y-auto">
        {list.map((m) => {
          const on = selected.includes(m.promo.id);
          return (
            <label key={m.promo.id} className={cn("flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-surface-raised", !on && selected.length >= max && "opacity-50")}>
              <input type="checkbox" checked={on} disabled={!on && selected.length >= max} onChange={() => onToggle(m.promo.id)} className="accent-[var(--color-primary)]" />
              <span className="min-w-0 flex-1 truncate">{m.promo.name}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{m.promo.operator}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

/** Differences that make a side-by-side comparison less fair. Flags, not blockers. */
function comparability(list: PromoMetrics[]): string[] {
  const out: string[] = [];
  const set = (f: (m: PromoMetrics) => string) => new Set(list.map(f));
  if (set((m) => m.promo.market).size > 1) out.push("Different markets — player behaviour and seasonality differ.");
  if (set((m) => m.promo.type).size > 1) out.push("Different mechanics — they aim at different things.");
  const days = list.map((m) => m.promoDays);
  if (Math.max(...days) > Math.min(...days) * 1.5) out.push(`Different lengths (${Math.min(...days)}–${Math.max(...days)} days) — compared per day, but longer promos can fade.`);
  const pops = list.map((m) => m.participants).filter((v): v is number => v != null);
  if (pops.length > 1 && Math.max(...pops) > Math.min(...pops) * 3) out.push("Very different player numbers — percentages from small promos move more easily.");
  if (set((m) => String(m.isAdjusted)).size > 1) out.push("Some GGR changes are adjusted for the market trend, others aren't.");
  if (set((m) => m.promo.currency).size > 1) out.push("Different currencies — converted with the rates in Settings.");
  if (list.some((m) => m.status !== "complete")) out.push("Some results aren't final yet.");
  return out;
}

function Compare({ all, initial, currency }: { all: PromoMetrics[]; initial: string[]; currency: string }) {
  const [ids, setIds] = useState<string[]>(initial.length ? initial : all.filter((m) => m.status === "complete").sort((a, b) => b.promo.startDate.localeCompare(a.promo.startDate)).slice(0, 2).map((m) => m.promo.id));
  const list = ids.map((id) => all.find((m) => m.promo.id === id)).filter((m): m is PromoMetrics => !!m);
  const flags = list.length > 1 ? comparability(list) : [];
  const rows: Array<{ label: string; get: (m: PromoMetrics) => React.ReactNode }> = [
    { label: "Operator · market", get: (m) => `${m.promo.operator} · ${marketLabel(m.promo.market)}` },
    { label: "Type · games", get: (m) => `${m.promo.type} · ${m.promo.games.join(", ")}` },
    { label: "Dates", get: (m) => `${formatRange(m.promo.startDate, m.promo.endDate)} (${m.promoDays} d)` },
    { label: "GGR change vs baseline", get: (m) => <ChangePill value={m.primaryChange} adjusted={m.isAdjusted} /> },
    { label: "After it ended", get: (m) => pct(m.afterVsBefore) },
    { label: "Players took part", get: (m) => num(m.participants) },
    { label: "Part. rate", get: (m) => pctPlain(m.participationRate, 1) },
    { label: "Came back after", get: (m) => pctPlain(m.retentionRate) },
    { label: "Mission completion", get: (m) => pctPlain(m.missionDays?.overallRate ?? m.missions?.completionRate ?? null) },
    { label: "Promo contribution", get: (m) => money(m.promo.prizePool, currency) },
    { label: "Cost per participant", get: (m) => money(m.costPerParticipant, currency) },
    { label: "Promo ROI (x)", get: (m) => multiple(m.promoRoi) },
    { label: "Total wager", get: (m) => money(m.turnoverDuring, currency) },
    { label: "RTP", get: (m) => pctPlain(m.rtp, 2) },
  ];
  return (
    <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
      <Picker all={all} selected={ids} onToggle={(id) => setIds((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))} />
      <div className="min-w-0 space-y-3">
        {list.length < 2 ? (
          <div className="panel">
            <EmptyState icon={Search} title="Pick two to four promotions">
              Choose from the list to see them side by side.
            </EmptyState>
          </div>
        ) : (
          <>
            {flags.length > 0 && (
              <div className="rounded-lg border border-accent/40 bg-accent/10 p-3 text-sm">
                <p className="flex items-center gap-1.5 font-medium">
                  <AlertTriangle className="size-4 text-accent" /> Read with care
                </p>
                <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs text-muted-foreground">
                  {flags.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="panel overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="w-44 px-4 py-3" />
                    {list.map((m) => (
                      <th key={m.promo.id} className="px-3 py-3 text-left align-top font-normal">
                        <div className="flex items-start justify-between gap-2">
                          <Link to="/promo/$promoId" params={{ promoId: m.promo.id }} className="font-display font-semibold hover:text-primary">
                            {m.promo.name}
                          </Link>
                          <button aria-label="Remove" onClick={() => setIds((s) => s.filter((x) => x !== m.promo.id))} className="text-muted-foreground hover:text-foreground">
                            <X className="size-3.5" />
                          </button>
                        </div>
                        <div className="mt-1">{m.status === "complete" ? <OutcomeChip m={m} currency={currency} /> : <StatusBadge status={m.status} />}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map((r) => (
                    <tr key={r.label}>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground">{r.label}</td>
                      {list.map((m) => (
                        <td key={m.promo.id} className="px-3 py-2.5 tabular">
                          {r.get(m)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------- winners/losers */

const RANK_METRICS = {
  ggr: { label: "GGR growth", hint: "GGR change per day vs baseline", get: (m: PromoMetrics) => m.primaryChange, fmt: (v: number) => pct(v) },
  participation: { label: "Participation", hint: "share of active players who took part", get: (m: PromoMetrics) => m.participationRate, fmt: (v: number) => pctPlain(v) },
  completion: { label: "Completion", hint: "missions completed ÷ started", get: (m: PromoMetrics) => m.missionDays?.overallRate ?? m.missions?.completionRate ?? null, fmt: (v: number) => pctPlain(v) },
  retention: { label: "Retention", hint: "participants who played again after", get: (m: PromoMetrics) => m.retentionRate, fmt: (v: number) => pctPlain(v) },
  efficiency: {
    label: "Cost efficiency",
    hint: "extra GGR per 1 of promo contribution",
    get: (m: PromoMetrics) => m.promoRoi,
    fmt: (v: number) => multiple(v),
  },
} as const;
type RankKey = keyof typeof RANK_METRICS;

function Rank({ all, currency }: { all: PromoMetrics[]; currency: string }) {
  const [key, setKey] = useState<RankKey>("ggr");
  const navigate = useNavigate();
  const metric = RANK_METRICS[key];
  const done = all.filter((m) => m.status === "complete");
  const ranked = done.filter((m) => metric.get(m) != null).sort((a, b) => metric.get(b)! - metric.get(a)!);
  const med = median(ranked.map((m) => metric.get(m)!));
  return (
    <section className="panel p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-base font-semibold">Winners & losers</h3>
          <p className="mt-0.5 max-w-xl text-xs text-muted-foreground">
            Pick what “good” means for your question. No single metric is the definition of success — a promo can win on growth and lose on cost.
          </p>
        </div>
        <div className="flex flex-wrap gap-1">
          {(Object.keys(RANK_METRICS) as RankKey[]).map((k) => (
            <button key={k} onClick={() => setKey(k)} className={cn("rounded-full border px-3 py-1 text-xs", key === k ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:text-foreground")}>
              {RANK_METRICS[k].label}
            </button>
          ))}
        </div>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        {metric.label}: {metric.hint}. {ranked.length} of {done.length} completed promos have this metric{med != null ? `; median ${metric.fmt(med)}` : ""}.
        {ranked.length < 5 && " Small sample — treat the order as indicative."}
      </p>
      {ranked.length === 0 ? (
        <p className="py-6 text-sm text-muted-foreground">No completed promos report this yet.</p>
      ) : (
        <ol className="mt-3 divide-y divide-border">
          {ranked.map((m, i) => {
            const v = metric.get(m)!;
            const small = m.participants != null && m.participants < 1000;
            return (
              <li key={m.promo.id}>
                <button onClick={() => navigate({ to: "/promo/$promoId", params: { promoId: m.promo.id } })} className="grid w-full grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-3 px-1 py-2 text-left transition-colors hover:bg-surface-raised">
                  <span className="text-center font-display text-sm font-semibold text-muted-foreground">{i + 1}</span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{m.promo.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {m.promo.operator} · {m.promo.type} · {m.participants != null ? `${num(m.participants)} players` : "players n/a"}
                      {small && " · small sample"}
                    </span>
                  </span>
                  <span className={cn("text-right font-semibold tabular", med != null && (v >= med ? "text-good-ink" : "text-bad-ink"))}>
                    {metric.fmt(v)}
                    {key === "ggr" && <span className="ml-1 text-[10px] font-medium uppercase text-muted-foreground">{m.isAdjusted ? "adj." : "raw"}</span>}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      )}
      <p className="mt-2 text-[11px] text-muted-foreground">Green = above the median, red = below. {currency} for money figures.</p>
    </section>
  );
}

/* -------------------------------------------------------------- missions */

function MissionAnalysis({ all }: { all: PromoMetrics[] }) {
  const navigate = useNavigate();
  const withDays = all.filter((m) => m.missionDays);
  const rows = withDays.flatMap((m) => m.missionDays!.days.map((d) => ({ m, d, typical: m.missionDays!.typicalMinutes })));
  const flagged = rows
    .map((r) => {
      const flags: string[] = [];
      if (r.d.rate < 0.5) flags.push("low completion");
      if (r.d.rateChange != null && r.d.rateChange <= -0.25) flags.push("big drop-off");
      if (r.d.medianMinutes != null && r.typical != null && r.d.medianMinutes < r.typical * 0.25) flags.push("unusually quick");
      return { ...r, flags };
    })
    .filter((r) => r.flags.length)
    .sort((a, b) => a.d.rate - b.d.rate);

  const buckets = [
    { label: "Under 10 min", test: (v: number) => v < 10 },
    { label: "10–30 min", test: (v: number) => v >= 10 && v < 30 },
    { label: "30–60 min", test: (v: number) => v >= 30 && v < 60 },
    { label: "1–2 h", test: (v: number) => v >= 60 && v < 120 },
    { label: "2 h+", test: (v: number) => v >= 120 },
  ].map((b) => ({ ...b, n: rows.filter((r) => r.d.medianMinutes != null && b.test(r.d.medianMinutes)).length }));
  const maxB = Math.max(1, ...buckets.map((b) => b.n));

  const byGame = groupRate(rows, (r) => r.d.game);
  const byMarket = groupRate(rows, (r) => r.m.promo.market);

  if (!rows.length)
    return (
      <div className="panel">
        <EmptyState icon={Search} title="No daily mission data yet">
          Mission analysis needs per-day mission progress (started, completed, completion time). The Back Office contract includes it.
        </EmptyState>
      </div>
    );

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Based on {rows.length} mission days across {withDays.length} promotions. Completion = completed ÷ started that day.
      </p>
      <section className="panel p-4 sm:p-5">
        <h3 className="font-display text-base font-semibold">Missions worth a look</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">Low completion (under 50%), a drop of 25+ points from the day before, or completed in under a quarter of that promo's typical time.</p>
        {flagged.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">Nothing flagged.</p>
        ) : (
          <ul className="mt-2 divide-y divide-border">
            {flagged.slice(0, 12).map(({ m, d, flags }) => (
              <li key={m.promo.id + d.day}>
                <button
                  onClick={() => navigate({ to: "/promo/$promoId", params: { promoId: m.promo.id }, search: { tab: "missions", day: d.day } })}
                  className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-2 text-left transition-colors hover:bg-surface-raised sm:grid-cols-[minmax(0,1fr)_10rem_auto]"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">
                      Day {d.day}: {d.requirement}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {m.promo.name} · {m.promo.operator}
                    </span>
                  </span>
                  <span className="hidden flex-wrap gap-1 sm:flex">
                    {flags.map((f) => (
                      <span key={f} className="rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 text-[10px] font-medium">
                        {f}
                      </span>
                    ))}
                  </span>
                  <span className="flex items-center gap-2 text-right text-sm tabular">
                    <span className="font-semibold">{pctPlain(d.rate)}</span>
                    {d.medianMinutes != null && <span className="text-xs text-muted-foreground">{d.medianMinutes} min</span>}
                    <ArrowRight className="size-3.5 text-muted-foreground" />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
      <div className="grid gap-4 lg:grid-cols-3">
        <section className="panel p-4 sm:p-5">
          <h3 className="font-display text-base font-semibold">Completion time</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">Mission days by median time to complete</p>
          <div className="mt-3 space-y-2">
            {buckets.map((b) => (
              <div key={b.label} className="grid grid-cols-[5.5rem_1fr_2rem] items-center gap-2 text-sm">
                <span className="text-xs text-muted-foreground">{b.label}</span>
                <div className="h-2.5 overflow-hidden rounded-r-[4px] bg-surface-raised">
                  <div className="h-full rounded-r-[4px] bg-[var(--series-before)]" style={{ width: `${(b.n / maxB) * 100}%` }} />
                </div>
                <span className="text-right text-xs tabular">{b.n}</span>
              </div>
            ))}
          </div>
        </section>
        <RateList title="By game" rows={byGame} />
        <RateList title="By market" rows={byMarket} label={marketLabel} />
      </div>
    </div>
  );
}

function groupRate<T extends { d: { started: number; completed: number } }>(rows: T[], key: (r: T) => string) {
  const g = new Map<string, { s: number; c: number; n: number }>();
  for (const r of rows) {
    const k = key(r);
    const v = g.get(k) ?? { s: 0, c: 0, n: 0 };
    v.s += r.d.started;
    v.c += r.d.completed;
    v.n++;
    g.set(k, v);
  }
  return [...g.entries()].map(([k, v]) => ({ key: k, rate: v.c / v.s, n: v.n })).sort((a, b) => b.rate - a.rate);
}

function RateList({ title, rows, label = (s: string) => s }: { title: string; rows: Array<{ key: string; rate: number; n: number }>; label?: (s: string) => string }) {
  return (
    <section className="panel p-4 sm:p-5">
      <h3 className="font-display text-base font-semibold">{title}</h3>
      <p className="mt-0.5 text-xs text-muted-foreground">Completion across all mission days</p>
      <div className="mt-3 space-y-2">
        {rows.map((r) => (
          <div key={r.key} className="grid grid-cols-[minmax(0,7rem)_1fr_5rem] items-center gap-2 text-sm">
            <span className="truncate">{label(r.key)}</span>
            <div className="h-2.5 overflow-hidden rounded-r-[4px] bg-surface-raised">
              <div className="h-full rounded-r-[4px] bg-[var(--series-after)]" style={{ width: `${r.rate * 100}%` }} />
            </div>
            <span className="text-right text-xs tabular">
              {pctPlain(r.rate)} <span className="text-muted-foreground">n={r.n}</span>
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- library */

const DURATION: Record<string, (d: number) => boolean> = {
  "Up to 3 days": (d) => d <= 3,
  "4–7 days": (d) => d >= 4 && d <= 7,
  "8–14 days": (d) => d >= 8 && d <= 14,
  "15+ days": (d) => d >= 15,
};

function Library({ all, currency }: { all: PromoMetrics[]; currency: string }) {
  const { editable, savePromo, dataset } = useData();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [f, setF] = useState({ game: "all", market: "all", operator: "all", type: "all", duration: "all", mechanic: "all", result: "all" });
  const opts = useMemo(() => {
    const u = (xs: string[]) => [...new Set(xs.filter(Boolean))].sort();
    return {
      game: u(all.flatMap((m) => m.promo.games)),
      market: u(all.map((m) => m.promo.market)),
      operator: u(all.map((m) => m.promo.operator)),
      type: u(all.map((m) => m.promo.type)),
    };
  }, [all]);
  const results = all
    .filter((m) => m.status !== "upcoming")
    .filter((m) => {
      const p = m.promo;
      if (f.game !== "all" && !p.games.includes(f.game)) return false;
      if (f.market !== "all" && p.market !== f.market) return false;
      if (f.operator !== "all" && p.operator !== f.operator) return false;
      if (f.type !== "all" && p.type !== f.type) return false;
      if (f.duration !== "all" && !DURATION[f.duration](m.promoDays)) return false;
      if (f.mechanic === "missions" && !isMissionType(p.type)) return false;
      if (f.mechanic === "rankings" && !isRankingType(p.type)) return false;
      if (f.mechanic === "other" && (isMissionType(p.type) || isRankingType(p.type))) return false;
      if (f.result !== "all" && outcomeFor(m, currency).tone !== (f.result as OutcomeTone)) return false;
      const text = [p.name, p.notes, ...(p.missionDays ?? []).map((d) => d.requirement), ...(p.missions ?? []).map((s) => s.name)].join(" ").toLowerCase();
      return !q || text.includes(q.toLowerCase());
    })
    .sort((a, b) => b.promo.startDate.localeCompare(a.promo.startDate));

  const reuse = (m: PromoMetrics) => {
    const src = dataset.promos.find((p) => p.id === m.promo.id);
    if (!src) return;
    const days = daysBetween(src.startDate, src.endDate);
    const start = addDays(todayIso(), 14);
    savePromo({
      ...src,
      id: newId(),
      name: `${src.name} (reuse)`,
      startDate: start,
      endDate: addDays(start, days - 1),
      ggrBefore: null,
      ggrDuring: null,
      ggrAfter: null,
      playersBefore: null,
      playersDuring: null,
      playersAfter: null,
      participants: null,
      newParticipants: null,
      retainedParticipants: null,
      betsDuring: null,
      eligiblePlayers: null,
      turnoverBefore: null,
      turnoverDuring: null,
      turnoverAfter: null,
      controlGgrBefore: null,
      controlGgrDuring: null,
      daily: undefined,
      gameGgr: undefined,
      leaderboard: src.leaderboard?.map((b) => ({ ...b, winners: b.winners, prize: b.prize })),
      missions: src.missions?.map((s) => ({ ...s, reached: 0 })),
      missionDays: src.missionDays?.map((d) => ({ ...d, started: 0, completed: 0, medianMinutes: null })),
      notes: `Setup reused from ${src.name} (${formatRange(src.startDate, src.endDate)}). Dates are a placeholder — set the real ones.`,
    });
    toast.success("Setup copied as a new upcoming promo — set its dates on the Data page");
    navigate({ to: "/data" });
  };

  const F = (k: keyof typeof f, label: string, values: string[], display: (v: string) => string = (v) => v) => (
    <Select value={f[k]} onValueChange={(v) => setF({ ...f, [k]: v })}>
      <SelectTrigger className={cn("h-8 w-auto min-w-28 text-xs", f[k] !== "all" && "border-primary/60")} aria-label={label}>
        <span className="truncate">
          <span className="text-muted-foreground">{label}: </span>
          {f[k] === "all" ? "Any" : display(f[k])}
        </span>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">Any</SelectItem>
        {values.map((v) => (
          <SelectItem key={v} value={v}>
            {display(v)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  return (
    <section className="space-y-3">
      <div className="panel space-y-2 p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            className="h-9 w-full rounded-md border border-border bg-surface-raised pl-8 pr-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            placeholder="Search names, notes and mission requirements — e.g. “×50”, “cashback”"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {F("game", "Game", opts.game)}
          {F("market", "Market", opts.market, marketLabel)}
          {F("operator", "Operator", opts.operator)}
          {F("type", "Type", opts.type)}
          {F("duration", "Length", Object.keys(DURATION))}
          {F("mechanic", "Mechanic", ["missions", "rankings", "other"], (v) => ({ missions: "Missions", rankings: "Leaderboard / tournament", other: "Other" })[v] ?? v)}
          {F("result", "Result", ["good", "mixed", "neutral", "bad", "pending"], (v) => ({ good: "Raised GGR, paid back", mixed: "Didn't pay back", neutral: "No clear effect", bad: "GGR fell", pending: "Not final" })[v] ?? v)}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">{results.length} past promotions</p>
      <div className="grid gap-3 md:grid-cols-2">
        {results.map((m) => (
          <article key={m.promo.id} className="panel flex flex-col p-4 transition-shadow hover:shadow-glow">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <Link to="/promo/$promoId" params={{ promoId: m.promo.id }} className="font-display font-semibold hover:text-primary">
                  {m.promo.name}
                </Link>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {[m.promo.operator, marketLabel(m.promo.market), m.promo.type, `${m.promoDays} days`].join(" · ")}
                </p>
              </div>
              {m.status === "complete" ? <OutcomeChip m={m} currency={currency} /> : <StatusBadge status={m.status} />}
            </div>
            <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
              <div>
                <dt className="text-muted-foreground">GGR change</dt>
                <dd className="font-semibold tabular">{pct(m.primaryChange)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Took part</dt>
                <dd className="font-semibold tabular">{num(m.participants)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{m.missionDays || m.missions ? "Completion" : "Return"}</dt>
                <dd className="font-semibold tabular">
                  {m.missionDays || m.missions ? pctPlain(m.missionDays?.overallRate ?? m.missions?.completionRate ?? null) : multiple(m.promoRoi)}
                </dd>
              </div>
            </dl>
            <div className="mt-3 flex flex-wrap gap-1.5 border-t border-border pt-3">
              <Button asChild variant="ghost" size="sm">
                <Link to="/promo/$promoId" params={{ promoId: m.promo.id }}>
                  Open report
                </Link>
              </Button>
              <Button asChild variant="ghost" size="sm">
                <Link to="/insights" search={{ tab: "compare", ids: m.promo.id }}>
                  Compare
                </Link>
              </Button>
              {editable && (
                <Button variant="ghost" size="sm" onClick={() => reuse(m)}>
                  <Copy className="size-3.5" /> Reuse setup
                </Button>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
