import type { ReactNode } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { KEY_FINDINGS_RULES, METRICS, REPORTING_PERIODS, RESPONSIBLE_GAMING, type Definition } from "@/lib/definitions";

/** "How numbers are calculated" — every metric and period in plain words. */
export function DefinitionsDialog({ children }: { children: ReactNode }) {
  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>How numbers are calculated</DialogTitle>
          <DialogDescription>The same rules apply on every page and in every export.</DialogDescription>
        </DialogHeader>
        <div className="space-y-5 text-sm">
          <Section title="Reporting periods" items={REPORTING_PERIODS} />
          <Section title="Metrics" items={METRICS} />
          <div>
            <h3 className="mb-1 text-sm font-semibold">Key findings</h3>
            <p className="text-muted-foreground">{KEY_FINDINGS_RULES}</p>
          </div>
          <div>
            <h3 className="mb-1 text-sm font-semibold">Responsible gaming</h3>
            <p className="text-muted-foreground">{RESPONSIBLE_GAMING}</p>
          </div>
          <div>
            <h3 className="mb-1 text-sm font-semibold">Privacy and access</h3>
            <p className="text-muted-foreground">
              The report only uses aggregate numbers (totals and counts per promo). It never stores or shows individual
              players. Operator reports contain only that operator's own promotions. Access restrictions are enforced by the
              Back Office; “View as” only previews them.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Section({ title, items }: { title: string; items: Definition[] }) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold">{title}</h3>
      <dl className="space-y-2">
        {items.map((d) => (
          <div key={d.term} className="grid gap-0.5 sm:grid-cols-[11rem_1fr] sm:gap-3">
            <dt className="font-medium">{d.term}</dt>
            <dd className="text-muted-foreground">{d.meaning}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
