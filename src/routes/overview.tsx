import { useMemo } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { ClipboardCopy, Coins, Download, FileText, Inbox, Layers, Share2, TrendingUp, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChangePill, EmptyState, StatCard, StatusBadge } from "@/components/report/bits";
import { DataStatusPill } from "@/components/report/DataStatus";
import { InsightCard } from "@/components/report/InsightCard";
import { MenuItem, PeriodVerdict, PromoRow } from "@/components/report/PromoListing";
import { ResultsBy, type Dimension } from "@/components/report/ResultsBy";
import { FilterLayout, defaultMonth, periodName } from "@/components/report/ViewControls";
import { OutcomeChip } from "@/components/report/ResultHero";
import { MonthColumns } from "@/components/charts/MonthColumns";
import { DefinitionsDialog } from "@/components/report/DefinitionsDialog";
import { useData } from "@/lib/store";
import { useView, selectPeriod } from "@/lib/view";
import { aggregate, monthRows, type PromoMetrics } from "@/lib/metrics";
import { monthLabel, monthRange, prevMonth } from "@/lib/dates";
import { money, moneyFull, multiple, numCompact, pct } from "@/lib/format";
import { buildInsights, topInsights } from "@/lib/insights";
import { executiveSummary } from "@/lib/reports";
import { resultsCsv } from "@/lib/export";
import { downloadText } from "@/lib/csv";

/**
 * Level 1 — the 30-second view. Four numbers, what you need to know, the
 * trend, who did best and worst, and the latest promos. Everything else is
 * one click away.
 */
