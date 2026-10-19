import { useState } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { GitCompareArrows, X } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { ComparisonView, SelectionChips } from "./Comparison";
import { useData } from "@/lib/store";
import { useView } from "@/lib/view";
import type { PromoMetrics } from "@/lib/metrics";

/** The selected promos, in the order they were picked (unknown ids dropped). */
export function useSelection() {
  const { metrics } = useData();
  const { view, toggleSelect, setSelected } = useView();
  const list = view.selected.map((id) => metrics.find((m) => m.promo.id === id)).filter((m): m is PromoMetrics => !!m);
  return { list, ids: view.selected, toggle: toggleSelect, set: setSelected, clear: () => setSelected([]) };
}

/**
 * Floating bar shown whenever promos are selected, on every page. Compare
 * opens the comparison in a drawer without leaving the page; the selection
 * stays while moving between pages.
 */
export function SelectionBar() {
  const { list, toggle, clear } = useSelection();
  const { dataset } = useData();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const onCompareTab = useRouterState({ select: (s) => s.location.pathname === "/explore" && (s.location.search as { tab?: string }).tab === "compare" });
  if (!list.length || onCompareTab) return null;

  return (
    <>
      <div className="no-print pointer-events-none fixed inset-x-0 bottom-3 z-30 flex justify-center px-3">
        <div className="pointer-events-auto flex max-w-[min(64rem,100%)] items-center gap-2 rounded-xl border border-border bg-popover/95 px-3 py-2 shadow-xl backdrop-blur">
          <span className="shrink-0 text-xs font-semibold">{list.length} selected</span>
          <div className="hidden min-w-0 sm:block">
            <SelectionChips list={list} onRemove={toggle} max={4} />
          </div>
          <button
            disabled={list.length < 2}
            onClick={() => setOpen(true)}
            title={list.length < 2 ? "Select at least two promos" : undefined}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-40"
          >
            <GitCompareArrows className="size-3.5" /> Compare
          </button>
          <button onClick={clear} aria-label="Clear selection" className="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-surface-raised hover:text-foreground">
            <X className="size-4" />
          </button>
        </div>
      </div>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent aria-describedby={undefined} className="w-full overflow-y-auto border-border bg-background p-0 sm:max-w-[min(72rem,95vw)]">
          <div className="sticky top-0 z-10 space-y-1.5 border-b border-border bg-background/95 px-4 py-3 pr-12 backdrop-blur">
            <div className="flex flex-wrap items-center gap-3">
              <SheetTitle className="text-base font-semibold">Compare {list.length} promotions</SheetTitle>
              <Link to="/explore" search={{ tab: "compare" }} onClick={() => setOpen(false)} className="text-xs text-primary hover:underline">
                Open in Explore
              </Link>
              <button onClick={clear} className="text-xs text-muted-foreground hover:text-foreground">
                Clear selection
              </button>
            </div>
            <SelectionChips list={list} onRemove={toggle} />
          </div>
          <div className="p-4">
            <ComparisonView
              list={list}
              currency={dataset.currency}
              onOpen={(id) => {
                setOpen(false);
                navigate({ to: "/promo/$promoId", params: { promoId: id } });
              }}
            />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
