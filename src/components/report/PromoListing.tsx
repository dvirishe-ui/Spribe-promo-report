import { ArrowRight, Share2, X } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChangePill, ResultPill, StatusBadge } from "@/components/report/bits";
import { OutcomeChip } from "@/components/report/ResultHero";
import { DIMENSION_LABEL, displayKey, groupBy, type Dimension } from "@/components/report/ResultsBy";
import { GroupedColumns } from "@/components/charts/GroupedColumns";
import { PHASES } from "@/components/charts/core";
import { aggregate, type PromoMetrics } from "@/lib/metrics";
import { formatRange, monthLabel } from "@/lib/dates";
import { marketLabel } from "@/lib/markets";
import { money, moneyFull, pct } from "@/lib/format";
import { periodSummary, type OutcomeTone } from "@/lib/verdict";
import { cn } from "@/lib/utils";

/*
 * Pieces shared by Overview, Promotions and Calendar: active-filter chips,
 * the before/during/after chart, the promo list and the period outcome line.
 */

export type SortKey = "newest" | "change" | "ggr" | "name";
export type GroupKey = "none" | Dimension;

export function BeforeDuringAfter({
  list,
  byMonth,
  currency,
  onSelect,
  onMonth,
}: {
  list: PromoMetrics[];
  byMonth: boolean;
  currency: string;
  onSelect: (id: string) => void;
  onMonth: (m: string) => void;
}) {
  const series = PHASES.map((p) => ({ key: p.key, label: p.label, color: p.color }));
  if (byMonth) {
    const months = [...new Set(list.map((m) => m.month))].sort().slice(-8);
    return (
      <GroupedColumns
        series={series}
        categories={months.map((mo) => {
          const a = aggregate(list.filter((m) => m.month === mo));
          return {
            key: mo,
            label: monthLabel(mo, "short", false),
            values: { before: a.ggrBefore, during: a.ggrDuring, after: a.ggrAfter },
            extra: [
              { label: "Promos", value: String(a.count) },
              { label: "During vs before", value: pct(a.duringVsBefore) },
            ],
          };
        })}
        format={(v) => money(v, currency)}
        formatFull={(v) => moneyFull(v, currency)}
        onSelect={onMonth}
        height={250}
      />
    );
  }
  const top = [...list].sort((a, b) => (b.ggrDuring ?? 0) - (a.ggrDuring ?? 0)).slice(0, 8);
  return (
    <>
      <GroupedColumns
        series={series}
        categories={top
          .sort((a, b) => a.promo.startDate.localeCompare(b.promo.startDate))
          .map((m) => ({
            key: m.promo.id,
            label: m.promo.name,
            values: { before: m.ggrBefore, during: m.ggrDuring, after: m.ggrAfter },
            extra: [
              { label: "During vs before", value: pct(m.duringVsBefore) },
              { label: "After vs before", value: pct(m.afterVsBefore) },
            ],
          }))}
        format={(v) => money(v, currency)}
        formatFull={(v) => moneyFull(v, currency)}
        onSelect={onSelect}
        height={250}
      />
      {list.length > 8 && <p className="mt-2 text-xs text-muted-foreground">Showing the 8 biggest promos — all of them are in the list below.</p>}
    </>
  );
}

export function sortList(list: PromoMetrics[], sort: SortKey): PromoMetrics[] {
  const out = [...list];
  if (sort === "newest") out.sort((a, b) => b.promo.startDate.localeCompare(a.promo.startDate));
  if (sort === "change") out.sort((a, b) => (b.primaryChange ?? -Infinity) - (a.primaryChange ?? -Infinity));
  if (sort === "ggr") out.sort((a, b) => (b.ggrDuring ?? -Infinity) - (a.ggrDuring ?? -Infinity));
  if (sort === "name") out.sort((a, b) => a.promo.name.localeCompare(b.promo.name));
  return out;
}

