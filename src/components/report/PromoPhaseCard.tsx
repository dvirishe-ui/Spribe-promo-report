import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Check } from "lucide-react";
import { ResultTag } from "./Outcome";
import { PhaseTable } from "./PhaseTable";
import type { PromoMetrics } from "@/lib/metrics";
import { flagFor } from "@/lib/markets";
import { money, multiple, num, pctPlain } from "@/lib/format";
import { cn } from "@/lib/utils";

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
