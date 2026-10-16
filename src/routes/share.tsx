import { Link, useParams } from "@tanstack/react-router";
import { toast } from "sonner";
import { ArrowLeft, Link2, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LogoMark, Wordmark } from "@/components/report/Logo";
import { ResultHero } from "@/components/report/ResultHero";
import { NotFoundPage } from "@/routes/not-found";
import { useData } from "@/lib/store";
import { formatRange } from "@/lib/dates";
import { marketLabel } from "@/lib/markets";
import { money, num, pctPlain } from "@/lib/format";
import type { PromoMetrics } from "@/lib/metrics";

/**
 * Partner view: one clean page with the result of a single promo — no app
 * navigation, no editing, nothing internal. Made to be screen-shared, sent
 * as a PDF (Print), or opened by a partner.
 */
export function SharePage() {
  const { promoId } = useParams({ from: "/share/$promoId" });
  const { metrics, dataset } = useData();
  const m = metrics.find((x) => x.promo.id === promoId);
  if (!m) return <NotFoundPage />;
  const p = m.promo;
  const cur = dataset.currency;
  const demo = p.id.startsWith("sample-");

  return (
    <div className="min-h-screen">
      <div className="no-print border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-2 px-4 py-2.5">
          <Button asChild variant="ghost" size="sm">
            <Link to="/promo/$promoId" params={{ promoId: p.id }}>
              <ArrowLeft className="size-4" /> Full report
            </Link>
          </Button>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                navigator.clipboard.writeText(location.href).then(
                  () => toast.success("Link copied"),
                  () => toast.error("Couldn't copy the link"),
                )
              }
            >
              <Link2 className="size-3.5" /> Copy link
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Printer className="size-3.5" /> Print / PDF
            </Button>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-4xl space-y-6 px-4 py-8">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-eyebrow">Promo results</p>
            <h1 className="mt-1 font-display text-3xl font-bold sm:text-4xl">{p.name}</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {[p.operator, p.market && marketLabel(p.market), p.games.join(", "), formatRange(p.startDate, p.endDate)].filter(Boolean).join(" · ")}
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <LogoMark className="size-10 rounded-[11px]" />
            <Wordmark className="text-base" />
          </div>
        </header>

        {demo && (
          <p className="rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-xs">
            <strong className="font-semibold">Demo data.</strong> This promo, operator and all numbers are fictional.
          </p>
        )}

        <ResultHero m={m} currency={cur} />

        <Highlights m={m} currency={cur} />

        <footer className="border-t border-border pt-4 text-xs text-muted-foreground">
          Figures in {cur}. GGR is compared per day with the {m.windowDays} days before and after the promo
          {m.isAdjusted ? ", with the market trend removed using a comparison group" : "; not adjusted for the market trend"}. Aggregate data
          only. Prepared by SPRIBE.
        </footer>
      </main>
    </div>
  );
}

/** A few one-line facts from the detail tabs — only those this promo has data for. */
function Highlights({ m, currency }: { m: PromoMetrics; currency: string }) {
  const items: Array<{ label: string; value: string; sub?: string }> = [];
  if (m.ggrDuring != null) items.push({ label: "GGR during the promo", value: money(m.ggrDuring, currency), sub: `${m.promoDays} days` });
  if (m.participationRate != null) items.push({ label: "Active players who took part", value: pctPlain(m.participationRate) });
  if (m.missions?.completionRate != null)
    items.push({ label: "Completed every mission", value: pctPlain(m.missions.completionRate), sub: `${num(m.missions.steps[m.missions.steps.length - 1].reached)} players` });
  if (m.leaderboard) items.push({ label: "Prize winners", value: num(m.leaderboard.winners), sub: `${money(m.leaderboard.totalPrize, currency)} paid out` });
  if (m.betsPerParticipant != null) items.push({ label: "Bets per player", value: m.betsPerParticipant.toFixed(0) });
  if (!items.length) return null;
  return (
    <section>
      <p className="text-eyebrow mb-2">Highlights</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {items.slice(0, 4).map((it) => (
          <div key={it.label} className="rounded-xl border border-border bg-surface p-3.5">
            <p className="text-xs text-muted-foreground">{it.label}</p>
            <p className="mt-1 font-display text-xl font-bold">{it.value}</p>
            {it.sub && <p className="text-xs text-muted-foreground">{it.sub}</p>}
          </div>
        ))}
      </div>
    </section>
  );
}
