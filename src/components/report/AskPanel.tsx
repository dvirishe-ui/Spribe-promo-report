import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowRight, ArrowUp, Sparkles, Trash2 } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useData } from "@/lib/store";
import { ask, suggestions, type Answer } from "@/lib/ask";
import { cn } from "@/lib/utils";

/** **bold** → <strong>; everything else as text. */
function Rich({ text }: { text: string }) {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return (
    <>
      {parts.map((p, i) =>
        i % 2 ? (
          <strong key={i} className="font-semibold text-foreground">
            {p}
          </strong>
        ) : (
          <Fragment key={i}>{p}</Fragment>
        ),
      )}
    </>
  );
}

function AnswerView({ a, onOpen, onAsk }: { a: Answer; onOpen: (id: string) => void; onAsk: (q: string) => void }) {
  return (
    <div className="space-y-2.5 text-sm text-muted-foreground">
      {a.text.map((t, i) => (
        <p key={i}>
          <Rich text={t} />
        </p>
      ))}
      {a.table && (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-surface-raised text-left text-muted-foreground">
                {a.table.head.map((h, i) => (
                  <th key={i} className={cn("whitespace-nowrap px-2.5 py-1.5 font-medium", i > 0 && a.table!.head.length > 2 && "text-right")}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {a.table.rows.map((r, i) => {
                const id = a.table!.ids?.[i];
                return (
                  <tr key={i} onClick={id ? () => onOpen(id) : undefined} className={cn(id && "cursor-pointer hover:bg-surface-raised")}>
                    {r.map((c, j) => (
                      <td
                        key={j}
                        className={cn("px-2.5 py-1.5", j === 0 ? "text-foreground" : "tabular", j > 0 && a.table!.head.length > 2 && "whitespace-nowrap text-right")}
                      >
                        {c}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {a.note && <p className="text-[11px]">{a.note}</p>}
      {(a.links?.length || a.followUps?.length) && (
        <div className="flex flex-wrap gap-1.5">
          {a.links?.map((l) => (
            <button
              key={l.id}
              onClick={() => onOpen(l.id)}
              className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 text-xs text-foreground hover:bg-primary/20"
            >
              {l.label} <ArrowRight className="size-3" />
            </button>
          ))}
          {a.followUps?.map((q) => (
            <button key={q} onClick={() => onAsk(q)} className="rounded-full border border-border px-2.5 py-1 text-xs hover:bg-surface-raised hover:text-foreground">
              {q}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Ask about the promos in plain language. Answers are worked out in the
 * browser from the site's own numbers (see lib/ask.ts) — no AI service is
 * called, so it's instant, works offline and costs nothing per question.
 */
export function AskPanel() {
  const { metrics, dataset } = useData();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [thread, setThread] = useState<Array<{ q: string; a: Answer }>>([]);
  const end = useRef<HTMLDivElement>(null);
  const examples = useMemo(() => suggestions(metrics), [metrics]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  useEffect(() => end.current?.scrollIntoView({ behavior: "smooth", block: "end" }), [thread]);

  const submit = (question: string) => {
    const text = question.trim();
    if (!text) return;
    setThread((t) => [...t, { q: text, a: ask(text, metrics, dataset.monthly, dataset.currency) }]);
    setQ("");
  };
  const openPromo = (id: string) => {
    setOpen(false);
    navigate({ to: "/promo/$promoId", params: { promoId: id } });
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Ask about your promos (Ctrl/⌘ K)"
        aria-label="Ask about your promos"
        className="grid size-9 place-items-center rounded-md border border-border text-muted-foreground transition-colors hover:text-foreground md:flex md:w-auto md:gap-1.5 md:px-2.5"
      >
        <Sparkles className="size-4 text-primary" />
        <span className="hidden text-sm md:inline">Ask</span>
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent aria-describedby={undefined} className="flex w-full flex-col border-border bg-background p-0 sm:max-w-lg">
          <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4 pr-12">
            <div>
              <SheetTitle className="flex items-center gap-2 font-display text-lg font-semibold">
                <Sparkles className="size-4 text-primary" /> Ask about your promos
              </SheetTitle>
              <p className="text-xs text-muted-foreground">Instant answers from the numbers on this site. Works in your browser — no AI service, no credits used.</p>
            </div>
            {thread.length > 0 && (
              <button onClick={() => setThread([])} aria-label="Clear answers" className="mt-1 text-muted-foreground hover:text-foreground">
                <Trash2 className="size-4" />
              </button>
            )}
          </div>

          <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
            {thread.length === 0 && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Ask about promos, operators, markets, promotion types, games or months — GGR before/during/after, changes, contribution, wager, players, part. rate,
                  RTP or Promo ROI. Comparisons, rankings, totals and counts all work.
                </p>
                <div className="flex flex-col items-start gap-1.5">
                  {examples.map((e) => (
                    <button key={e} onClick={() => submit(e)} className="rounded-lg border border-border px-3 py-1.5 text-left text-sm hover:border-primary/50 hover:bg-surface-raised">
                      {e}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {thread.map((t, i) => (
              <div key={i} className="space-y-2">
                <p className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-primary px-3 py-2 text-sm text-primary-foreground">{t.q}</p>
                <div className={cn("rounded-2xl rounded-bl-md border px-3.5 py-3", t.a.understood ? "border-border bg-surface" : "border-accent/40 bg-accent/5")}>
                  <AnswerView a={t.a} onOpen={openPromo} onAsk={submit} />
                </div>
              </div>
            ))}
            <div ref={end} />
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit(q);
            }}
            className="border-t border-border p-3"
          >
            <div className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-1.5 focus-within:border-primary/60">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="e.g. How much GGR did Summer Aviator Rain make vs Aviator Rain Weekend?"
                className="min-w-0 flex-1 bg-transparent py-1.5 text-sm outline-none placeholder:text-muted-foreground"
                autoFocus
              />
              <button type="submit" disabled={!q.trim()} aria-label="Ask" className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground disabled:opacity-40">
                <ArrowUp className="size-4" />
              </button>
            </div>
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
}