export function OverviewPage() {
  const { dataset, metrics, status, error } = useData();
  const { view, set } = useView();
  const navigate = useNavigate();
  const cur = dataset.currency;
  const month = view.month ?? defaultMonth(metrics);
  const { filtered, shown, previous } = selectPeriod(metrics, view, month);
  const agg = aggregate(shown);
  const label = periodName(view.mode, month, view.from, view.to);

  const allMonths = useMemo(() => {
    const ms = [...dataset.monthly.map((m) => m.month), ...metrics.map((m) => m.month)].sort();
    return ms.length ? monthRange(ms[0], ms[ms.length - 1]) : [];
  }, [dataset.monthly, metrics]);
  const rows = monthRows(allMonths, dataset.monthly, filtered).filter((r) => r.month <= new Date().toISOString().slice(0, 7));
  const monthRow = view.mode === "month" ? rows.find((r) => r.month === month) : [...rows].reverse().find((r) => r.ggr != null);

  const insights = buildInsights(shown, dataset.promos, { syncError: status === "error" ? error : null, currency: cur });
  const top3 = topInsights(insights);
  const ranked = shown.filter((m) => m.primaryChange != null && m.status !== "upcoming").sort((a, b) => b.primaryChange! - a.primaryChange!);
  const recent = [...shown].sort((a, b) => b.promo.startDate.localeCompare(a.promo.startDate)).slice(0, 5);
  const openPromo = (id: string) => navigate({ to: "/promo/$promoId", params: { promoId: id } });

  const copyExec = async () => {
    try {
      await navigator.clipboard.writeText(executiveSummary(shown, label, insights, cur));
      toast.success("Executive summary copied");
    } catch {
      toast.error("Couldn't copy — your browser blocked the clipboard");
    }
  };

  if (!metrics.length) {
    return (
      <main className="mx-auto max-w-[1400px] px-4 py-12 lg:px-8">
        <div className="panel p-8">
          <EmptyState icon={Inbox} title={status === "loading" ? "Loading promotions…" : "No promotions yet"}>
            {status === "error"
              ? `The data source returned an error: ${error}`
              : "Connect the Back Office or add promotions on the Data page — the overview builds itself from there."}
            <div className="mt-5">
              <Button asChild>
                <Link to="/data">Go to Data</Link>
              </Button>
            </div>
          </EmptyState>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-[1400px] space-y-4 px-4 py-5 lg:px-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold sm:text-4xl">
            <span className="brand-gradient-text">Overview</span>
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">How SPRIBE promotions are performing — what worked, what didn't, what needs attention.</p>
          <DataStatusPill className="mt-2" />
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline">
              <Share2 className="size-4" /> Export
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-64 p-1.5">
            <MenuItem icon={ClipboardCopy} label="Copy executive summary" hint="Short text for email or Slack" onClick={copyExec} />
            <MenuItem
              icon={FileText}
              label="Download executive summary"
              hint="Text file, same numbers as on screen"
              onClick={() => downloadText(`spribe-executive-summary-${label.replace(/\W+/g, "-")}.txt`, executiveSummary(shown, label, insights, cur), "text/plain")}
            />
            <MenuItem icon={Download} label="Download results (CSV)" hint={`${shown.length} promos in this view`} onClick={() => downloadText(`spribe-promo-results-${label.replace(/\W+/g, "-")}.csv`, resultsCsv(shown, cur))} />
          </PopoverContent>
        </Popover>
      </div>

      <FilterLayout metrics={metrics} month={month} count={shown.length}>
        {shown.length === 0 ? (
          <div className="panel">
            <EmptyState icon={Inbox} title={`No promotions in ${label}`}>
              Try another period or clear the filters.
            </EmptyState>
          </div>
        ) : (
          <>
            <PeriodVerdict list={shown} currency={cur} period={label} active={null} onPick={() => navigate({ to: "/promotions" })} />

            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              <StatCard
                icon={Layers}
                label="Promotions"
                value={shown.length}
                hint={previous ? `${previous.length} the month before` : `${shown.filter((m) => m.status === "live").length} live now`}
                info="Promotions that started in this period."
              />
              <StatCard
                icon={TrendingUp}
                label="GGR vs baseline"
                value={<span className={agg.duringVsBefore != null && agg.duringVsBefore < 0 ? "text-bad-ink" : ""}>{pct(agg.duringVsBefore)}</span>}
                hint={agg.adjustedCount > 0 ? `${pct(agg.adjustedChange)} with market trend removed (${agg.adjustedCount} promos)` : "during vs before · not adjusted"}
                info="GGR per day during the promos vs the same number of days before (the baseline), weighted by baseline size. Observed, not proof of cause."
              />
              <StatCard
                icon={Users}
                label="Players took part"
                value={agg.withParticipants ? numCompact(agg.participants) : "—"}
                hint={agg.withParticipants ? `${agg.participants ? Math.round((agg.newParticipants / agg.participants) * 100) : 0}% new · ${agg.withParticipants} of ${shown.length} promos report it` : "not reported yet"}
                info="Unique participants per promo, added up (a player in two promos counts twice)."
              />
              <StatCard
                icon={Coins}
                label="Promo contribution"
                value={agg.withCost ? money(agg.cost, cur) : "—"}
                hint={agg.withCost ? (agg.roi != null ? `Promo ROI ${multiple(agg.roi + 1)} · extra GGR ${agg.netImpact + agg.cost >= 0 ? "+" : ""}${money(agg.netImpact + agg.cost, cur)}` : "prize fund / rewards paid") : "not reported yet"}
                info={`Prize fund contributed to the promos (prize pools, free bets, cashback), converted to ${cur} with the rates in Settings. Promo ROI (x) = extra GGR ÷ promo contribution.`}
              />
            </div>

            {agg.fxMissing > 0 && (
              <p className="rounded-md border border-bad/30 bg-bad/5 px-3 py-2 text-xs text-bad-ink">
                {agg.fxMissing} promo{agg.fxMissing === 1 ? " is" : "s are"} left out of money totals — no exchange rate for their currency. Add it in Data → Settings.
              </p>
            )}

            <section className="panel p-4 sm:p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="font-display text-base font-semibold">What you need to know</h3>
                <Link to="/insights" search={{ tab: "alerts" }} className="text-xs text-primary hover:underline">
                  All insights ({insights.length}) →
                </Link>
              </div>
              {top3.length ? (
                <div className="divide-y divide-border">
                  {top3.map((i) => (
                    <InsightCard key={i.id} insight={i} />
                  ))}
                </div>
              ) : (
                <p className="py-3 text-sm text-muted-foreground">Nothing stands out yet — insights appear once enough promos have data to compare.</p>
              )}
              <p className="mt-1 text-[11px] text-muted-foreground">
                Rule-based from {shown.length} promos ({agg.withData} with before and during GGR).{" "}
                <DefinitionsDialog>
                  <button className="text-primary hover:underline">How these are worked out</button>
                </DefinitionsDialog>
              </p>
            </section>

            <div className="grid gap-4 xl:grid-cols-5">
              <section className="panel min-w-0 p-4 sm:p-5 xl:col-span-3">
                <h3 className="font-display text-base font-semibold">GGR trend</h3>
                <p className="mb-3 mt-0.5 text-xs text-muted-foreground">
                  Total monthly GGR, all operators
                  {monthRow?.ggr != null && monthRow.momChange != null ? ` · ${monthLabel(monthRow.month, "long")} ${money(monthRow.ggr, cur)}, ${pct(monthRow.momChange)} vs ${monthLabel(prevMonth(monthRow.month), "long", false)}` : ""}.
                  Click a month to open it.
                </p>
                <MonthColumns
                  data={rows.slice(-12).map((r) => ({
                    month: r.month,
                    value: r.ggr,
                    extra: [
                      { label: "vs previous month", value: pct(r.momChange) },
                      { label: "Promos started", value: String(r.promoCount) },
                    ],
                  }))}
                  valueName="Total GGR"
                  format={(v) => money(v, cur)}
                  formatFull={(v) => moneyFull(v, cur)}
                  highlight={view.mode === "month" ? month : null}
                  label={(d) => money(d.value, cur)}
                  onSelect={(m) => set({ mode: "month", month: m })}
                  height={220}
                />
              </section>
              <section className="panel min-w-0 p-4 sm:p-5 xl:col-span-2">
                <h3 className="font-display text-base font-semibold">Top and bottom</h3>
                <p className="mb-2 mt-0.5 text-xs text-muted-foreground">By GGR change vs baseline. Other ways to rank are in Insights.</p>
                {ranked.length < 2 ? (
                  <p className="py-4 text-sm text-muted-foreground">Needs at least two promos with results.</p>
                ) : (
                  <div className="space-y-3">
                    <RankList title="Best" items={ranked.slice(0, Math.min(3, Math.ceil(ranked.length / 2)))} currency={cur} onOpen={openPromo} />
                    <RankList title="Weakest" items={ranked.slice(-Math.min(3, Math.floor(ranked.length / 2))).reverse()} currency={cur} onOpen={openPromo} />
                    <Link to="/insights" search={{ tab: "rank" }} className="inline-block text-xs text-primary hover:underline">
                      Rank by participation, completion, retention or cost →
                    </Link>
                  </div>
                )}
              </section>
            </div>

            <div className="grid gap-4 xl:grid-cols-5">
              <div className="min-w-0 xl:col-span-2">
                <ResultsBy
                  list={shown}
                  currency={cur}
                  active={view.filters}
                  onPick={(d: Dimension, key: string) => set({ filters: { ...view.filters, [d]: view.filters[d] === key ? "all" : key } })}
                />
              </div>
              <section className="min-w-0 xl:col-span-3">
                <div className="mb-2 flex items-baseline justify-between">
                  <h3 className="font-display text-base font-semibold">Recent promotions</h3>
                  <Link to="/promotions" className="text-xs text-primary hover:underline">
                    All {shown.length} promotions →
                  </Link>
                </div>
                <div className="panel divide-y divide-border overflow-hidden">
                  {recent.map((m) => (
                    <PromoRow key={m.promo.id} m={m} currency={cur} onSelect={openPromo} />
                  ))}
                </div>
              </section>
            </div>
          </>
        )}
      </FilterLayout>
    </main>
  );
}

function RankList({ title, items, currency, onOpen }: { title: string; items: PromoMetrics[]; currency: string; onOpen: (id: string) => void }) {
  return (
    <div>
      <p className="text-eyebrow mb-1">{title}</p>
      <ul>
        {items.map((m) => (
          <li key={m.promo.id}>
            <button
              onClick={() => onOpen(m.promo.id)}
              className="-mx-2 flex w-[calc(100%+1rem)] items-center justify-between gap-3 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-surface-raised"
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{m.promo.name}</span>
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="truncate">{m.promo.operator}</span>
                  {m.status === "complete" ? <OutcomeChip m={m} currency={currency} className="px-1.5 py-0 text-[10px]" /> : <StatusBadge status={m.status} className="px-1.5 py-0 text-[10px]" />}
                </span>
              </span>
              <ChangePill value={m.primaryChange} adjusted={m.isAdjusted} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

