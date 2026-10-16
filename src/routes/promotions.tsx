import { useNavigate } from "@tanstack/react-router";
import { BarChart3, Download, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/report/bits";
import { BeforeDuringAfter, PeriodVerdict, PromoList } from "@/components/report/PromoListing";
import { ResultsTable } from "@/components/report/ResultsTable";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FilterLayout, defaultMonth, periodName } from "@/components/report/ViewControls";
import { useData } from "@/lib/store";
import { useView, selectPeriod } from "@/lib/view";
import { outcomeFor, type OutcomeTone } from "@/lib/verdict";
import { resultsCsv } from "@/lib/export";
import { downloadText } from "@/lib/csv";
import { useState } from "react";

/** Level 2 — every promotion in the selected period, with grouping, sorting and the before/during/after chart. */
export function PromotionsPage() {
  const { dataset, metrics } = useData();
  const { view, set } = useView();
  const navigate = useNavigate();
  const cur = dataset.currency;
  const month = view.month ?? defaultMonth(metrics);
  const { shown } = selectPeriod(metrics, view, month);
  const label = periodName(view.mode, month, view.from, view.to);
  const [pick, setPick] = useState<OutcomeTone | null>(null);
  const outcome = pick && shown.some((m) => outcomeFor(m, cur).tone === pick) ? pick : null;
  const list = outcome ? shown.filter((m) => outcomeFor(m, cur).tone === outcome) : shown;
  const openPromo = (id: string) => navigate({ to: "/promo/$promoId", params: { promoId: id } });

  return (
    <main className="mx-auto max-w-[1400px] space-y-4 px-4 py-5 lg:px-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold sm:text-4xl">
            <span className="brand-gradient-text">Promotions</span>
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">Every promotion in the period with its results. Click one for its full report.</p>
        </div>
        <Button variant="outline" onClick={() => downloadText(`spribe-promotions-${label.replace(/\W+/g, "-")}.csv`, resultsCsv(shown, cur))}>
          <Download className="size-4" /> CSV
        </Button>
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
            <PeriodVerdict list={shown} currency={cur} period={label} active={outcome} onPick={(t) => setPick(outcome === t ? null : t)} />
            <section className="panel min-w-0 p-4 sm:p-5">
              <h3 className="font-display text-base font-semibold">GGR before, during and after</h3>
              <p className="mb-4 mt-0.5 text-xs text-muted-foreground">
                {view.mode === "month" ? "Each promo. Click one to open its report." : "Added up by the month promos started. Click a month to open it."}
              </p>
              {list.length ? (
                <BeforeDuringAfter list={list} byMonth={view.mode !== "month"} currency={cur} onSelect={openPromo} onMonth={(m) => set({ mode: "month", month: m })} />
              ) : (
                <EmptyState icon={BarChart3} title="No promos match" />
              )}
            </section>
            <div className={view.layout === "table" ? "flex flex-wrap items-center justify-between gap-3" : "-mb-2 flex justify-end"}>
              {view.layout === "table" && (
              <h3 className="font-display text-base font-semibold">
                {list.length} promotion{list.length === 1 ? "" : "s"}
                {outcome && (
                  <button onClick={() => setPick(null)} className="ml-2 text-xs font-normal text-primary hover:underline">
                    show all
                  </button>
                )}
              </h3>
              )}
              <Tabs value={view.layout} onValueChange={(v) => set({ layout: v as "table" | "list" })}>
                <TabsList>
                  <TabsTrigger value="table">Table</TabsTrigger>
                  <TabsTrigger value="list">List</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            {view.layout === "table" ? (
              <ResultsTable list={list} currency={cur} onSelect={openPromo} />
            ) : (
            <PromoList
              list={list}
              outcome={outcome}
              onClearOutcome={() => setPick(null)}
              currency={cur}
              group={view.group}
              sort={view.sort}
              onGroup={(g) => set({ group: g })}
              onSort={(s) => set({ sort: s })}
              onSelect={openPromo}
            />
            )}
          </>
        )}
      </FilterLayout>
    </main>
  );
}
