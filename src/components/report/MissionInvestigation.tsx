import { Link } from "@tanstack/react-router";
import { ArrowRight, BookmarkPlus, ChevronRight, CircleAlert, Clock, Lightbulb, Search, Target, X } from "lucide-react";
import { investigateDay } from "@/lib/explain";
import type { PromoMetrics } from "@/lib/metrics";
import { num, pctPlain } from "@/lib/format";
import { useActions } from "@/lib/actions";
import { cn } from "@/lib/utils";

/**
 * One-click investigation for daily missions:
 * completion by day (click a day) → the evidence for that day → possible
 * explanations (not proven) → a suggested next step you can save as an action.
 */
export function CompletionByDay({ m, selected, onSelect }: { m: PromoMetrics; selected: number | null; onSelect: (day: number | null) => void }) {
  const s = m.missionDays!;
  const drop = s.biggestDrop?.day ?? null;
  return (
    <section className="panel p-4 sm:p-5" id="completion-by-day">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-display text-base font-semibold">Completion by day</h3>
        <p className="text-xs text-muted-foreground">Completed ÷ started each day. Click a day to investigate it.</p>
      </div>
      <div className="mt-4 flex items-end gap-1.5 sm:gap-2" role="list">
        {s.days.map((d) => {
          const isDrop = d.day === drop;
          const isSel = d.day === selected;
          return (
            <button
              key={d.day}
              role="listitem"
              onClick={() => onSelect(isSel ? null : d.day)}
              title={`Day ${d.day}: ${d.requirement} — ${pctPlain(d.rate)} completed (${num(d.completed)} of ${num(d.started)})`}
              className={cn("group flex min-w-0 flex-1 flex-col items-center gap-1 rounded-md p-1 transition-colors hover:bg-surface-raised", isSel && "bg-primary/10 ring-1 ring-primary/50")}
            >
              <span className={cn("text-[11px] font-semibold tabular", isDrop ? "text-bad-ink" : "text-muted-foreground")}>{pctPlain(d.rate)}</span>
              <span className="flex h-28 w-full max-w-10 items-end rounded-t-md bg-surface-raised">
                <span
                  className="w-full rounded-t-md transition-[filter] duration-150 group-hover:brightness-110"
                  style={{ height: `${d.rate * 100}%`, background: isDrop ? "var(--series-during)" : "var(--series-before)" }}
                />
              </span>
              <span className={cn("text-[11px]", isSel ? "font-semibold text-foreground" : "text-muted-foreground")}>D{d.day}</span>
            </button>
          );
        })}
      </div>
      {drop != null && selected == null && (
        <button onClick={() => onSelect(drop)} className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
          <Search className="size-3.5" /> Day {drop} had the biggest drop — investigate <ArrowRight className="size-3.5" />
        </button>
      )}
    </section>
  );
}

export function DayDetail({ m, day, all, onClose }: { m: PromoMetrics; day: number; all: PromoMetrics[]; onClose: () => void }) {
  const inv = investigateDay(m, day, all);
  const { startDraft } = useActions();
  const d = m.missionDays?.days.find((x) => x.day === day);
  if (!inv || !d) return null;
  const typical = m.missionDays!.typicalMinutes;

  return (
    <section className="panel animate-rise overflow-hidden border-primary/40">
      <div className="flex items-start justify-between gap-3 border-b border-border bg-primary/5 px-4 py-3 sm:px-5">
        <div>
          <p className="text-eyebrow">Investigating Day {day}</p>
          <p className="mt-0.5 font-display text-lg font-semibold">“{d.requirement}”</p>
          <p className="text-xs text-muted-foreground">Game: {d.game}</p>
        </div>
        <button aria-label="Close" onClick={onClose} className="rounded-md p-1 text-muted-foreground hover:bg-surface-raised hover:text-foreground">
          <X className="size-4" />
        </button>
      </div>
      <ol className="grid gap-0 divide-y divide-border lg:grid-cols-4 lg:divide-x lg:divide-y-0">
        <Step n={1} icon={CircleAlert} title="Problem">
          <p>{inv.problem}</p>
        </Step>
        <Step n={2} icon={Target} title="Evidence">
          <ul className="space-y-1">
            <li>
              {num(d.started)} started, {num(d.completed)} completed — <strong className="font-semibold">{num(inv.lostPlayers)}</strong> didn't finish.
            </li>
            {d.medianMinutes != null && (
              <li className="flex items-center gap-1">
                <Clock className="size-3.5 text-muted-foreground" /> Median {d.medianMinutes} min{typical != null ? ` (typical day ${Math.round(typical)} min)` : ""}
              </li>
            )}
            {inv.history.length > 0 && (
              <li>
                Elsewhere:{" "}
                {inv.history.map((h, i) => (
                  <span key={h.promo.promo.id + h.day.day}>
                    {i > 0 && "; "}
                    <Link to="/promo/$promoId" params={{ promoId: h.promo.promo.id }} search={{ tab: "missions", day: h.day.day }} className="text-primary hover:underline">
                      {h.promo.promo.name} D{h.day.day}
                    </Link>{" "}
                    {pctPlain(h.day.rate)} ({h.why})
                  </span>
                ))}
              </li>
            )}
          </ul>
        </Step>
        <Step n={3} icon={Lightbulb} title="Possible explanations">
          {inv.explanations.length ? (
            <ul className="space-y-1.5">
              {inv.explanations.map((e) => (
                <li key={e.text}>
                  {e.text}
                  <span className="block text-[11px] text-muted-foreground">Because: {e.evidence}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground">Nothing in the data points to a clear reason.</p>
          )}
          <p className="mt-2 text-[11px] italic text-muted-foreground">Hypotheses from the numbers — not proven causes.</p>
        </Step>
        <Step n={4} icon={ChevronRight} title="Suggested next step">
          <p>{inv.nextStep}</p>
          <button
            onClick={() =>
              startDraft({
                title: `Review Day ${day} of ${m.promo.name}: ${inv.nextStep.replace(/\.$/, "")}`,
                promoId: m.promo.id,
                operator: m.promo.operator,
                notes: `${inv.problem} Requirement: “${d.requirement}”.`,
              })
            }
            className="mt-2 inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-surface-raised"
          >
            <BookmarkPlus className="size-3.5" /> Save as action
          </button>
        </Step>
      </ol>
    </section>
  );
}

function Step({ n, icon: Icon, title, children }: { n: number; icon: typeof Target; title: string; children: React.ReactNode }) {
  return (
    <li className="p-4 text-sm sm:px-5">
      <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
        <span className="grid size-5 place-items-center rounded-full bg-surface-raised text-[10px] text-foreground">{n}</span>
        <Icon className="size-3.5" /> {title}
      </p>
      {children}
    </li>
  );
}
