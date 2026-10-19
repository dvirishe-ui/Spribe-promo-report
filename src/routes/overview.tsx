import { useMemo } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { ClipboardCopy, Coins, Download, FileText, Inbox, Layers, Share2, TrendingUp, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { EmptyState } from "@/components/report/bits";
import { DataStatusPill } from "@/components/report/DataStatus";
import { MenuItem } from "@/components/report/PromoListing";
import { ResultsBy, type Dimension } from "@/components/report/ResultsBy";
import { FilterLayout, PageHeader, defaultMonth, periodName } from "@/components/report/ViewControls";
import { TrendCard } from "@/components/report/MetricCharts";
import { PromoTable } from "@/components/report/PromoTable";
import { OutcomeStrip } from "@/components/report/Outcome";
import { Highlights, KpiTile, NeedsAttention, Sparkline } from "@/components/report/ExecWidgets";
import { useSelection } from "@/components/report/SelectionBar";
import { GgrTriptych } from "@/components/charts/GgrTriptych";
import { useData } from "@/lib/store";
import { useView, selectPeriod } from "@/lib/view";
import { aggregate, monthRows, type PromoMetrics } from "@/lib/metrics";
import { monthLabel, monthRange, prevMonth } from "@/lib/dates";
import { money, multiple, numCompact, pct } from "@/lib/format";
import { buildInsights } from "@/lib/insights";
import { toggleValue } from "@/lib/filters";
import { rollup } from "@/lib/rollup";
import { executiveSummary } from "@/lib/reports";
import { resultsCsv } from "@/lib/export";
import { downloadText } from "@/lib/csv";

/**
 * Level 1 — the 30-second view for the CCO: four numbers with their trend,
 * how many promos worked, what needs attention, the standout promos, then
 * the promotion list and the before/during/after charts. Everything deeper
 * is one click away (Explore, promo reports).
 */
export function OverviewPage() {
  const { dataset, metrics, status, error } = useData();
  const { view, set } = useView();
  const sel = useSelection();
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

  // Sparklines: the six months up to the one in view, from the same filters.
  const sparkMonths = useMemo(() => {
    const end = view.mode === "month" ? month : (allMonths.filter((m) => m <= new Date().toISOString().slice(0, 7)).pop() ?? month);
    const out = [end];
    while (out.length < 6) out.unshift(prevMonth(out[0]));
    return out;
  }, [view.mode, month, allMonths]);
  const byMonth = sparkMonths.map((mo) => filtered.filter((m) => m.month === mo));
  const spark = (f: (l: PromoMetrics[]) => number | null) => byMonth.map((l) => (l.length ? f(l) : null));
  const focus = sparkMonths.length - 1;

  const insights = buildInsights(shown, dataset.promos, { syncError: status === "error" ? error : null, currency: cur });
  const openPromo = (id: string) => navigate({ to: "/promo/$promoId", params: { promoId: id } });
  const prevAgg = previous ? aggregate(previous) : null;
  const prevName = monthLabel(prevMonth(month), "short", false);

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
      <main className="mx-auto max-w-[1600px] px-4 py-12 lg:px-8">
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

  const ptsDelta = (a: number | null, b: number | null | undefined) => (a == null || b == null ? null : `${a - b >= 0 ? "+" : "−"}${Math.abs((a - b) * 100).toFixed(1)} pts vs ${prevName}`);
  const pctDelta = (a: number, b: number | undefined) => (b == null || b <= 0 ? null : `${pct(a / b - 1, 0)} vs ${prevName}`);

  return (
    <main className="mx-auto max-w-[1600px] space-y-3 px-4 py-4 lg:px-8">
      <PageHeader title="Overview" after={<DataStatusPill />}>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 text-xs">
              <Share2 className="size-3.5" /> Export
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
      </PageHeader>

      <FilterLayout metrics={metrics} month={month} count={shown.length}>
        {shown.length === 0 ? (
          <div className="panel">
            <EmptyState icon={Inbox} title={`No promotions in ${label}`}>
              Try another period or clear the filters.
            </EmptyState>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
              <KpiTile
                icon={Layers}
                label="Promotions"
                value={shown.length}
                delta={previous ? `${shown.length - previous.length >= 0 ? "+" : ""}${shown.length - previous.length} vs ${prevName}` : null}
                deltaGood={null}
                sub={`${shown.filter((m) => m.status === "live").length} live`}
                info="Promotions that started in this period."
                spark={<Sparkline values={spark((l) => l.length)} focus={focus} />}
              />
              <KpiTile
                icon={TrendingUp}
                label="GGR change"
                value={<span className={agg.duringVsBefore != null && agg.duringVsBefore < 0 ? "text-bad-ink" : ""}>{pct(agg.duringVsBefore)}</span>}
                delta={ptsDelta(agg.duringVsBefore, prevAgg?.duringVsBefore)}
                deltaGood={prevAgg?.duringVsBefore == null || agg.duringVsBefore == null ? null : agg.duringVsBefore >= prevAgg.duringVsBefore}
                sub="during vs before · observed"
                info="GGR per day during the promos vs the same number of days before, weighted by each promo's baseline. Observed — not proof the promo caused it."
                spark={<Sparkline values={spark((l) => aggregate(l).duringVsBefore)} focus={focus} line />}
              />
              <KpiTile
                icon={Users}
                label="Participants"
                value={agg.withParticipants ? numCompact(agg.participants) : "—"}
                delta={prevAgg?.withParticipants ? pctDelta(agg.participants, prevAgg.participants) : null}
                deltaGood={null}
                sub={agg.withParticipants < shown.length ? `${agg.withParticipants}/${shown.length} report it` : undefined}
                info="Unique participants per promo, added up (a player in two promos counts twice)."
                spark={<Sparkline values={spark((l) => rollup(l).participants)} focus={focus} />}
              />
              <KpiTile
                icon={Coins}
                label="Promo contribution"
                value={agg.withCost ? money(agg.cost, cur) : "—"}
                delta={agg.roi != null ? `ROI ${multiple(agg.roi + 1)}` : null}
                deltaGood={agg.roi == null ? null : agg.roi + 1 >= 1}
                sub="extra GGR ÷ contribution"
                info={`Prize fund contributed to the promos, in ${cur}. Promo ROI (x) = extra GGR (during + after vs before) ÷ promo contribution; 1.0× = break-even.`}
                spark={<Sparkline values={spark((l) => rollup(l).contribution)} focus={focus} />}
              />
            </div>

            <OutcomeStrip list={shown} currency={cur} />

            {agg.fxMissing > 0 && (
              <p className="text-xs text-bad-ink">
                ⚠ {agg.fxMissing} promo{agg.fxMissing === 1 ? " is" : "s are"} left out of money totals — no exchange rate for their currency (Data → Settings).
              </p>
            )}

            <div className="grid gap-2 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
              <NeedsAttention insights={insights} />
              <Highlights list={shown} currency={cur} />
            </div>

            <PromoTable list={shown} currency={cur} selected={sel.ids} onToggle={sel.toggle} onOpen={openPromo} limit={8} />

            <section className="panel min-w-0 p-3 sm:p-4">
              <GgrTriptych list={shown} currency={cur} mode={view.ggrMode} onMode={(m) => set({ ggrMode: m })} selected={sel.ids} onToggle={sel.toggle} onOpen={openPromo} limit={8} />
            </section>

            <div className="grid gap-3 xl:grid-cols-5 xl:items-start">
              <section className="panel min-w-0 p-3 sm:p-4 xl:col-span-3">
                <TrendCard
                  rows={rows.slice(-12)}
                  promos={filtered}
                  currency={cur}
                  highlight={view.mode === "month" ? month : null}
                  metricKeys={view.trendMetrics}
                  onMetrics={(k) => set({ trendMetrics: k })}
                  onSelectMonth={(m) => set({ mode: "month", month: m })}
                />
              </section>
              <div className="min-w-0 xl:col-span-2">
                <ResultsBy list={shown} currency={cur} active={view.filters} onPick={(d: Dimension, key: string) => set({ filters: toggleValue(view.filters, d, key) })} />
              </div>
            </div>
          </>
        )}
      </FilterLayout>
    </main>
  );
}
