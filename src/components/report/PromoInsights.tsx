import { useMemo, useState } from "react";
import { AlertTriangle, ChevronDown, Globe2, Info, Lightbulb, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buildPromoInsights, SEVERITY_LABEL, type PromoInsight, type Severity } from "@/lib/promo-insights";
import type { PromoMetrics } from "@/lib/metrics";
import type { MarketTrend } from "@/lib/types";
import { formatDay } from "@/lib/dates";
import { signed } from "@/lib/promo-insights/facts";
import { useData } from "@/lib/store";
import { newId } from "@/lib/normalize";
import { cn } from "@/lib/utils";
import { useConfirm } from "./Confirm";
import { MarketDataDialog } from "./MarketDataDialog";

const TONE: Record<Severity, { dot: string; pill: string }> = {
  positive: { dot: "bg-good", pill: "bg-good/12 text-good-ink" },
  mixed: { dot: "bg-accent", pill: "bg-accent/18 text-foreground" },
  negative: { dot: "bg-bad", pill: "bg-bad/12 text-bad-ink" },
  neutral: { dot: "bg-muted-foreground/60", pill: "bg-muted text-muted-foreground" },
};

function SeverityPill({ s }: { s: Severity }) {
  return (
    <span className={cn("inline-flex w-fit shrink-0 items-center sm:w-[5.5rem] gap-1.5 self-start rounded-full px-2 py-0.5 text-[11px] font-semibold", TONE[s].pill)}>
      <span className={cn("size-1.5 rounded-full", TONE[s].dot)} />
      {SEVERITY_LABEL[s]}
    </span>
  );
}

