import { useMemo, useState } from "react";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { toast } from "sonner";
import { ArrowRight, Copy, Download, Inbox, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { EmptyState, StatusBadge } from "@/components/report/bits";
import { InsightCard } from "@/components/report/InsightCard";
import { OutcomeChip } from "@/components/report/ResultHero";
import { FilterLayout, PageHeader, defaultMonth, periodName } from "@/components/report/ViewControls";
import { PromoTable } from "@/components/report/PromoTable";
import { ResultsTable } from "@/components/report/ResultsTable";
import { PromoList } from "@/components/report/PromoListing";
import { PromoChartCard } from "@/components/report/MetricCharts";
import { GgrTriptych } from "@/components/charts/GgrTriptych";
import { ComparisonView, SelectionChips } from "@/components/report/Comparison";
import { OutcomeStrip } from "@/components/report/Outcome";
import { useSelection } from "@/components/report/SelectionBar";
import { useData } from "@/lib/store";
import { useView, selectPeriod } from "@/lib/view";
import { buildInsights, type Insight } from "@/lib/insights";
import { isMissionType, isRankingType, median, type PromoMetrics } from "@/lib/metrics";
import { formatRange, todayIso, addDays, daysBetween } from "@/lib/dates";
import { marketLabel } from "@/lib/markets";
import { multiple, num, pct, pctPlain } from "@/lib/format";
import { outcomeFor, type OutcomeTone } from "@/lib/verdict";
import { newId } from "@/lib/normalize";
import { resultsCsv } from "@/lib/export";
import { downloadText } from "@/lib/csv";
import { cn } from "@/lib/utils";

export type ExploreTab = "promotions" | "compare" | "rank" | "missions" | "library" | "alerts";
const TABS: Array<{ v: ExploreTab; label: string }> = [
  { v: "promotions", label: "Promotions" },
  { v: "compare", label: "Compare" },
  { v: "rank", label: "Rankings" },
  { v: "missions", label: "Missions" },
  { v: "library", label: "Library" },
  { v: "alerts", label: "Insights" },
];

/**
 * Level 2–3 — everything for working across promotions in one place: the full
 * promotion list and charts, comparisons, rankings, mission analysis, the
 * historical library and every insight. Filters at the top apply to all tabs;
 * the period applies to the promotion list.
 */
export function ExplorePage() {
  const search = useSearch({ from: "/explore" });
  const navigate = useNavigate();
  const tab: ExploreTab = TABS.some((t) => t.v === search.tab) ? (search.tab as ExploreTab) : "promotions";
  const { metrics, dataset, status, error } = useData();
  const { view } = useView();
  const month = view.month ?? defaultMonth(metrics);
  const { filtered, shown } = selectPeriod(metrics, view, month);
  const insights = buildInsights(filtered, dataset.promos, { syncError: status === "error" ? error : null, currency: dataset.currency });
  const label = periodName(view.mode, month, view.from, view.to);
  const periodTab = tab === "promotions";

  return (
    <main className="mx-auto max-w-[1600px] space-y-3 px-4 py-4 lg:px-8">
      <PageHeader title="Explore">
        <div className="flex h-8 max-w-full items-center gap-0.5 overflow-x-auto rounded-md border border-border bg-surface-raised p-0.5">
          {TABS.map((t) => (
            <button
              key={t.v}
              onClick={() => navigate({ to: "/explore", search: { tab: t.v === "promotions" ? undefined : t.v }, replace: true })}
              className={cn(
                "h-6 whitespace-nowrap rounded px-2.5 text-xs transition-colors",
                tab === t.v ? "bg-background font-medium text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
              {t.v === "alerts" && insights.length > 0 && <span className="ml-1 text-muted-foreground">{insights.length}</span>}
            </button>
          ))}
        </div>
      </PageHeader>
      {tab === "compare" ? (
        <CompareTab all={metrics} currency={dataset.currency} />
      ) : (
        <FilterLayout metrics={metrics} month={month} count={periodTab ? shown.length : filtered.length} hidePeriod={!periodTab}>
          {tab === "promotions" && <PromotionsTab shown={shown} label={label} currency={dataset.currency} />}
          {tab === "rank" && <Rank all={filtered} currency={dataset.currency} />}
          {tab === "missions" && <MissionAnalysis all={filtered} />}
          {tab === "library" && <Library all={filtered} currency={dataset.currency} />}
          {tab === "alerts" && <AllInsights insights={insights} />}
        </FilterLayout>
      )}
    </main>
  );
}

/* -------------------------------------------------------------- promotions */

function PromotionsTab({ shown, label, currency }: { shown: PromoMetrics[]; label: string; currency: string }) {
  const { view, set } = useView();
  const sel = useSelection();
  const navigate = useNavigate();
  const [pick, setPick] = useState<OutcomeTone | null>(null);
  const outcome = pick && shown.some((m) => outcomeFor(m, currency).tone === pick) ? pick : null;
  const list = outcome ? shown.filter((m) => outcomeFor(m, currency).tone === outcome) : shown;
  const openPromo = (id: string) => navigate({ to: "/promo/$promoId", params: { promoId: id } });
  if (!shown.length)
    return (
      <div className="panel">
        <EmptyState icon={Inbox} title={`No promotions in ${label}`}>
          Try another period or clear the filters.
        </EmptyState>
      </div>
    );
  const seg = (v: typeof view.layout, text: string) => (
    <button
      key={v}
      onClick={() => set({ layout: v })}
      className={cn("h-6 rounded px-2 text-xs transition-colors", view.layout === v ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
    >
      {text}
    </button>
  );
  return (
    <div className="space-y-3">
      <OutcomeStrip list={shown} currency={currency} active={outcome} onPick={(t) => setPick(outcome === t ? null : t)} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex h-7 items-center gap-0.5 rounded-md border border-border bg-surface-raised p-0.5">
          {seg("compact", "List")}
          {seg("table", "All metrics")}
          {seg("grouped", "Grouped")}
        </div>
        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => downloadText(`spribe-promotions-${label.replace(/\W+/g, "-")}.csv`, resultsCsv(list, currency))}>
          <Download className="size-3.5" /> CSV
        </Button>
      </div>
      {view.layout === "table" ? (
        <ResultsTable list={list} currency={currency} onSelect={openPromo} />
      ) : view.layout === "grouped" ? (
        <PromoList
          list={list}
          outcome={outcome}
          onClearOutcome={() => setPick(null)}
          currency={currency}
          group={view.group}
          sort={view.sort}
          onGroup={(g) => set({ group: g })}
          onSort={(s) => set({ sort: s })}
          onSelect={openPromo}
        />
      ) : (
        <PromoTable list={list} currency={currency} selected={sel.ids} onToggle={sel.toggle} onOpen={openPromo} limit={15} title={outcome ? "Promotions (filtered by result)" : "Promotions"} />
      )}
      <section className="panel min-w-0 p-3 sm:p-4">
        <PromoChartCard
          list={list}
          currency={currency}
          metricKey={view.promoChartMetric}
          onMetric={(k) => set({ promoChartMetric: k })}
          onSelect={openPromo}
          triptych={(toolbar) => (
            <GgrTriptych
              list={list}
              currency={currency}
              mode={view.ggrMode}
              onMode={(m) => set({ ggrMode: m })}
              selected={sel.ids}
              onToggle={sel.toggle}
              onOpen={openPromo}
              limit={12}
              toolbar={toolbar}
            />
          )}
        />
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ compare */

/**
 * Compare: a search box to add promos, the selection as chips, then the
 * comparison itself. Uses the same selection as the rest of the site, so
 * promos ticked on any page are already here.
 */
function CompareTab({ all, currency }: { all: PromoMetrics[]; currency: string }) {
  const sel = useSelection();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [focus, setFocus] = useState(false);
  const matches = all
    .filter((m) => m.status !== "upcoming" && !sel.ids.includes(m.promo.id))
    .filter((m) => !q || [m.promo.name, m.promo.operator, m.promo.market, m.promo.type].join(" ").toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => b.promo.startDate.localeCompare(a.promo.startDate))
    .slice(0, 8);
  const latest = all.filter((m) => m.status === "complete").sort((a, b) => b.promo.startDate.localeCompare(a.promo.startDate));
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-80">
          <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            className="h-8 w-full rounded-md border border-border bg-surface pl-7 pr-2 text-xs outline-none focus:ring-2 focus:ring-ring"
            placeholder="Add a promotion — search name, operator, market"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onFocus={() => setFocus(true)}
            onBlur={() => setTimeout(() => setFocus(false), 150)}
          />
          {focus && matches.length > 0 && (
            <div className="absolute left-0 right-0 top-9 z-20 rounded-md border border-border bg-popover p-1 shadow-lg">
              {matches.map((m) => (
                <button
                  key={m.promo.id}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    sel.toggle(m.promo.id);
                    setQ("");
                  }}
                  className="flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-surface-raised"
                >
                  <span className="truncate">{m.promo.name}</span>
                  <span className="shrink-0 text-[11px] text-muted-foreground">
                    {m.promo.operator} · {formatRange(m.promo.startDate, m.promo.endDate)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
        <SelectionChips list={sel.list} onRemove={sel.toggle} />
        {sel.list.length > 0 && (
          <button onClick={sel.clear} className="text-xs text-muted-foreground hover:text-foreground">
            Clear selection
          </button>
        )}
      </div>
      {sel.list.length < 2 ? (
        <div className="panel p-6 text-center text-sm text-muted-foreground">
          Add two or more promotions — or tick them in any list or chart.{" "}
          {latest.length >= 2 && (
            <button onClick={() => sel.set([...sel.ids, ...latest.slice(0, 3).map((m) => m.promo.id)])} className="text-primary hover:underline">
              Compare the latest three
            </button>
          )}
        </div>
      ) : (
        <ComparisonView list={sel.list} currency={currency} onOpen={(id) => navigate({ to: "/promo/$promoId", params: { promoId: id } })} />
      )}
    </div>
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
        <p className="text-xs text-muted-foreground">Most important first · metric, threshold and evidence link on each.</p>
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
          <p className="mt-0.5 text-xs text-muted-foreground">No single metric defines success — pick the one your question needs.</p>
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
        <p className="mt-0.5 text-xs text-muted-foreground">Under 50% completion, a 25+ pt drop, or unusually quick.</p>
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
  const { ids: selected, toggle } = useSelection();
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
              <Button variant="ghost" size="sm" onClick={() => toggle(m.promo.id)}>
                {selected.includes(m.promo.id) ? "✓ In comparison" : "Add to compare"}
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
