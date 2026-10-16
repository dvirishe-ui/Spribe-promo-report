import { useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, BarChart3, ChevronLeft, ChevronRight, Inbox, Layers, Pencil, Repeat, TrendingUp, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { EmptyState, LiveBadge, ResultPill, StatCard, Delta } from "@/components/report/bits";
import { PromoSummary } from "@/components/report/PromoSummary";
import { PromoEditor } from "@/components/report/PromoEditor";
import { GroupedColumns } from "@/components/charts/GroupedColumns";
import { MonthColumns } from "@/components/charts/MonthColumns";
import { PHASES } from "@/components/charts/core";
import { useData } from "@/lib/store";
import { aggregate, monthRows, type PromoMetrics } from "@/lib/metrics";
import { formatRange, monthLabel, monthRange, nextMonth, prevMonth, todayIso } from "@/lib/dates";
import { money, moneyFull, pct } from "@/lib/format";

export function DashboardPage() {
  const { dataset, metrics, status, editable } = useData();
  const navigate = useNavigate();
  const cur = dataset.currency;

  // Month axis covering every promo and monthly total.
  const allMonths = useMemo(() => {
    const ms = [...dataset.monthly.map((m) => m.month), ...metrics.map((m) => m.month)].sort();
    return ms.length ? monthRange(ms[0], ms[ms.length - 1]) : [];
  }, [dataset.monthly, metrics]);
  // Open on the latest month that has finished promos (falls back to the latest month with any promo).
  const startMonth =
    [...metrics].filter((m) => m.status === "complete").sort((a, b) => b.month.localeCompare(a.month))[0]?.month ??
    [...metrics].sort((a, b) => b.month.localeCompare(a.month))[0]?.month;

  const [view, setView] = useState<"month" | "all">("month");
  const [month, setMonth] = useState<string>(() => startMonth ?? todayIso().slice(0, 7));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const shown = view === "all" ? metrics : metrics.filter((m) => m.month === month);
  const prevShown = view === "month" ? metrics.filter((m) => m.month === prevMonth(month)) : [];
  const agg = aggregate(shown);
  const rows = monthRows(allMonths, dataset.monthly, metrics);
  const monthRow = view === "month" ? rows.find((r) => r.month === month) : [...rows].reverse().find((r) => r.ggr != null);
  const sorted = [...shown].sort((a, b) => b.promo.startDate.localeCompare(a.promo.startDate));
  const selected = metrics.find((m) => m.promo.id === selectedId) ?? null;
  const editing = dataset.promos.find((p) => p.id === editingId) ?? null;

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
            <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">
              How each promotion changed GGR — before, during and after.
            </p>
          </div>
          <Button asChild>
            <Link to="/data">
              <Pencil className="size-4" /> Enter numbers
            </Link>
          </Button>
        </div>

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
            <h2 className="ml-1 font-display text-xl font-semibold">{view === "month" ? monthLabel(month, "long") : "All months"}</h2>
            <span className="text-xs text-muted-foreground">
              {shown.length} promo{shown.length === 1 ? "" : "s"}
            </span>
          </div>
          <Tabs value={view} onValueChange={(v) => setView(v as "month" | "all")}>
            <TabsList>
              <TabsTrigger value="month">Month</TabsTrigger>
              <TabsTrigger value="all">All</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            icon={Layers}
            label="Promos"
            value={shown.length}
            hint={view === "month" ? `${prevShown.length} the month before` : `across ${new Set(metrics.map((m) => m.month)).size} months`}
          />
          <StatCard
            icon={TrendingUp}
            label="During vs before"
            value={<span className={agg.duringVsBefore != null && agg.duringVsBefore < 0 ? "text-bad-ink" : ""}>{pct(agg.duringVsBefore)}</span>}
            hint="GGR while the promos ran"
          />
          <StatCard icon={Repeat} label="After vs before" value={pct(agg.afterVsBefore)} hint="GGR once they ended" />
          <StatCard
            icon={Wallet}
            label={monthRow ? `GGR ${monthLabel(monthRow.month)}` : "Monthly GGR"}
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

        <div className="grid gap-4 lg:grid-cols-5">
          <section className="panel min-w-0 p-4 sm:p-5 lg:col-span-3">
            <h3 className="font-display text-base font-semibold">GGR before, during and after</h3>
            <p className="mb-4 mt-0.5 text-xs text-muted-foreground">
              {view === "month" ? "Each promo this month. Click a promo to see its report." : "All promos, added up by the month they started."}
            </p>
            {shown.length ? (
              <BeforeDuringAfter list={shown} byMonth={view === "all"} currency={cur} onSelect={setSelectedId} onMonth={(m) => (setMonth(m), setView("month"))} />
            ) : (
              <EmptyState icon={BarChart3} title={`No promos in ${monthLabel(month, "long")}`}>
                Use the arrows to go to another month.
              </EmptyState>
            )}
          </section>
          <section className="panel min-w-0 p-4 sm:p-5 lg:col-span-2">
            <h3 className="font-display text-base font-semibold">Total GGR by month</h3>
            <p className="mb-4 mt-0.5 text-xs text-muted-foreground">Hover a month for the change and number of promos.</p>
            <MonthColumns
              data={rows.slice(-8).map((r) => ({
                month: r.month,
                value: r.ggr,
                extra: [
                  { label: "vs previous month", value: pct(r.momChange) },
                  { label: "Promos", value: String(r.promoCount) },
                ],
              }))}
              valueName="Total GGR"
              format={(v) => money(v, cur)}
              formatFull={(v) => moneyFull(v, cur)}
              highlight={view === "month" ? month : null}
              label={(d) => money(d.value, cur)}
              onSelect={(m) => (setMonth(m), setView("month"))}
              height={230}
            />
          </section>
        </div>

        <PromoList list={sorted} currency={cur} onSelect={setSelectedId} />
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

function PromoList({ list, currency, onSelect }: { list: PromoMetrics[]; currency: string; onSelect: (id: string) => void }) {
  if (!list.length) return null;
  return (
    <section>
      <h3 className="mb-2 font-display text-base font-semibold">Promos</h3>
      <div className="panel divide-y divide-border overflow-hidden">
        {list.map((m) => {
          const up = (m.duringVsBefore ?? 0) >= 0;
          const stripe = m.duringVsBefore == null ? "var(--color-border)" : up ? "var(--good)" : "var(--bad)";
          return (
            <button
              key={m.promo.id}
              onClick={() => onSelect(m.promo.id)}
              className="flex w-full flex-col gap-3 px-4 py-3.5 text-left transition-colors hover:bg-surface-raised sm:flex-row sm:items-center sm:justify-between"
              style={{ borderLeft: `3px solid color-mix(in oklch, ${stripe} 70%, transparent)` }}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="truncate font-display text-sm font-semibold">{m.promo.name}</p>
                  <LiveBadge status={m.status} />
                </div>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {[m.promo.operator, m.promo.games.join(", "), formatRange(m.promo.startDate, m.promo.endDate)].filter(Boolean).join(" · ")}
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
                <ArrowRight className="hidden size-4 text-muted-foreground sm:block" />
              </div>
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">Numbers show GGR before → during → after. The % is during vs before.</p>
    </section>
  );
}
