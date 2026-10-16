import { useState } from "react";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { toast } from "sonner";
import { ArrowLeft, BookmarkPlus, Building2, CalendarClock, ClipboardCopy, Download, ExternalLink, FileText, Inbox, ListChecks, Presentation, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ChangePill, EmptyState, StatCard, StatusBadge } from "@/components/report/bits";
import { OutcomeChip } from "@/components/report/ResultHero";
import { NotFoundPage } from "@/routes/not-found";
import { useData } from "@/lib/store";
import { useActions } from "@/lib/actions";
import { operatorSummaries, benchmarks, type BenchmarkRow } from "@/lib/operators";
import { operatorBrief, briefText } from "@/lib/reports";
import { aggregate, type PromoMetrics } from "@/lib/metrics";
import { flagFor, marketLabel } from "@/lib/markets";
import { formatDay, formatRange } from "@/lib/dates";
import { money, num, numCompact, pct, pctPlain } from "@/lib/format";
import { downloadText } from "@/lib/csv";
import { cn } from "@/lib/utils";
import { Coins, Layers, TrendingUp, Users } from "lucide-react";

/* ------------------------------------------------------------------ list */

export function OperatorsPage() {
  const { metrics, dataset } = useData();
  const navigate = useNavigate();
  const cur = dataset.currency;
  const ops = operatorSummaries(metrics);
  const all = aggregate(metrics.filter((m) => m.status === "complete" || m.status === "measuring"));

  return (
    <main className="mx-auto max-w-[1400px] space-y-4 px-4 py-5 lg:px-8">
      <div>
        <h1 className="font-display text-3xl font-bold sm:text-4xl">
          <span className="brand-gradient-text">Operators</span>
        </h1>
        <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">How each operator's promotions are performing. Open one for its history, benchmarks and a meeting brief.</p>
      </div>
      {ops.length === 0 ? (
        <div className="panel">
          <EmptyState icon={Inbox} title="No operators yet" />
        </div>
      ) : (
        <div className="panel overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr className="border-b border-border">
                <th className="px-4 py-2.5 font-medium">Operator</th>
                <th className="px-3 py-2.5 font-medium">Markets</th>
                <th className="px-3 py-2.5 text-right font-medium">Promotions</th>
                <th className="px-3 py-2.5 text-right font-medium" title="Weighted by baseline GGR, completed and measuring promos">GGR vs baseline</th>
                <th className="px-3 py-2.5 text-right font-medium">Players took part</th>
                <th className="px-3 py-2.5 text-right font-medium">Reward cost</th>
                <th className="px-3 py-2.5 font-medium">Next promo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {ops.map((o) => (
                <tr
                  key={o.operator}
                  onClick={() => navigate({ to: "/operators/$operator", params: { operator: o.operator } })}
                  className="cursor-pointer transition-colors hover:bg-surface-raised/60"
                >
                  <td className="px-4 py-3">
                    <p className="font-medium">{o.operator}</p>
                    <p className="text-xs text-muted-foreground">{o.aggregators.join(", ") || "—"}</p>
                  </td>
                  <td className="px-3 py-3">{o.markets.map((m) => flagFor(m) || m).join(" ")}</td>
                  <td className="px-3 py-3 text-right tabular">
                    {o.completed}
                    <span className="text-xs text-muted-foreground"> done{o.live ? ` · ${o.live} live` : ""}{o.upcoming ? ` · ${o.upcoming} upcoming` : ""}</span>
                  </td>
                  <td className="px-3 py-3 text-right">
                    <ChangePill value={o.change} adjusted={o.adjustedCount > 0 && o.adjustedCount === o.completed} className="justify-end" />
                  </td>
                  <td className="px-3 py-3 text-right tabular">{o.withParticipants ? numCompact(o.participants) : "—"}</td>
                  <td className="px-3 py-3 text-right tabular">{money(o.cost, cur)}</td>
                  <td className="px-3 py-3 text-xs text-muted-foreground">{o.nextStart ? formatDay(o.nextStart, true) : "—"}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-border bg-surface-raised/50 text-xs text-muted-foreground">
                <td className="px-4 py-2.5 font-medium">All operators</td>
                <td />
                <td className="px-3 py-2.5 text-right tabular">{metrics.length}</td>
                <td className="px-3 py-2.5 text-right tabular">{pct(all.duringVsBefore)}</td>
                <td className="px-3 py-2.5 text-right tabular">{numCompact(all.participants)}</td>
                <td className="px-3 py-2.5 text-right tabular">{money(all.cost, cur)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </main>
  );
}

/* --------------------------------------------------------------- profile */

export function OperatorProfilePage() {
  const { operator } = useParams({ from: "/operators/$operator" });
  const { metrics, dataset } = useData();
  const { actions, startDraft, setOpen } = useActions();
  const navigate = useNavigate();
  const [briefOpen, setBriefOpen] = useState(false);
  const cur = dataset.currency;
  const mine = metrics.filter((m) => m.promo.operator === operator);
  if (!mine.length) return <NotFoundPage />;

  const summary = operatorSummaries(metrics).find((o) => o.operator === operator)!;
  const done = mine.filter((m) => m.status === "complete" && m.primaryChange != null).sort((a, b) => b.primaryChange! - a.primaryChange!);
  const history = [...mine].filter((m) => m.status !== "upcoming").sort((a, b) => b.promo.startDate.localeCompare(a.promo.startDate));
  const upcoming = mine.filter((m) => m.status === "upcoming").sort((a, b) => a.promo.startDate.localeCompare(b.promo.startDate));
  const bench = benchmarks(operator, metrics);
  const openActions = actions.filter((a) => a.operator === operator && a.status !== "done");
  const types = typeBreakdown(mine.filter((m) => m.status !== "upcoming"));
  const agg = aggregate(mine.filter((m) => m.status === "complete" || m.status === "measuring"));
  const open = (id: string) => navigate({ to: "/promo/$promoId", params: { promoId: id } });

  return (
    <main className="mx-auto max-w-[1200px] space-y-5 px-4 py-5 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link to="/operators">
            <ArrowLeft className="size-4" /> All operators
          </Link>
        </Button>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setBriefOpen(true)}>
            <Sparkles className="size-4" /> Prepare for operator meeting
          </Button>
          <Button asChild variant="outline">
            <Link to="/share/operator/$operator" params={{ operator }}>
              <Presentation className="size-4" /> Operator report
            </Link>
          </Button>
        </div>
      </div>

      <header>
        <p className="text-eyebrow">Operator</p>
        <h1 className="mt-1 flex items-center gap-2 font-display text-3xl font-bold">
          <Building2 className="size-7 text-primary" /> {operator}
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {[summary.markets.map(marketLabel).join(", "), summary.aggregators.join(", ")].filter(Boolean).join(" · ")}
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={Layers} label="Promotions" value={mine.length} hint={`${summary.completed} done · ${summary.live} running · ${summary.upcoming} upcoming`} />
        <StatCard icon={TrendingUp} label="GGR vs baseline" value={pct(agg.duringVsBefore)} hint={benchHint(bench[0])} info="Weighted by baseline GGR across their completed promos. Benchmark: median of other operators' promos." />
        <StatCard icon={Users} label="Players took part" value={agg.withParticipants ? numCompact(agg.participants) : "—"} hint={benchHint(bench.find((b) => b.label.startsWith("Participation")))} />
        <StatCard icon={Coins} label="Reward cost" value={money(agg.cost, cur)} hint={benchHint(bench.find((b) => b.label.startsWith("Reward")), cur)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <section className="panel min-w-0 p-4 sm:p-5 lg:col-span-3">
          <h3 className="font-display text-base font-semibold">Promotion history</h3>
          <p className="mb-3 mt-0.5 text-xs text-muted-foreground">Newest first. The bar is the GGR change vs baseline.</p>
          <HistoryBars list={history} currency={cur} onOpen={open} />
        </section>
        <div className="min-w-0 space-y-4 lg:col-span-2">
          <section className="panel p-4 sm:p-5">
            <h3 className="font-display text-base font-semibold">Strongest and weakest</h3>
            {done.length < 2 ? (
              <p className="mt-2 text-sm text-muted-foreground">Needs two completed promos with results.</p>
            ) : (
              <div className="mt-3 space-y-2">
                {[done[0], done[done.length - 1]].map((m, i) => (
                  <button key={m.promo.id} onClick={() => open(m.promo.id)} className="-mx-2 flex w-[calc(100%+1rem)] items-center justify-between gap-3 rounded-md px-2 py-1.5 text-left hover:bg-surface-raised">
                    <span className="min-w-0">
                      <span className="text-eyebrow">{i === 0 ? "Strongest" : "Weakest"}</span>
                      <span className="block truncate text-sm font-medium">{m.promo.name}</span>
                      <span className="block text-xs text-muted-foreground">{m.promo.type}</span>
                    </span>
                    <ChangePill value={m.primaryChange} adjusted={m.isAdjusted} />
                  </button>
                ))}
              </div>
            )}
          </section>
          <section className="panel p-4 sm:p-5">
            <h3 className="font-display text-base font-semibold">Promotion types used</h3>
            <div className="mt-3 space-y-2">
              {types.map((t) => (
                <div key={t.type} className="flex items-center justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate">
                    {t.type} <span className="text-xs text-muted-foreground">× {t.count}</span>
                  </span>
                  <span className={cn("text-xs font-medium tabular", t.change == null ? "text-muted-foreground" : t.change >= 0 ? "text-good-ink" : "text-bad-ink")}>{pct(t.change)}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>

      {bench.length > 0 && (
        <section className="panel overflow-x-auto p-4 sm:p-5">
          <h3 className="font-display text-base font-semibold">Compared with benchmarks</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">Median per completed promo. n = number of promos behind each figure; small samples are a weak comparison.</p>
          <table className="mt-3 w-full min-w-[560px] text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr className="border-b border-border">
                <th className="py-2 pr-3 font-medium" />
                <th className="px-3 py-2 text-right font-medium">{operator}</th>
                <th className="px-3 py-2 text-right font-medium">Same markets, other operators</th>
                <th className="px-3 py-2 text-right font-medium">All other operators</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border tabular">
              {bench.map((b) => (
                <tr key={b.label}>
                  <td className="py-2.5 pr-3">{b.label}</td>
                  <BenchCell b={b} cell={b.mine} cur={cur} strong />
                  <BenchCell b={b} cell={b.market} cur={cur} />
                  <BenchCell b={b} cell={b.all} cur={cur} />
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="panel p-4 sm:p-5">
          <h3 className="flex items-center gap-2 font-display text-base font-semibold">
            <CalendarClock className="size-4 text-primary" /> Upcoming
          </h3>
          {upcoming.length ? (
            <ul className="mt-2 divide-y divide-border">
              {upcoming.map((m) => (
                <li key={m.promo.id}>
                  <button onClick={() => open(m.promo.id)} className="flex w-full items-center justify-between gap-3 py-2 text-left text-sm hover:text-primary">
                    <span>
                      {m.promo.name}
                      <span className="block text-xs text-muted-foreground">
                        {m.promo.type} · {formatRange(m.promo.startDate, m.promo.endDate)}
                      </span>
                    </span>
                    <StatusBadge status={m.status} />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">Nothing scheduled.</p>
          )}
        </section>
        <section className="panel p-4 sm:p-5">
          <div className="flex items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 font-display text-base font-semibold">
              <ListChecks className="size-4 text-primary" /> Open follow-ups
            </h3>
            <Button variant="ghost" size="sm" onClick={() => startDraft({ operator, title: "" })}>
              <BookmarkPlus className="size-3.5" /> Add
            </Button>
          </div>
          {openActions.length ? (
            <ul className="mt-2 space-y-1.5 text-sm">
              {openActions.map((a) => (
                <li key={a.id}>
                  <button onClick={() => setOpen(true)} className="text-left hover:text-primary">
                    {a.title}
                    <span className="block text-xs text-muted-foreground">{[a.owner, a.due && `due ${formatDay(a.due, true)}`].filter(Boolean).join(" · ")}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">No open follow-ups.</p>
          )}
        </section>
      </div>

      <BriefDialog operator={operator} open={briefOpen} onOpenChange={setBriefOpen} />
    </main>
  );
}

function benchHint(b: BenchmarkRow | undefined, cur?: string): string | undefined {
  if (!b || b.all.value == null) return undefined;
  const f = (v: number | null) => (b.format === "money" ? money(v, cur) : b.label.startsWith("GGR") ? pct(v) : pctPlain(v));
  return `typical promo here ${f(b.mine.value)} vs ${f(b.all.value)} for others (n=${b.all.n})`;
}

function BenchCell({ b, cell, cur, strong }: { b: BenchmarkRow; cell: { value: number | null; n: number }; cur: string; strong?: boolean }) {
  const f = b.format === "money" ? money(cell.value, cur) : b.format === "pct" ? (b.label.startsWith("GGR") ? pct(cell.value) : pctPlain(cell.value)) : num(cell.value);
  let tone = "";
  if (strong && b.higherIsBetter != null && cell.value != null && b.all.value != null) {
    const better = b.higherIsBetter ? cell.value > b.all.value : cell.value < b.all.value;
    tone = better ? "text-good-ink" : "text-bad-ink";
  }
  return (
    <td className={cn("px-3 py-2.5 text-right", strong && "font-semibold", tone)}>
      {cell.n ? f : "—"} <span className="text-[10px] font-normal text-muted-foreground">{cell.n ? `n=${cell.n}` : ""}</span>
    </td>
  );
}

function typeBreakdown(list: PromoMetrics[]) {
  const by = new Map<string, PromoMetrics[]>();
  for (const m of list) by.set(m.promo.type, [...(by.get(m.promo.type) ?? []), m]);
  return [...by.entries()].map(([type, items]) => ({ type, count: items.length, change: aggregate(items).duringVsBefore })).sort((a, b) => b.count - a.count);
}

function HistoryBars({ list, currency, onOpen }: { list: PromoMetrics[]; currency: string; onOpen: (id: string) => void }) {
  const max = Math.max(0.05, ...list.map((m) => Math.abs(m.primaryChange ?? 0)));
  if (!list.length) return <p className="text-sm text-muted-foreground">No promotions with results yet.</p>;
  return (
    <ul className="space-y-1">
      {list.map((m) => {
        const v = m.primaryChange;
        const w = v == null ? 0 : (Math.abs(v) / max) * 50;
        return (
          <li key={m.promo.id}>
            <button onClick={() => onOpen(m.promo.id)} className="grid w-full grid-cols-[minmax(0,1fr)_minmax(0,9rem)_4.5rem] items-center gap-3 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-surface-raised sm:grid-cols-[minmax(0,1fr)_minmax(0,14rem)_5rem]">
              <span className="min-w-0">
                <span className="flex items-center gap-1.5">
                  <span className="truncate text-sm font-medium">{m.promo.name}</span>
                  {m.status === "complete" ? <OutcomeChip m={m} currency={currency} className="hidden px-1.5 py-0 text-[10px] sm:inline-flex" /> : <StatusBadge status={m.status} className="px-1.5 py-0 text-[10px]" />}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {formatRange(m.promo.startDate, m.promo.endDate)} · {m.promo.type}
                  {m.participationRate != null ? ` · ${pctPlain(m.participationRate)} took part` : ""}
                </span>
              </span>
              <span className="relative h-2.5 rounded-full bg-surface-raised">
                <span className="absolute inset-y-[-3px] left-1/2 w-px bg-viz-axis" />
                {v != null && <span className="absolute inset-y-0 rounded-full" style={{ width: `${w}%`, left: v >= 0 ? "50%" : `${50 - w}%`, background: v >= 0 ? "var(--good)" : "var(--bad)" }} />}
              </span>
              <span className={cn("text-right text-sm font-semibold tabular", v == null ? "text-muted-foreground" : v >= 0 ? "text-good-ink" : "text-bad-ink")}>{pct(v)}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/* ----------------------------------------------------------------- brief */

function BriefDialog({ operator, open, onOpenChange }: { operator: string; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { metrics, dataset } = useData();
  const { actions, startDraft } = useActions();
  const [external, setExternal] = useState(false);
  const cur = dataset.currency;
  const mine = metrics.filter((m) => m.promo.operator === operator);
  const sections = operatorBrief(operator, mine, metrics, actions, cur, external);
  const text = briefText(operator, sections, external);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Meeting brief — {operator}</DialogTitle>
          <DialogDescription>Built from their promotion data with fixed rules. Read it through before sharing.</DialogDescription>
        </DialogHeader>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex rounded-md border border-border p-0.5 text-xs">
            {[false, true].map((ext) => (
              <button key={String(ext)} onClick={() => setExternal(ext)} className={cn("rounded px-2.5 py-1", external === ext ? "bg-surface-raised font-medium" : "text-muted-foreground")}>
                {ext ? "Shareable with operator" : "Internal"}
              </button>
            ))}
          </div>
          <div className="flex gap-1.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigator.clipboard.writeText(text).then(() => toast.success("Brief copied"), () => toast.error("Couldn't copy"))}
            >
              <ClipboardCopy className="size-3.5" /> Copy
            </Button>
            <Button variant="outline" size="sm" onClick={() => downloadText(`${operator.replace(/\W+/g, "-")}-${external ? "results" : "meeting-brief"}.txt`, text, "text/plain")}>
              <Download className="size-3.5" /> .txt
            </Button>
          </div>
        </div>
        {external && (
          <p className="mb-3 rounded-md border border-good/30 bg-good/5 px-3 py-2 text-xs">
            Shareable version: only {operator}'s own promotions and results — no other operators, no internal benchmarks, no internal follow-ups.
          </p>
        )}
        <div className="space-y-4">
          {sections.map((s) => (
            <section key={s.title}>
              <h3 className="text-sm font-semibold">{s.title}</h3>
              <ul className="mt-1.5 space-y-1.5 text-sm">
                {s.items.map((it) => (
                  <li key={it} className="group flex items-start gap-2">
                    <span className="mt-2 size-1 shrink-0 rounded-full bg-primary" />
                    <span className="flex-1">{it}</span>
                    {!external && s.title === "Suggested talking points" && (
                      <button
                        title="Save as follow-up action"
                        onClick={() => startDraft({ operator, title: it.replace(/\.$/, ""), notes: `From the ${operator} meeting brief.` })}
                        className="opacity-0 transition-opacity group-hover:opacity-100"
                      >
                        <BookmarkPlus className="size-3.5 text-muted-foreground hover:text-primary" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
        <p className="mt-4 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <FileText className="size-3.5" /> GGR changes are per day vs the same number of days before; observed unless marked adjusted.
          <Link to="/share/operator/$operator" params={{ operator }} className="ml-auto inline-flex items-center gap-1 text-primary hover:underline">
            Open operator report <ExternalLink className="size-3" />
          </Link>
        </p>
      </DialogContent>
    </Dialog>
  );
}