export function PromoList({
  list,
  outcome,
  onClearOutcome,
  currency,
  group,
  sort,
  onGroup,
  onSort,
  onSelect,
}: {
  list: PromoMetrics[];
  outcome: OutcomeTone | null;
  onClearOutcome: () => void;
  currency: string;
  group: GroupKey;
  sort: SortKey;
  onGroup: (g: GroupKey) => void;
  onSort: (s: SortKey) => void;
  onSelect: (id: string) => void;
}) {
  const sections =
    group === "none"
      ? [{ key: "", items: sortList(list, sort), agg: null }]
      : groupBy(list, group)
          .sort((a, b) => b.agg.ggrDuring - a.agg.ggrDuring)
          .map((g) => ({ key: g.key, items: sortList(g.items, sort), agg: g.agg }));

  return (
    <section id="promo-list" className="scroll-mt-24">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-display text-base font-semibold">
          Promos
          {outcome && (
            <button onClick={onClearOutcome} className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-xs font-normal hover:bg-primary/20">
              only “{OUTCOME_FILTER_LABEL[outcome]}” <X className="size-3" />
            </button>
          )}
        </h3>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-muted-foreground">Group by</span>
          <Select value={group} onValueChange={(v) => onGroup(v as GroupKey)}>
            <SelectTrigger className="h-8 w-36 text-xs" aria-label="Group by">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Nothing</SelectItem>
              {(Object.keys(DIMENSION_LABEL) as Dimension[]).map((d) => (
                <SelectItem key={d} value={d}>
                  {DIMENSION_LABEL[d]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-muted-foreground">Sort</span>
          <Select value={sort} onValueChange={(v) => onSort(v as SortKey)}>
            <SelectTrigger className="h-8 w-36 text-xs" aria-label="Sort by">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest first</SelectItem>
              <SelectItem value="change">Biggest change</SelectItem>
              <SelectItem value="ggr">Highest GGR</SelectItem>
              <SelectItem value="name">Name A–Z</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {list.length === 0 ? (
        <div className="panel p-8 text-center text-sm text-muted-foreground">No promos match.</div>
      ) : (
        <div className="space-y-3">
          {sections.map((s) => (
            <div key={s.key || "all"} className="panel overflow-hidden">
              {group !== "none" && s.agg && (
                <div className="flex items-center justify-between gap-3 border-b border-border bg-surface-raised/60 px-4 py-2">
                  <p className="text-sm font-semibold">
                    {displayKey(s.key, group)}{" "}
                    <span className="font-normal text-muted-foreground">
                      · {s.agg.count} promo{s.agg.count === 1 ? "" : "s"} · {money(s.agg.ggrDuring, currency)} during
                    </span>
                  </p>
                  <ResultPill value={s.agg.duringVsBefore} />
                </div>
              )}
              <div className="divide-y divide-border">
                {s.items.map((m) => (
                  <PromoRow key={m.promo.id} m={m} currency={currency} onSelect={onSelect} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      <p className="mt-2 text-xs text-muted-foreground">
        Numbers are GGR before → during → after. The % is the GGR change: “adj.” when adjusted for the market trend, “raw” when it's
        a before/during comparison only. Click a promo for its full report.
      </p>
    </section>
  );
}

export function PromoRow({ m, currency, onSelect }: { m: PromoMetrics; currency: string; onSelect: (id: string) => void }) {
  const p = m.promo;
  const stripe = m.primaryChange == null ? "var(--color-border)" : m.primaryChange >= 0 ? "var(--good)" : "var(--bad)";
  return (
    <button
      onClick={() => onSelect(p.id)}
      className="flex w-full flex-col gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-raised sm:flex-row sm:items-center sm:justify-between"
      style={{ borderLeft: `3px solid color-mix(in oklch, ${stripe} 70%, transparent)` }}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate font-display text-sm font-semibold">{p.name}</p>
          <span className="rounded-full border border-border px-2 py-px text-[10.5px] text-muted-foreground">{p.type}</span>
          {m.status === "complete" ? <OutcomeChip m={m} currency={currency} /> : <StatusBadge status={m.status} />}
        </div>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {[p.market && marketLabel(p.market), p.operator, p.aggregator, formatRange(p.startDate, p.endDate)].filter(Boolean).join(" · ")}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-3 sm:gap-5">
        <div className="flex items-center gap-1.5 text-xs tabular text-muted-foreground">
          <span>{money(m.ggrBefore, currency)}</span>
          <ArrowRight className="size-3" />
          <span className="font-medium text-foreground">{money(m.ggrDuring, currency)}</span>
          <ArrowRight className="size-3" />
          <span>{money(m.ggrAfter, currency)}</span>
        </div>
        <ChangePill value={m.primaryChange} adjusted={m.isAdjusted} className="min-w-[6.5rem] justify-end" />
        <ArrowRight className="hidden size-4 text-muted-foreground sm:block" />
      </div>
    </button>
  );
}

export function MenuItem({ icon: Icon, label, hint, onClick }: { icon: typeof Share2; label: string; hint: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex w-full items-start gap-2.5 rounded-md px-2.5 py-2 text-left hover:bg-surface-raised">
      <Icon className="mt-0.5 size-4 text-muted-foreground" />
      <span>
        <span className="block text-sm">{label}</span>
        <span className="block text-[11px] text-muted-foreground">{hint}</span>
      </span>
    </button>
  );
}

const OUTCOME_FILTER_LABEL: Record<OutcomeTone, string> = {
  good: "raised GGR and paid back",
  mixed: "didn't pay back",
  neutral: "no clear effect",
  bad: "GGR fell",
  pending: "still being measured",
};

const OUTCOME_DOT: Record<OutcomeTone, string> = {
  good: "bg-good",
  mixed: "bg-accent",
  neutral: "bg-muted-foreground",
  bad: "bg-bad",
  pending: "bg-primary",
};

/** The period in one sentence, with each outcome count clickable to filter the list. */
export function PeriodVerdict({
  list,
  currency,
  period,
  active,
  onPick,
}: {
  list: PromoMetrics[];
  currency: string;
  period: string;
  active: OutcomeTone | null;
  onPick: (t: OutcomeTone) => void;
}) {
  const { total, parts } = periodSummary(list, currency);
  return (
    <section className="brand-surface rounded-2xl p-4 sm:p-5">
      <p className="text-eyebrow">How the promos went</p>
      <p className="mt-1.5 font-display text-xl font-semibold leading-snug sm:text-2xl">
        {period === "All months" ? "Overall" : `In ${period}`}, {total} promo{total === 1 ? "" : "s"} ran.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {parts.map((pt) => (
          <button
            key={pt.tone}
            onClick={() => onPick(pt.tone)}
            className={cn(
              "inline-flex items-center gap-2 rounded-full border bg-surface px-3 py-1.5 text-sm transition-colors hover:border-primary/60",
              active === pt.tone ? "border-primary ring-2 ring-primary/30" : "border-border",
            )}
          >
            <span className={cn("size-2.5 rounded-full", OUTCOME_DOT[pt.tone])} />
            <span>
              <strong className="font-semibold">{pt.text.split(" ")[0]}</strong> {pt.text.split(" ").slice(1).join(" ")}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
