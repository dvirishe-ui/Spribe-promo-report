import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  ArrowRight,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  ClipboardCopy,
  Inbox,
  Layers,
  Pencil,
  Repeat,
  SlidersHorizontal,
  TrendingUp,
  Wallet,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Delta, EmptyState, LiveBadge, ResultPill, StatCard } from "@/components/report/bits";
import { PromoSummary } from "@/components/report/PromoSummary";
import { PromoEditor } from "@/components/report/PromoEditor";
import { ReportFilters, applyFilters, emptyFilters, filterCount, type FilterState } from "@/components/report/ReportFilters";
import { DIMENSION_LABEL, ResultsBy, displayKey, groupBy, type Dimension } from "@/components/report/ResultsBy";
import { GroupedColumns } from "@/components/charts/GroupedColumns";
import { MonthColumns } from "@/components/charts/MonthColumns";
import { PHASES } from "@/components/charts/core";
import { useData } from "@/lib/store";
import { aggregate, monthRows, type PromoMetrics } from "@/lib/metrics";
import { formatRange, monthLabel, monthRange, nextMonth, prevMonth, todayIso } from "@/lib/dates";
import { marketLabel } from "@/lib/markets";
import { money, moneyFull, pct } from "@/lib/format";
import { cn } from "@/lib/utils";

type SortKey = "newest" | "change" | "ggr" | "name";
type GroupKey = "none" | Dimension;

interface ViewPrefs {
  filters: FilterState;
  group: GroupKey;
  sort: SortKey;
}

const PREFS_KEY = "spribe-report-view-v1";

function loadPrefs(): ViewPrefs {
  try {
    const p = JSON.parse(localStorage.getItem(PREFS_KEY) ?? "null");
    if (p && p.filters) return { filters: { ...emptyFilters, ...p.filters }, group: p.group ?? "none", sort: p.sort ?? "newest" };
  } catch {
    // ignore — defaults below
  }
  return { filters: emptyFilters, group: "none", sort: "newest" };
}

