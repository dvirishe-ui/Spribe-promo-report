import { useNavigate } from "@tanstack/react-router";
import { ArrowRight, BookmarkPlus, CircleAlert, Database, HeartPulse, Lightbulb, Target, TrendingDown, TrendingUp, Users } from "lucide-react";
import type { Insight, InsightLink } from "@/lib/insights";
import { useActions } from "@/lib/actions";
import { useView } from "@/lib/view";
import { emptyFilters } from "@/lib/filters";
import { cn } from "@/lib/utils";

const ICON = {
  Performance: TrendingUp,
  Participation: Users,
  Missions: Target,
  Cost: CircleAlert,
  Data: Database,
  "Responsible gaming": HeartPulse,
} as const;

const TONE = {
  good: "text-good-ink bg-good/10",
  bad: "text-bad-ink bg-bad/10",
  warn: "text-accent bg-accent/15",
  neutral: "text-muted-foreground bg-surface-raised",
};

export function useOpenLink() {
  const navigate = useNavigate();
  const { set } = useView();
  return (l: InsightLink) => {
    if (l.kind === "promo") navigate({ to: "/promo/$promoId", params: { promoId: l.id }, search: { tab: l.tab, day: l.day } });
    else if (l.kind === "operator") {
      // An operator's promos: the Promotions list filtered to them.
      set({ filters: { ...emptyFilters, operator: l.operator } });
      navigate({ to: "/promotions" });
    }
    else if (l.kind === "data") navigate({ to: "/data" });
    else navigate({ to: "/promotions" });
  };
}

/**
 * One insight: what happened, the metric that triggered it, the comparison
 * used, a link to the evidence and (when justified) a next step.
 */
export function InsightCard({ insight: i, compact = false }: { insight: Insight; compact?: boolean }) {
  const open = useOpenLink();
  const { startDraft } = useActions();
  const Icon = i.tone === "bad" && i.category === "Performance" ? TrendingDown : (ICON[i.category] ?? Lightbulb);
  return (
    <div className="group flex items-start gap-3 py-3">
      <span className={cn("mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg", TONE[i.tone])}>
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{i.category}</p>
        <p className="mt-0.5 font-medium leading-snug">{i.title}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          <span className="text-foreground/80">{i.metric}</span> · {i.basis}
        </p>
        {!compact && i.action && <p className="mt-1.5 text-xs">Next step: {i.action}</p>}
        <div className="mt-2 flex flex-wrap items-center gap-1">
          <button
            onClick={() => open(i.link)}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
          >
            {i.linkLabel} <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
          </button>
          {i.action && (
            <button
              onClick={() =>
                startDraft({
                  title: i.action!.replace(/\.$/, ""),
                  promoId: i.promoId,
                  operator: i.operator,
                  notes: `${i.title}. ${i.metric} (${i.basis}).`,
                })
              }
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-surface-raised hover:text-foreground"
            >
              <BookmarkPlus className="size-3" /> Save as action
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
