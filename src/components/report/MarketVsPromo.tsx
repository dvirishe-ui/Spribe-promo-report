import { useMemo, useState } from "react";
import { Globe2, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DEFAULT_INSIGHT_CONFIG, marketContext, marketVerdict, pickMarketComparison } from "@/lib/promo-insights";
import type { PromoMetrics } from "@/lib/metrics";
import type { MarketTrend } from "@/lib/types";
import { formatDay } from "@/lib/dates";
import { newId } from "@/lib/normalize";
import { useData } from "@/lib/store";
import { cn } from "@/lib/utils";
import { MarketDataDialog } from "./MarketDataDialog";

const TONE = {
  good: "border-good/35 bg-good/6",
  bad: "border-bad/35 bg-bad/6",
  mixed: "border-accent/45 bg-accent/8",
  neutral: "border-border bg-surface",
} as const;

const signed = (v: number) => `${v > 0.0005 ? "+" : v < -0.0005 ? "−" : ""}${Math.abs(v * 100).toFixed(1)}%`;

/** A bar growing left (down) or right (up) from a centre line. */
function Bar({ label, sub, value, scale }: { label: string; sub: string; value: number; scale: number }) {
  const w = Math.min(50, (Math.abs(value) / scale) * 50);
  return (
    <div className="grid grid-cols-[1fr_4.5rem] items-center gap-x-3 gap-y-1 sm:grid-cols-[minmax(0,12rem)_1fr_5rem]">
      <div className="col-span-2 min-w-0 sm:col-span-1">
        <p className="truncate text-sm font-medium">{label}</p>
        <p className="truncate text-[11px] text-muted-foreground">{sub}</p>
      </div>
      <div className="relative h-6 rounded bg-surface-raised/70">
        <span className="absolute inset-y-0 left-1/2 w-px bg-border" />
        <span
          className={cn("absolute inset-y-1 rounded-sm", value >= 0 ? "bg-good/70" : "bg-bad/70")}
          style={value >= 0 ? { left: "50%", width: `${w}%` } : { right: "50%", width: `${w}%` }}
        />
      </div>
      <p className={cn("text-right font-display text-lg font-bold tabular", value > 0.0005 ? "text-good-ink" : value < -0.0005 ? "text-bad-ink" : "")}>{signed(value)}</p>
    </div>
  );
}

/**
 * "Is it the promo or the market?" — this promo's GGR change next to the
 * market's over the same days (Blask or another source, typed in or delivered
 * with the data), with a plain verdict. Without market data it asks for it.
 */
export function MarketVsPromo({ m }: { m: PromoMetrics }) {
  const { marketTrends, saveMarketTrend } = useData();
  const [editing, setEditing] = useState<MarketTrend | null>(null);
  const cfg = DEFAULT_INSIGHT_CONFIG;
  const ctx = useMemo(() => marketContext(m, marketTrends, cfg), [m, marketTrends, cfg]);
  const cmp = pickMarketComparison(ctx);
  const p = m.promo;
  const promo = m.duringVsBefore;
  if (m.status === "upcoming" || promo == null) return null;

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
  const editable = cmp?.source.trendId ? marketTrends.find((t) => t.id === cmp.source.trendId && t.origin === "manual") : undefined;
  const dates = `${formatDay(p.startDate)} – ${formatDay(p.endDate, true)}`;
  const dialog = editing && (
    <MarketDataDialog key={editing.id} open onOpenChange={(o) => !o && setEditing(null)} initial={editing} onSave={(t) => saveMarketTrend(t)} />
  );

  if (!cmp) {
    const near = ctx.mismatched[0];
    return (
      <section className="panel flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5">
        <div className="flex min-w-0 gap-3">
          <Globe2 className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <h2 className="text-base font-semibold">Is it the promo or the market?</h2>
            <p className="text-sm text-muted-foreground">
              This promo's GGR moved <strong className="font-semibold text-foreground">{signed(promo)}</strong> per day vs before. No market data for{" "}
              {p.market || "this market"} on {dates} yet{near ? ` (there's ${near.provider} data for other dates, which isn't compared)` : ""} — add the market's change
              for this period, e.g. from Blask, to see whether the result is promo-specific or market-wide.
            </p>
          </div>
        </div>
        {p.market && (
          <Button size="sm" onClick={() => setEditing(draft())}>
            <Plus className="size-3.5" /> Add market data
          </Button>
        )}
        {dialog}
      </section>
    );
  }

  const v = marketVerdict(promo, cmp.market, cmp.sameMeasure, cfg.marketComparisonTolerancePp, cfg.meaningfulChangeThreshold);
  const scale = Math.max(Math.abs(promo), Math.abs(cmp.market), 0.05);
  const src = cmp.source;
  return (
    <section className={cn("rounded-xl border p-4 sm:p-5", TONE[v.tone])}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Globe2 className="size-3.5" /> Promo vs market · {dates}
          </p>
          <h2 className="mt-0.5 text-lg font-bold">{v.title}</h2>
        </div>
        <span
          className={cn(
            "rounded-full px-2.5 py-1 text-xs font-semibold tabular",
            Math.abs(v.gapPp) < cfg.marketComparisonTolerancePp ? "bg-muted text-muted-foreground" : v.gapPp > 0 ? "bg-good/15 text-good-ink" : "bg-bad/15 text-bad-ink",
          )}
          title="Promo change − market change, in percentage points"
        >
          {v.gapPp >= 0 ? "+" : "−"}
          {Math.abs(v.gapPp).toFixed(1)} pp vs {cmp.sameMeasure ? "market" : "market activity"}
        </span>
      </div>
      <p className="mt-1 max-w-3xl text-sm">{v.text}</p>

      <div className="mt-4 space-y-2.5">
        <Bar label="This promo" sub="GGR per day, during vs before" value={promo} scale={scale} />
        <Bar label={src.kind === "comparison" ? "Comparison group" : `${src.market} market`} sub={cmp.measure} value={cmp.market} scale={scale} />
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border/70 pt-2.5 text-[11px] text-muted-foreground">
        <p className="min-w-0">
          Source: <span className="font-medium text-foreground">{src.provider}</span> ({src.origin}) · {src.kind === "comparison" ? src.description : `${src.period} vs ${src.baseline}`}
          {!cmp.sameMeasure && ` · ${cmp.measure} measures market activity, not GGR — a direction check, not like-for-like.`}
          {src.kind === "comparison" && " · Add the Blask figure for this period to compare with the whole market."}
        </p>
        <div className="flex gap-1">
          {editable ? (
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setEditing(editable)}>
              <Pencil className="size-3" /> Edit market data
            </Button>
          ) : (
            p.market && (
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setEditing(draft())}>
                <Plus className="size-3" /> Add market data
              </Button>
            )
          )}
        </div>
      </div>
      {dialog}
    </section>
  );
}
