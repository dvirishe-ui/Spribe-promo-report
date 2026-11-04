import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Check } from "lucide-react";
import { ResultTag } from "./Outcome";
import { PhaseTable } from "./PhaseTable";
import type { PromoMetrics } from "@/lib/metrics";
import { flagFor } from "@/lib/markets";
import { money, multiple, num, pctPlain } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useData } from "@/lib/store";
import { DEFAULT_INSIGHT_CONFIG, marketContext, marketVerdict, pickMarketComparison } from "@/lib/promo-insights";

/** "Market −5.0% · +15.0 pp": the promo's change against the market's, when market data covers its dates. */
function MarketChip({ m }: { m: PromoMetrics }) {
  const { marketTrends } = useData();
  const cmp = pickMarketComparison(marketContext(m, marketTrends, DEFAULT_INSIGHT_CONFIG));
  if (!cmp || m.duringVsBefore == null) return null;
  const v = marketVerdict(m.duringVsBefore, cmp.market, cmp.sameMeasure, DEFAULT_INSIGHT_CONFIG.marketComparisonTolerancePp, DEFAULT_INSIGHT_CONFIG.meaningfulChangeThreshold);
  const s = (x: number) => `${x > 0.0005 ? "+" : x < -0.0005 ? "−" : ""}${Math.abs(x * 100).toFixed(1)}%`;
  return (
    <span
      title={`${v.title}. ${v.text} Source: ${cmp.source.provider} (${cmp.source.origin}).`}
      className={cn(
        "rounded-full px-2 py-0.5 font-medium",
        v.tone === "good" ? "bg-good/12 text-good-ink" : v.tone === "bad" ? "bg-bad/12 text-bad-ink" : "bg-muted text-muted-foreground",
      )}
    >
      {cmp.source.kind === "comparison" ? "Comparison group" : cmp.sameMeasure ? "Market" : "Market activity"} {s(cmp.market)} · {v.gapPp >= 0 ? "+" : "−"}
      {Math.abs(v.gapPp).toFixed(1)} pp
    </span>
  );
}

function Stat({ label, children, sub, tone }: { label: string; children: ReactNode; sub?: ReactNode; tone?: "good" | "bad" }) {
  return (
    <div className="min-w-0 rounded-lg bg-surface-raised/70 px-3 py-2">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className={cn("font-display text-base font-bold tabular", tone === "good" && "text-good-ink", tone === "bad" && "text-bad-ink")}>{children}</p>
      {sub && <p className="truncate text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

/**
 * One promotion's report card: who/where/when, the headline figures that
 * aren't in the table (contribution, participants, ROI), then every metric
 * Before / During / After.
 */
export function PromoPhaseCard({
  m,
  currency,
  selected,
  onToggle,
}: {
  m: PromoMetrics;
  currency: string;
  selected: boolean;
  onToggle: () => void;
}) {
  const p = m.promo;
  const notFinal = m.status !== "complete";
  return (
    <article className={cn("panel min-w-0 overflow-hidden transition-shadow", selected && "ring-2 ring-primary/50")}>
      <header className="flex flex-col gap-2 px-4 pb-3 pt-3.5 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Link to="/promo/$promoId" params={{ promoId: p.id }} className="truncate font-display text-base font-bold hover:text-primary">
              {p.name}
            </Link>
            <ResultTag m={m} currency={currency} />
          </div>
          <div className="mt-1 flex flex-wrap gap-1.5 text-[11px] text-muted-foreground">
            {[p.operator, `${flagFor(p.market)} ${p.market}`, p.type, `${m.promoDays} days`].filter(Boolean).map((t) => (
              <span key={t} className="rounded-full border border-border px-2 py-0.5">
                {t}
              </span>
            ))}
            {notFinal && (
              <span className="rounded-full bg-accent/15 px-2 py-0.5 font-medium text-foreground">{m.status === "upcoming" ? "Not started yet" : "Not final yet"}</span>
            )}
            <MarketChip m={m} />
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            onClick={onToggle}
            aria-pressed={selected}
            title={selected ? "Remove from comparison" : "Add to comparison"}
            className={cn("press inline-flex h-7 items-center gap-1 rounded-md border px-2 text-[11px]", selected ? "border-primary bg-primary/10" : "border-border text-muted-foreground hover:text-foreground")}
          >
            <span className={cn("grid size-3.5 place-items-center rounded-sm border", selected ? "border-primary bg-primary text-primary-foreground" : "border-border")}>
              {selected && <Check className="size-2.5" />}
            </span>
            Compare
          </button>
          <Link to="/promo/$promoId" params={{ promoId: p.id }} className="press inline-flex h-7 items-center gap-1 rounded-md px-2 text-[11px] font-medium text-primary hover:bg-primary/10">
            Full report <ArrowRight className="size-3" />
          </Link>
        </div>
      </header>

      <div className="grid grid-cols-3 gap-2 px-4 pb-3">
        <Stat label="Promo contribution">{money(p.prizePool, currency)}</Stat>
        <Stat label="Participants" sub={m.participationRate != null ? `${pctPlain(m.participationRate, 1)} of active players` : undefined}>
          {num(m.participants)}
        </Stat>
        <Stat label="Promo ROI" sub="extra GGR ÷ contribution" tone={m.promoRoi == null ? undefined : m.promoRoi >= 1 ? "good" : "bad"}>
          {multiple(m.promoRoi)}
        </Stat>
      </div>

      <div className="border-t border-border">
        <PhaseTable m={m} currency={currency} />
      </div>
    </article>
  );
}
