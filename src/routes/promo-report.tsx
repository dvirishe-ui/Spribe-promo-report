import { useState } from "react";
import { Link, useParams } from "@tanstack/react-router";
import { toast } from "sonner";
import { ArrowLeft, ClipboardCopy, Pencil, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PromoSummary, summaryLines } from "@/components/report/PromoSummary";
import { PromoEditor } from "@/components/report/PromoEditor";
import { NotFoundPage } from "@/routes/not-found";
import { useData } from "@/lib/store";
import { formatRange } from "@/lib/dates";
import { moneyFull, pct } from "@/lib/format";

export function PromoReportPage() {
  const { promoId } = useParams({ from: "/promo/$promoId" });
  const { metrics, dataset, editable } = useData();
  const [editing, setEditing] = useState(false);

  const m = metrics.find((x) => x.promo.id === promoId);
  if (!m) return <NotFoundPage />;
  const p = m.promo;
  const cur = dataset.currency;

  const copySummary = async () => {
    const text = [
      `${p.name} (${[p.operator, formatRange(p.startDate, p.endDate)].filter(Boolean).join(", ")})`,
      `GGR before ${moneyFull(m.ggrBefore, cur)} → during ${moneyFull(m.ggrDuring, cur)} (${pct(m.duringVsBefore)}) → after ${moneyFull(m.ggrAfter, cur)} (${pct(m.afterVsBefore)})`,
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
    <main className="mx-auto max-w-3xl space-y-5 px-4 py-5 lg:px-8">
      <div className="no-print flex flex-wrap items-center justify-between gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link to="/">
            <ArrowLeft className="size-4" /> All reports
          </Link>
        </Button>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={copySummary}>
            <ClipboardCopy className="size-3.5" /> Copy summary
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="size-3.5" /> Print
          </Button>
          {editable && (
            <Button size="sm" onClick={() => setEditing(true)}>
              <Pencil className="size-3.5" /> Edit
            </Button>
          )}
        </div>
      </div>
      <div className="panel p-5 sm:p-6">
        <PromoSummary m={m} currency={cur} />
      </div>
      <PromoEditor promo={p} open={editing} onOpenChange={setEditing} />
    </main>
  );
}