export function DashboardPage() {
  const { dataset, metrics, status, editable } = useData();
  const cur = dataset.currency;

  const allMonths = useMemo(() => {
    const ms = [...dataset.monthly.map((m) => m.month), ...metrics.map((m) => m.month)].sort();
    return ms.length ? monthRange(ms[0], ms[ms.length - 1]) : [];
  }, [dataset.monthly, metrics]);
  // Open on the latest month that has finished promos.
  const startMonth =
    [...metrics].filter((m) => m.status === "complete").sort((a, b) => b.month.localeCompare(a.month))[0]?.month ??
    [...metrics].sort((a, b) => b.month.localeCompare(a.month))[0]?.month;

  const [view, setView] = useState<"month" | "all">("month");
  const [month, setMonth] = useState<string>(() => startMonth ?? todayIso().slice(0, 7));
  const [prefs, setPrefs] = useState<ViewPrefs>(loadPrefs);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    } catch {
      // remembering the view is a convenience only
    }
  }, [prefs]);

  const { filters } = prefs;
  const setFilters = (f: FilterState) => setPrefs((p) => ({ ...p, filters: f }));
  const filtered = applyFilters(metrics, filters);
  const shown = view === "all" ? filtered : filtered.filter((m) => m.month === month);
  const prevShown = view === "month" ? filtered.filter((m) => m.month === prevMonth(month)) : [];
  const agg = aggregate(shown);
  const rows = monthRows(allMonths, dataset.monthly, filtered);
  const monthRow = view === "month" ? rows.find((r) => r.month === month) : [...rows].reverse().find((r) => r.ggr != null);
  const selected = metrics.find((m) => m.promo.id === selectedId) ?? null;
  const editing = dataset.promos.find((p) => p.id === editingId) ?? null;
  const nFilters = filterCount(filters);
  const periodName = view === "month" ? monthLabel(month, "long") : "All months";

  const pickFilter = (d: Dimension, key: string) => setFilters({ ...filters, [d]: filters[d] === key ? "all" : key });

  const copySummary = async () => {
    const best = [...shown].filter((m) => m.duringVsBefore != null).sort((a, b) => b.duringVsBefore! - a.duringVsBefore!)[0];
    const markets = groupBy(shown, "market")
      .filter((g) => g.agg.duringVsBefore != null)
      .sort((a, b) => b.agg.duringVsBefore! - a.agg.duringVsBefore!)
      .map((g) => `${g.key} ${pct(g.agg.duringVsBefore)}`);
    const lines = [
      `SPRIBE promo report — ${periodName}${nFilters ? " (filtered)" : ""}`,
      `${shown.length} promo${shown.length === 1 ? "" : "s"}${view === "month" ? ` (${prevShown.length} the month before)` : ""}`,
      `GGR during vs before: ${pct(agg.duringVsBefore)} · after vs before: ${pct(agg.afterVsBefore)}`,
      monthRow?.ggr != null ? `Total GGR ${monthLabel(monthRow.month, "long")}: ${moneyFull(monthRow.ggr, cur)} (${pct(monthRow.momChange)} vs previous month)` : "",
      best ? `Best promo: ${best.promo.name} ${pct(best.duringVsBefore)}` : "",
      markets.length ? `By market: ${markets.join(", ")}` : "",
    ].filter(Boolean);
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      toast.success("Summary copied — paste it in Slack or an email");
    } catch {
      toast.error("Couldn't copy — your browser blocked the clipboard");
    }
  };

  if (!dataset.promos.length && !dataset.monthly.length) {
    return (
      <main className="mx-auto max-w-[1400px] px-4 py-12 lg:px-8">
        <div className="panel p-8">
          <EmptyState icon={Inbox} title={status === "loading" ? "Loading…" : "No promos yet"}>
            Add your first promo and its GGR numbers — the report builds itself from there.
            <div className="mt-5">
              <Button asChild>
                <Link to="/data">Enter numbers</Link>
              </Button>
            </div>
          </EmptyState>
        </div>
      </main>
    );
  }

  return (
    <>
      <main className="mx-auto max-w-[1400px] space-y-4 px-4 py-5 lg:px-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold sm:text-4xl">
              <span className="brand-gradient-text">Promo Reports</span>
            </h1>
            <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">How each promotion changed GGR — before, during and after.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={copySummary}>
              <ClipboardCopy className="size-4" /> Copy summary
            </Button>
            <Button asChild>
              <Link to="/data">
                <Pencil className="size-4" /> Enter numbers
              </Link>
            </Button>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[250px_1fr] lg:items-start">
          <aside className={cn("lg:sticky lg:top-20 lg:block", showFilters ? "block" : "hidden")}>
            <ReportFilters filters={filters} onChange={setFilters} all={metrics} />
          </aside>

          <div className="min-w-0 space-y-4">
            {/* Period */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                {view === "month" && (
                  <>
                    <Button variant="outline" size="icon" aria-label="Previous month" onClick={() => setMonth(prevMonth(month))}>
                      <ChevronLeft className="size-4" />
                    </Button>
                    <Button variant="outline" size="icon" aria-label="Next month" onClick={() => setMonth(nextMonth(month))}>
                      <ChevronRight className="size-4" />
                    </Button>
                  </>
                )}
                <h2 className="ml-1 font-display text-xl font-semibold">{periodName}</h2>
                <span className="text-xs text-muted-foreground">
                  {shown.length} promo{shown.length === 1 ? "" : "s"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="lg:hidden" onClick={() => setShowFilters((v) => !v)}>
                  <SlidersHorizontal className="size-3.5" /> Filters{nFilters ? ` (${nFilters})` : ""}
                </Button>
                <Tabs value={view} onValueChange={(v) => setView(v as "month" | "all")}>
                  <TabsList>
                    <TabsTrigger value="month">Month</TabsTrigger>
                    <TabsTrigger value="all">All</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </div>

            {nFilters > 0 && <ActiveFilters filters={filters} onChange={setFilters} />}

            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              <StatCard
                icon={Layers}
                label="Promos"
                value={shown.length}
                hint={view === "month" ? `${prevShown.length} the month before` : `across ${new Set(filtered.map((m) => m.month)).size} months`}
              />
              <StatCard
                icon={TrendingUp}
                label="During vs before"
                value={<span className={agg.duringVsBefore != null && agg.duringVsBefore < 0 ? "text-bad-ink" : ""}>{pct(agg.duringVsBefore)}</span>}
                hint={agg.positiveShare != null ? `${Math.round(agg.positiveShare * 100)}% of promos raised GGR` : "GGR while the promos ran"}
              />
              <StatCard icon={Repeat} label="After vs before" value={pct(agg.afterVsBefore)} hint="GGR once they ended" />
              <StatCard
                icon={Wallet}
                label={monthRow ? `Total GGR ${monthLabel(monthRow.month)}` : "Total GGR"}
                value={money(monthRow?.ggr, cur)}
                hint={
                  monthRow?.momChange != null ? (
                    <>
                      <Delta value={monthRow.momChange} className="text-xs" /> vs {monthLabel(prevMonth(monthRow.month), "long", false)}
                    </>
                  ) : (
                    "add monthly totals to compare"
                  )
                }
              />
            </div>

            <div className="grid gap-4 xl:grid-cols-5">
              <section className="panel min-w-0 p-4 sm:p-5 xl:col-span-3">
                <h3 className="font-display text-base font-semibold">GGR before, during and after</h3>
                <p className="mb-4 mt-0.5 text-xs text-muted-foreground">
                  {view === "month" ? "Each promo. Click one to see its report." : "All promos, added up by the month they started."}
                </p>
                {shown.length ? (
                  <BeforeDuringAfter
                    list={shown}
                    byMonth={view === "all"}
                    currency={cur}
                    onSelect={setSelectedId}
                    onMonth={(m) => (setMonth(m), setView("month"))}
                  />
                ) : (
                  <EmptyState icon={BarChart3} title={`No promos in ${periodName}${nFilters ? " for these filters" : ""}`}>
                    {nFilters ? "Try resetting the filters." : "Use the arrows to go to another month."}
                  </EmptyState>
                )}
              </section>
              <div className="xl:col-span-2">
                <ResultsBy list={shown} currency={cur} active={filters} onPick={pickFilter} />
              </div>
            </div>

            <section className="panel min-w-0 p-4 sm:p-5">
              <h3 className="font-display text-base font-semibold">Total GGR by month</h3>
              <p className="mb-3 mt-0.5 text-xs text-muted-foreground">All operators. Hover a month for the change and number of promos; click to open it.</p>
              <MonthColumns
                data={rows.slice(-12).map((r) => ({
                  month: r.month,
                  value: r.ggr,
                  extra: [
                    { label: "vs previous month", value: pct(r.momChange) },
                    { label: nFilters ? "Promos (filtered)" : "Promos", value: String(r.promoCount) },
                  ],
                }))}
                valueName="Total GGR"
                format={(v) => money(v, cur)}
                formatFull={(v) => moneyFull(v, cur)}
                highlight={view === "month" ? month : null}
                label={(d) => {
                  const r = rows.find((x) => x.month === d.month);
                  return `${money(d.value, cur)} ${pct(r?.momChange ?? null, 1)}`;
                }}
                onSelect={(m) => (setMonth(m), setView("month"))}
                height={200}
              />
            </section>

            <PromoList
              list={shown}
              currency={cur}
              group={prefs.group}
              sort={prefs.sort}
              onGroup={(g) => setPrefs((p) => ({ ...p, group: g }))}
              onSort={(s) => setPrefs((p) => ({ ...p, sort: s }))}
              onSelect={setSelectedId}
            />
          </div>
        </div>
      </main>

      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelectedId(null)}>
        <SheetContent aria-describedby={undefined} className="w-full overflow-y-auto border-border bg-background sm:max-w-xl">
          <SheetTitle className="sr-only">{selected?.promo.name ?? "Promo"}</SheetTitle>
          {selected && (
            <div className="px-5 pb-8 pt-6">
              <PromoSummary m={selected} currency={cur} />
              <div className="mt-6 flex flex-wrap gap-2">
                <Button variant="outline" asChild>
                  <Link to="/promo/$promoId" params={{ promoId: selected.promo.id }}>
                    Open full report <ArrowRight className="size-4" />
                  </Link>
                </Button>
                {editable && (
                  <Button variant="ghost" onClick={() => setEditingId(selected.promo.id)}>
                    <Pencil className="size-4" /> Edit numbers
                  </Button>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
      <PromoEditor promo={editing} open={!!editing} onOpenChange={(o) => !o && setEditingId(null)} />
    </>
  );
}

function ActiveFilters({ filters, onChange }: { filters: FilterState; onChange: (f: FilterState) => void }) {
  const chips: Array<{ key: keyof FilterState; label: string }> = [];
  if (filters.q.trim()) chips.push({ key: "q", label: `“${filters.q.trim()}”` });
  if (filters.market !== "all") chips.push({ key: "market", label: marketLabel(filters.market) });
  if (filters.aggregator !== "all") chips.push({ key: "aggregator", label: filters.aggregator });
  if (filters.operator !== "all") chips.push({ key: "operator", label: filters.operator });
  if (filters.type !== "all") chips.push({ key: "type", label: filters.type });
  if (filters.game !== "all") chips.push({ key: "game", label: filters.game });
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs text-muted-foreground">Showing only:</span>
      {chips.map((c) => (
        <button
          key={c.key}
          onClick={() => onChange({ ...filters, [c.key]: c.key === "q" ? "" : "all" })}
          className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-0.5 text-xs hover:bg-primary/20"
        >
          {c.label}
          <X className="size-3" />
        </button>
      ))}
      <button onClick={() => onChange(emptyFilters)} className="ml-1 text-xs text-muted-foreground hover:text-foreground hover:underline">
        Clear all
      </button>
    </div>
  );
}

function BeforeDuringAfter({
  list,
  byMonth,
  currency,
  onSelect,
  onMonth,
}: {
  list: PromoMetrics[];
  byMonth: boolean;
  currency: string;
  onSelect: (id: string) => void;
  onMonth: (m: string) => void;
}) {
  const series = PHASES.map((p) => ({ key: p.key, label: p.label, color: p.color }));
  if (byMonth) {
    const months = [...new Set(list.map((m) => m.month))].sort().slice(-8);
    return (
      <GroupedColumns
        series={series}
        categories={months.map((mo) => {
          const a = aggregate(list.filter((m) => m.month === mo));
          return {
            key: mo,
            label: monthLabel(mo, "short", false),
            values: { before: a.ggrBefore, during: a.ggrDuring, after: a.ggrAfter },
            extra: [
              { label: "Promos", value: String(a.count) },
              { label: "During vs before", value: pct(a.duringVsBefore) },
            ],
          };
        })}
        format={(v) => money(v, currency)}
        formatFull={(v) => moneyFull(v, currency)}
        onSelect={onMonth}
        height={250}
      />
    );
  }
  const top = [...list].sort((a, b) => (b.ggrDuring ?? 0) - (a.ggrDuring ?? 0)).slice(0, 8);
  return (
    <>
      <GroupedColumns
        series={series}
        categories={top
          .sort((a, b) => a.promo.startDate.localeCompare(b.promo.startDate))
          .map((m) => ({
            key: m.promo.id,
            label: m.promo.name,
            values: { before: m.ggrBefore, during: m.ggrDuring, after: m.ggrAfter },
            extra: [
              { label: "During vs before", value: pct(m.duringVsBefore) },
              { label: "After vs before", value: pct(m.afterVsBefore) },
            ],
          }))}
        format={(v) => money(v, currency)}
        formatFull={(v) => moneyFull(v, currency)}
        onSelect={onSelect}
        height={250}
      />
      {list.length > 8 && <p className="mt-2 text-xs text-muted-foreground">Showing the 8 biggest promos — all of them are in the list below.</p>}
    </>
  );
}

function sortList(list: PromoMetrics[], sort: SortKey): PromoMetrics[] {
  const out = [...list];
  if (sort === "newest") out.sort((a, b) => b.promo.startDate.localeCompare(a.promo.startDate));
  if (sort === "change") out.sort((a, b) => (b.duringVsBefore ?? -Infinity) - (a.duringVsBefore ?? -Infinity));
  if (sort === "ggr") out.sort((a, b) => (b.ggrDuring ?? -Infinity) - (a.ggrDuring ?? -Infinity));
  if (sort === "name") out.sort((a, b) => a.promo.name.localeCompare(b.promo.name));
  return out;
}

function PromoList({
  list,
  currency,
  group,
  sort,
  onGroup,
  onSort,
  onSelect,
}: {
  list: PromoMetrics[];
  currency: string;
  group: GroupKey;
  sort: SortKey;
  onGroup: (g: GroupKey) => void;
  onSort: (s: SortKey) => void;
  onSelect: (id: string) => void;
}) {
  const sections =
    group === "none"
      ? [{ key: "", items: sortList(list, sort), agg: null }]
      : groupBy(list, group)
          .sort((a, b) => b.agg.ggrDuring - a.agg.ggrDuring)
          .map((g) => ({ key: g.key, items: sortList(g.items, sort), agg: g.agg }));

  return (
    <section>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-display text-base font-semibold">Promos</h3>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-muted-foreground">Group by</span>
          <Select value={group} onValueChange={(v) => onGroup(v as GroupKey)}>
            <SelectTrigger className="h-8 w-36 text-xs" aria-label="Group by">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Nothing</SelectItem>
              {(Object.keys(DIMENSION_LABEL) as Dimension[]).map((d) => (
                <SelectItem key={d} value={d}>
                  {DIMENSION_LABEL[d]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-muted-foreground">Sort</span>
          <Select value={sort} onValueChange={(v) => onSort(v as SortKey)}>
            <SelectTrigger className="h-8 w-36 text-xs" aria-label="Sort by">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest first</SelectItem>
              <SelectItem value="change">Biggest change</SelectItem>
              <SelectItem value="ggr">Highest GGR</SelectItem>
              <SelectItem value="name">Name A–Z</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {list.length === 0 ? (
        <div className="panel p-8 text-center text-sm text-muted-foreground">No promos match.</div>
      ) : (
        <div className="space-y-3">
          {sections.map((s) => (
            <div key={s.key || "all"} className="panel overflow-hidden">
              {group !== "none" && s.agg && (
                <div className="flex items-center justify-between gap-3 border-b border-border bg-surface-raised/60 px-4 py-2">
                  <p className="text-sm font-semibold">
                    {displayKey(s.key, group)}{" "}
                    <span className="font-normal text-muted-foreground">
                      · {s.agg.count} promo{s.agg.count === 1 ? "" : "s"} · {money(s.agg.ggrDuring, currency)} during
                    </span>
                  </p>
                  <ResultPill value={s.agg.duringVsBefore} />
                </div>
              )}
              <div className="divide-y divide-border">
                {s.items.map((m) => (
                  <PromoRow key={m.promo.id} m={m} currency={currency} onSelect={onSelect} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      <p className="mt-2 text-xs text-muted-foreground">Numbers are GGR before → during → after. The % is during vs before.</p>
    </section>
  );
}

function PromoRow({ m, currency, onSelect }: { m: PromoMetrics; currency: string; onSelect: (id: string) => void }) {
  const p = m.promo;
  const stripe = m.duringVsBefore == null ? "var(--color-border)" : m.duringVsBefore >= 0 ? "var(--good)" : "var(--bad)";
  return (
    <button
      onClick={() => onSelect(p.id)}
      className="flex w-full flex-col gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-raised sm:flex-row sm:items-center sm:justify-between"
      style={{ borderLeft: `3px solid color-mix(in oklch, ${stripe} 70%, transparent)` }}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate font-display text-sm font-semibold">{p.name}</p>
          <span className="rounded-full border border-border px-2 py-px text-[10.5px] text-muted-foreground">{p.type}</span>
          <LiveBadge status={m.status} />
        </div>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {[p.market && marketLabel(p.market), p.operator, p.aggregator, formatRange(p.startDate, p.endDate)].filter(Boolean).join(" · ")}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-3 sm:gap-5">
        <div className="flex items-center gap-1.5 text-xs tabular text-muted-foreground">
          <span>{money(m.ggrBefore, currency)}</span>
          <ArrowRight className="size-3" />
          <span className="font-medium text-foreground">{money(m.ggrDuring, currency)}</span>
          <ArrowRight className="size-3" />
          <span>{money(m.ggrAfter, currency)}</span>
        </div>
        <ResultPill value={m.duringVsBefore} className="min-w-[4.5rem] justify-center" />
      </div>
    </button>
  );
}
