import { ArrowRight, CircleAlert, Info, Lightbulb, TrendingUp } from "lucide-react";
import type { Finding, FindingAction } from "@/lib/findings";
import { cn } from "@/lib/utils";
import { DefinitionsDialog } from "./DefinitionsDialog";

const TONE = {
  good: { icon: TrendingUp, cls: "text-good-ink bg-good/10" },
  bad: { icon: CircleAlert, cls: "text-bad-ink bg-bad/10" },
  neutral: { icon: Lightbulb, cls: "text-primary bg-primary/10" },
};

/** Up to three rule-based findings, each with its evidence and a one-click drill-down. */
export function KeyFindings({
  findings,
  basis,
  onAction,
}: {
  findings: Finding[];
  /** e.g. "Based on 12 promos with before and during GGR · 6 adjusted for market trend" */
  basis: string;
  onAction: (a: FindingAction) => void;
}) {
  return (
    <section className="panel p-4">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-display text-base font-semibold">Key findings</h3>
        <DefinitionsDialog>
          <button className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <Info className="size-3.5" /> How these are worked out
          </button>
        </DefinitionsDialog>
      </div>
      {findings.length === 0 ? (
        <p className="py-2 text-sm text-muted-foreground">Not enough data in this view for findings yet — they appear once a few promos have before and during numbers.</p>
      ) : (
        <ul className="divide-y divide-border">
          {findings.map((f) => {
            const t = TONE[f.tone];
            return (
              <li key={f.id} className="flex items-start gap-3 py-2.5">
                <span className={cn("mt-0.5 grid size-7 shrink-0 place-items-center rounded-md", t.cls)}>
                  <t.icon className="size-3.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm">{f.text}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">Based on {f.evidence}</p>
                </div>
                {f.action && (
                  <button
                    onClick={() => onAction(f.action!)}
                    className="mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10"
                  >
                    {f.action.kind === "promo" ? "Open" : "Show"} <ArrowRight className="size-3" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-1 text-[11px] text-muted-foreground">{basis}</p>
    </section>
  );
}
