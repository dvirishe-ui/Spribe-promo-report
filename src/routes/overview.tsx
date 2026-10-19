import { useMemo } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { ClipboardCopy, Download, FileText, Inbox, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { EmptyState } from "@/components/report/bits";
import { DataStatusPill } from "@/components/report/DataStatus";
import { MenuItem } from "@/components/report/PromoListing";
import { FilterLayout, PageHeader, defaultMonth, periodName } from "@/components/report/ViewControls";
import { SummaryRow } from "@/components/report/SummaryRow";
import { PhaseComparison } from "@/components/report/PhaseComparison";
import { ResultsTable } from "@/components/report/ResultsTable";
import { useData } from "@/lib/store";
import { useView, selectPeriod } from "@/lib/view";
import { monthRows } from "@/lib/metrics";
import { monthRange } from "@/lib/dates";
import { buildInsights } from "@/lib/insights";
import { executiveSummary } from "@/lib/reports";
import { resultsCsv } from "@/lib/export";
import { downloadText } from "@/lib/csv";

/**
 * Promotion overview, laid out like the team's promo sheet: filters, one
 * summary row, the metrics comparison Before / During / After, and the
 * promotion details table. Deeper analysis lives in Explore and each promo's
 * report.
 */
export function OverviewPage() {
  const { dataset, metrics, status, error } = useData();
  const { view, set } = useView();
  const navigate = useNavigate();
  const cur = dataset.currency;
  const month = view.month ?? defaultMonth(metrics);
  const { filtered, shown } = selectPeriod(metrics, view, month);
  const label = periodName(view.mode, month, view.from, view.to);

  const allMonths = useMemo(() => {
    const ms = [...dataset.monthly.map((m) => m.month), ...metrics.map((m) => m.month)].sort();
    return ms.length ? monthRange(ms[0], ms[ms.length - 1]) : [];
  }, [dataset.monthly, metrics]);
  const momChange = view.mode === "month" ? (monthRows(allMonths, dataset.monthly, filtered).find((r) => r.month === month)?.momChange ?? null) : null;
  const openPromo = (id: string) => navigate({ to: "/promo/$promoId", params: { promoId: id } });

  const copyExec = async () => {
    try {
      const insights = buildInsights(shown, dataset.promos, { syncError: status === "error" ? error : null, currency: cur });
      await navigator.clipboard.writeText(executiveSummary(shown, label, insights, cur));
      toast.success("Summary copied");
    } catch {
      toast.error("Couldn't copy — your browser blocked the clipboard");
    }
  };

  if (!metrics.length) {
    return (
      <main className="mx-auto max-w-[1600px] px-4 py-12 lg:px-8">
        <div className="panel p-8">
          <EmptyState icon={Inbox} title={status === "loading" ? "Loading promotions…" : "No promotions yet"}>
            {status === "error" ? `The data source returned an error: ${error}` : "Connect the Back Office or add promotions on the Data page."}
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
    <main className="mx-auto max-w-[1600px] space-y-3 px-4 py-4 lg:px-8">
      <PageHeader title="Promotion Overview" after={<DataStatusPill />}>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 text-xs">
              <Share2 className="size-3.5" /> Export
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-64 p-1.5">
            <MenuItem icon={ClipboardCopy} label="Copy summary" hint="Short text for email or Slack" onClick={copyExec} />
            <MenuItem
              icon={FileText}
              label="Download summary"
              hint="Text file, same numbers as on screen"
              onClick={() => {
                const insights = buildInsights(shown, dataset.promos, { syncError: null, currency: cur });
                downloadText(`spribe-promo-summary-${label.replace(/\W+/g, "-")}.txt`, executiveSummary(shown, label, insights, cur), "text/plain");
              }}
            />
            <MenuItem icon={Download} label="Download details (CSV)" hint={`${shown.length} promos in this view`} onClick={() => downloadText(`spribe-promo-details-${label.replace(/\W+/g, "-")}.csv`, resultsCsv(shown, cur))} />
          </PopoverContent>
        </Popover>
      </PageHeader>

      <FilterLayout metrics={metrics} month={month} count={shown.length}>
        {shown.length === 0 ? (
          <div className="panel">
            <EmptyState icon={Inbox} title={`No promotions in ${label}`}>
              Try another month or clear the filters.
            </EmptyState>
          </div>
        ) : (
          <>
            <div>
              <h2 className="mb-1.5 text-sm font-semibold uppercase tracking-wide">Summary · {label}</h2>
              <SummaryRow list={shown} currency={cur} momChange={momChange} />
            </div>

            <PhaseComparison list={shown} currency={cur} value={view.phaseMetrics} onChange={(k) => set({ phaseMetrics: k })} />

            <div>
              <h2 className="mb-1.5 text-sm font-semibold uppercase tracking-wide">Promotion details</h2>
              <ResultsTable list={shown} currency={cur} onSelect={openPromo} />
            </div>
          </>
        )}
      </FilterLayout>
    </main>
  );
}