function InsightRow({ i }: { i: PromoInsight }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="flex flex-col gap-1.5 py-3 first:pt-0 sm:flex-row sm:gap-3">
      <SeverityPill s={i.severity} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">
          {i.title}
          {i.confidence === "indicative" && (
            <span title="Two different measures set side by side" className="ml-2 rounded-full border border-border px-1.5 py-px align-middle text-[10px] font-medium text-muted-foreground">
              Indicative
            </span>
          )}
        </p>
        <p className="mt-0.5 text-sm text-foreground/90">{i.message}</p>
        {i.interpretation && <p className="mt-0.5 text-xs text-muted-foreground">{i.interpretation}</p>}
        <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="press mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
          Why? · Show calculation
          <ChevronDown className={cn("size-3.5 transition-transform duration-200", open && "rotate-180")} />
        </button>
        {open && (
          <div className="mt-2 space-y-3 rounded-lg border border-border bg-surface-raised/50 p-3 text-xs">
            <p>
              <span className="font-semibold">Why am I seeing this? </span>
              {i.why}
            </p>
            {i.source && (
              <p>
                <span className="font-semibold">Market source: </span>
                {i.source}
              </p>
            )}
            {i.calc.map((b) => (
              <div key={b.title}>
                <p className="mb-1 font-semibold">{b.title}</p>
                <dl className="grid grid-cols-[minmax(0,auto)_1fr] gap-x-3 gap-y-0.5">
                  {b.rows.map((r) => (
                    <div key={r.label} className="contents">
                      <dt className="text-muted-foreground">{r.label}</dt>
                      <dd className="tabular">{r.value}</dd>
                    </div>
                  ))}
                </dl>
                {b.formula && <p className="mt-1 rounded bg-surface px-2 py-1 font-mono text-[11px] tabular">{b.formula}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </li>
  );
}

const MARKET_LABEL: Record<string, string> = { ggr: "GGR", wager: "Wager", bets: "Bets", players: "Active players" };

/**
 * Automatic insights for one promo: what happened, in a few ranked findings
 * with the calculation behind each, the market context they were judged
 * against, and every data problem that limits them.
 */
export function PromoInsights({ m, all, currency, onMissions }: { m: PromoMetrics; all: PromoMetrics[]; currency: string; onMissions?: () => void }) {
  const { marketTrends, saveMarketTrend, deleteMarketTrend } = useData();
  const confirm = useConfirm();
  const report = useMemo(() => buildPromoInsights(m, { currency, marketTrends, peers: all }), [m, currency, marketTrends, all]);
  const [showAll, setShowAll] = useState(false);
  const [editing, setEditing] = useState<MarketTrend | null>(null);
  const p = m.promo;
  const list = showAll ? report.insights : report.top;
  const counts = (["positive", "mixed", "negative"] as Severity[]).map((s) => [s, report.insights.filter((i) => i.severity === s).length] as const).filter(([, n]) => n > 0);
  const completion = m.missionDays?.overallRate ?? m.missions?.completionRate ?? null;

  const draft = (): MarketTrend => ({
    id: newId(),
    market: p.market,
    from: p.startDate,
    to: p.endDate,
    baselineFrom: m.beforeStart,
    baselineTo: m.beforeEnd,
    changes: {},
    provider: "Blask",
    origin: "manual",
  });
  const trendById = (id?: string) => marketTrends.find((t) => t.id === id);
  const remove = async (t: MarketTrend) => {
    if (await confirm({ title: "Delete this market data?", description: `${t.provider} · ${t.market} · ${formatDay(t.from)} – ${formatDay(t.to, true)}`, confirmLabel: "Delete", destructive: true }))
      deleteMarketTrend(t.id);
  };

  return (
    <section id="insights" className="panel scroll-mt-20 overflow-hidden">
      <header className="flex flex-wrap items-start justify-between gap-2 px-4 pt-4 sm:px-5">
        <div>
          <h2 className="flex items-center gap-2 font-display text-lg font-bold">
            <Lightbulb className="size-4.5 text-primary" /> Insights
          </h2>
          <p className="text-xs text-muted-foreground">Calculated from this report's numbers. Open "Why?" on any insight to check the math.</p>
        </div>
        {counts.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {counts.map(([s, n]) => (
              <span key={s} className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium", TONE[s].pill)}>
                <span className={cn("size-1.5 rounded-full", TONE[s].dot)} />
                {n} {SEVERITY_LABEL[s].toLowerCase()}
              </span>
            ))}
          </div>
        )}
      </header>

      {report.summary.length > 0 && (
        <div className="mx-4 mt-3 rounded-lg border border-border bg-surface-raised/60 px-3.5 py-2.5 sm:mx-5">
          <p className="text-eyebrow">Automatic summary</p>
          <p className="mt-1 text-sm leading-relaxed">{report.summary.join(" ")}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">Assembled from the calculated insights below. No AI, no estimates.</p>
        </div>
      )}

      <div className="grid gap-5 p-4 sm:p-5 lg:grid-cols-3">
        <div className="min-w-0 lg:col-span-2">
          {list.length ? (
            <ol className="divide-y divide-border">
              {list.map((i) => (
                <InsightRow key={i.id} i={i} />
              ))}
            </ol>
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">Not enough data for insights yet. See the data checks for what's missing.</p>
          )}
          {report.insights.length > report.top.length && (
            <button onClick={() => setShowAll((v) => !v)} className="press mt-1 text-xs font-medium text-primary hover:underline">
              {showAll ? "Show the top insights only" : `View all insights (${report.insights.length})`}
            </button>
          )}
          {completion != null && onMissions && (
            <button onClick={onMissions} className="mt-3 flex w-full items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-left text-sm transition-colors hover:border-primary/60">
              <span>
                Mission completion <strong className="font-semibold">{(completion * 100).toFixed(0)}%</strong>
                {m.missionDays?.biggestDrop && <span className="text-muted-foreground"> · biggest drop on Day {m.missionDays.biggestDrop.day}</span>}
              </span>
              <span className="text-xs font-medium text-primary">Investigate →</span>
            </button>
          )}
        </div>

        <aside className="min-w-0 space-y-3">
          <div className="rounded-lg border border-border p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="flex items-center gap-1.5 text-sm font-semibold">
                <Globe2 className="size-4 text-muted-foreground" /> Market context
              </p>
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setEditing(draft())} disabled={!p.market}>
                <Plus className="size-3.5" /> Add
              </Button>
            </div>
            {report.market.sources.length ? (
              <ul className="mt-2 space-y-2.5">
                {report.market.sources.map((s) => {
                  const t = trendById(s.trendId);
                  return (
                    <li key={s.id} className="text-xs">
                      <p className="flex flex-wrap items-center gap-1.5">
                        <span className="font-semibold">{s.provider}</span>
                        <span className={cn("rounded-full px-1.5 py-px text-[10px] font-medium", s.origin.startsWith("demo") ? "bg-accent/18" : "bg-muted text-muted-foreground")}>{s.origin}</span>
                      </p>
                      <p className="text-muted-foreground">
                        {s.kind === "comparison" ? s.description : `${s.market} · ${s.period}`} · vs {s.baseline}
                      </p>
                      <dl className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                        {Object.entries(s.changes).map(([k, v]) => (
                          <div key={k}>
                            <dt className="inline text-muted-foreground">{MARKET_LABEL[k]} </dt>
                            <dd className="inline font-semibold tabular">{signed(v!)}</dd>
                          </div>
                        ))}
                        {s.activity && (
                          <div>
                            <dt className="inline text-muted-foreground">{s.activity.label} </dt>
                            <dd className="inline font-semibold tabular">{signed(s.activity.change)}</dd>
                          </div>
                        )}
                      </dl>
                      {s.dateNote && <p className="mt-0.5 text-muted-foreground">{s.dateNote}</p>}
                      {s.editable && t && (
                        <div className="mt-1 flex gap-2">
                          <button onClick={() => setEditing(t)} className="inline-flex items-center gap-1 text-primary hover:underline">
                            <Pencil className="size-3" /> Edit
                          </button>
                          <button onClick={() => remove(t)} className="inline-flex items-center gap-1 text-muted-foreground hover:text-bad-ink">
                            <Trash2 className="size-3" /> Delete
                          </button>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">No market data for {p.market || "this promo"} on these dates.</p>
            )}
            {report.market.mismatched.filter((t) => t.origin === "manual").map((t) => (
              <p key={t.id} className="mt-2 text-xs text-muted-foreground">
                Your {t.provider} entry for {formatDay(t.from)} – {formatDay(t.to, true)} doesn't match these dates.{" "}
                <button onClick={() => setEditing(t)} className="text-primary hover:underline">
                  Edit
                </button>{" "}
                ·{" "}
                <button onClick={() => remove(t)} className="hover:text-bad-ink">
                  Delete
                </button>
              </p>
            ))}
            <p className="mt-2.5 border-t border-border pt-2 text-[11px] text-muted-foreground">
              Blask isn't connected to this site — there's no Blask API access configured. Add Blask figures by hand, or have the Back Office deliver
              them with the data (see the API doc).
            </p>
          </div>

          {report.quality.length > 0 && (
            <div className="rounded-lg border border-border p-3">
              <p className="text-sm font-semibold">Data checks</p>
              <ul className="mt-1.5 space-y-1.5">
                {report.quality.map((q) => (
                  <li key={q.id} className="flex gap-1.5 text-xs">
                    {q.level === "warn" ? <AlertTriangle className="mt-px size-3.5 shrink-0 text-accent" /> : <Info className="mt-px size-3.5 shrink-0 text-muted-foreground" />}
                    <span className={q.level === "warn" ? "" : "text-muted-foreground"}>{q.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>

      {editing && (
        <MarketDataDialog
          key={editing.id}
          open
          onOpenChange={(o) => !o && setEditing(null)}
          initial={editing}
          onSave={(t) => saveMarketTrend(t)}
        />
      )}
    </section>
  );
}
