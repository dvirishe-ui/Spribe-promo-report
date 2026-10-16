import { useState } from "react";
import { Link, useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { toast } from "sonner";
import { ArrowLeft, CalendarDays, ClipboardCopy, Download, FileText, Pencil, Presentation, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PromoEditor } from "@/components/report/PromoEditor";
import { StatusBadge } from "@/components/report/bits";
import { ResultHero } from "@/components/report/ResultHero";
import {
  FinancialsTab,
  MissionsTab,
  OverviewTab,
  PlayersTab,
  RankingsTab,
  availableTabs,
  summaryLines,
  type TabKey,
} from "@/components/report/ReportSections";
import { NotFoundPage } from "@/routes/not-found";
import { useData } from "@/lib/store";
import { formatRange } from "@/lib/dates";
import { moneyFull, pct, pctPlain } from "@/lib/format";
import { buildInsights } from "@/lib/insights";
import { engagementReport } from "@/lib/reports";
import { InsightCard } from "@/components/report/InsightCard";
import { marketLabel } from "@/lib/markets";
import { fxFactor } from "@/lib/fx";
import { resultsCsv } from "@/lib/export";
import { downloadText } from "@/lib/csv";
import { outcomeFor } from "@/lib/verdict";
import { campaignById } from "@/lib/campaigns";

export function PromoReportPage() {
  const { promoId } = useParams({ from: "/promo/$promoId" });
  const search = useSearch({ from: "/promo/$promoId" });
  const navigate = useNavigate();
  const { metrics, dataset, editable, hasSample, status, error } = useData();
  const [editing, setEditing] = useState(false);
  const tab = (search.tab as TabKey) ?? "overview";
  const day = search.day ?? null;
  const setTab = (t: TabKey) => navigate({ to: "/promo/$promoId", params: { promoId }, search: { tab: t === "overview" ? undefined : t }, replace: true });
  const setDay = (d: number | null) => navigate({ to: "/promo/$promoId", params: { promoId }, search: { tab: "missions", day: d ?? undefined }, replace: true });

  const m = metrics.find((x) => x.promo.id === promoId);
  if (!m) return <NotFoundPage />;
  const p = m.promo;
  const cur = dataset.currency;
  const tabs = availableTabs(m);
  const findings = buildInsights(metrics, dataset.promos, { syncError: status === "error" ? error : null, currency: cur }).filter((i) => i.promoId === p.id);
  const completion = m.missionDays?.overallRate ?? m.missions?.completionRate ?? null;
  const activeTab = tabs.some((t) => t.key === tab) ? tab : "overview";
  const fx = p.currency && p.currency !== cur ? fxFactor(p.currency, cur, dataset.fxRates ?? {}) : null;
  const fxNote = p.fxMissing
    ? `No exchange rate for ${p.currency} — money figures are hidden until one is added in Data → Settings.`
    : fx
      ? `Entered in ${p.currency}, shown in ${cur} at 1 ${p.currency} = ${fx.toPrecision(3)} ${cur} (rates in Data → Settings).`
      : null;

  const copySummary = async () => {
    const o = outcomeFor(m, cur);
    const text = [
      `${o.headline}.`,
      `${p.name} (${[p.operator, p.market, formatRange(p.startDate, p.endDate)].filter(Boolean).join(", ")})`,
      `GGR before ${moneyFull(m.ggrBefore, cur)} → during ${moneyFull(m.ggrDuring, cur)} → after ${moneyFull(m.ggrAfter, cur)}`,
      `GGR change ${pct(m.primaryChange)} (${m.isAdjusted ? "adjusted for market trend" : "before vs during, not adjusted"})`,
      ...summaryLines(m, cur),
    ].join("\n");
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Summary copied");
    } catch {
      toast.error("Couldn't copy — your browser blocked the clipboard");
    }
  };

  return (
    <main className="mx-auto max-w-[1200px] space-y-5 px-4 py-5 lg:px-8">
      <div className="no-print flex flex-wrap items-center justify-between gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link to="/promotions">
            <ArrowLeft className="size-4" /> All promotions
          </Link>
        </Button>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm">
            <Link to="/share/$promoId" params={{ promoId: p.id }}>
              <Presentation className="size-3.5" /> Partner view
            </Link>
          </Button>
          <Button variant="outline" size="sm" onClick={copySummary}>
            <ClipboardCopy className="size-3.5" /> Copy summary
          </Button>
          <Button variant="outline" size="sm" onClick={() => downloadText(`${p.name.replace(/[^\w-]+/g, "-")}-results.csv`, resultsCsv([m], cur))}>
            <Download className="size-3.5" /> CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => downloadText(`${p.name.replace(/[^\w-]+/g, "-")}-engagement-report.txt`, engagementReport(m, cur), "text/plain")}>
            <FileText className="size-3.5" /> Report
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="size-3.5" /> Print
          </Button>
          {editable && (
            <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
              <Pencil className="size-3.5" /> Edit
            </Button>
          )}
        </div>
      </div>

      <header>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={m.status} />
          {hasSample && p.id.startsWith("sample-") && (
            <span className="rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 text-[11px] font-medium text-accent">Demo data · fictional</span>
          )}
        </div>
        <h1 className="mt-2 font-display text-3xl font-bold">{p.name}</h1>
        <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
          {[p.type, p.market && marketLabel(p.market), p.operator, p.aggregator, p.games.join(", ")].filter(Boolean).map((t) => (
            <span key={t} className="rounded-full border border-border bg-surface px-2.5 py-0.5 text-muted-foreground">
              {t}
            </span>
          ))}
        </div>
        <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
          <CalendarDays className="size-3.5" />
          {formatRange(p.startDate, p.endDate)} · {m.promoDays} day{m.promoDays === 1 ? "" : "s"} · compared with {m.windowDays} days before and after
        </p>
        {campaignById(p.calendarId) && (
          <p className="no-print mt-1.5 text-xs text-muted-foreground">
            Part of the network campaign{" "}
            <Link
              to="/calendar"
              search={{ month: p.startDate.slice(0, 7), open: `c:${p.calendarId}` }}
              className="font-medium text-primary hover:underline"
            >
              {campaignById(p.calendarId)!.name}
            </Link>{" "}
            — see every operator's result on the calendar.
          </p>
        )}
      </header>

      <ResultHero m={m} currency={cur} />

      {(findings.length > 0 || completion != null || m.quality.missing.length > 0) && (
        <section className="panel p-4 sm:p-5">
          <h3 className="font-display text-base font-semibold">Key findings</h3>
          {completion != null && (
            <button onClick={() => setTab("missions")} className="mt-2 flex w-full items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-left text-sm transition-colors hover:border-primary/60">
              <span>
                Mission completion <strong className="font-semibold">{pctPlain(completion)}</strong>
                {m.missionDays?.biggestDrop && <span className="text-muted-foreground"> · biggest drop on Day {m.missionDays.biggestDrop.day}</span>}
              </span>
              <span className="text-xs font-medium text-primary">Investigate →</span>
            </button>
          )}
          {findings.length > 0 && (
            <div className="divide-y divide-border">
              {findings.slice(0, 3).map((i) => (
                <InsightCard key={i.id} insight={i} />
              ))}
            </div>
          )}
          {m.quality.missing.length > 0 && (
            <p className="mt-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Missing data:</span> {m.quality.missing.join(", ")} — those numbers are left out, not estimated.
            </p>
          )}
        </section>
      )}

      <div className="flex flex-wrap items-baseline justify-between gap-2 pt-4">
        <h2 className="font-display text-xl font-semibold">Details</h2>
        <p className="text-xs text-muted-foreground">For the full picture — players, {m.missions || m.missionDays ? "missions, " : m.leaderboard ? "rankings, " : ""}financials.</p>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setTab(v as TabKey)}>
        <TabsList className="no-print h-10 max-w-full overflow-x-auto">
          {tabs.map((t) => (
            <TabsTrigger key={t.key} value={t.key} className="h-8 px-4">
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="overview" className="mt-3">
          <OverviewTab m={m} currency={cur} all={metrics} />
        </TabsContent>
        <TabsContent value="players" className="mt-3">
          <PlayersTab m={m} />
        </TabsContent>
        {(m.missions || m.missionDays) && (
          <TabsContent value="missions" className="mt-3">
            <MissionsTab m={m} all={metrics} day={day} onDay={setDay} />
          </TabsContent>
        )}
        {m.leaderboard && (
          <TabsContent value="rankings" className="mt-3">
            <RankingsTab m={m} currency={cur} />
          </TabsContent>
        )}
        <TabsContent value="financials" className="mt-3">
          <FinancialsTab m={m} currency={cur} fxNote={fxNote} all={metrics} />
        </TabsContent>
      </Tabs>

      {fxNote && activeTab !== "financials" && <p className="text-[11px] text-muted-foreground">{fxNote}</p>}

      <PromoEditor promo={dataset.promos.find((x) => x.id === p.id) ?? null} open={editing} onOpenChange={setEditing} />
    </main>
  );
}
