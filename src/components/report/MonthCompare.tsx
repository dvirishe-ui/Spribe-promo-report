import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { CalendarPlus, X } from "lucide-react";
import { GroupedColumns } from "@/components/charts/GroupedColumns";
import { PHASES } from "@/components/charts/core";
import { ResultTag } from "./Outcome";
import { EmptyState } from "./bits";
import type { MonthlyRecord } from "@/lib/types";
import type { PromoMetrics } from "@/lib/metrics";
import { formatMetric, rollup, type MetricFormat, type Rollup } from "@/lib/rollup";
import { monthLabel, prevMonth } from "@/lib/dates";
import { cn } from "@/lib/utils";

interface Row {
  label: string;
  format: MetricFormat;
  hint: string;
  get: (r: Rollup, list: PromoMetrics[], month: string) => number | null;
  /** "Up" isn't simply good (cost): no colour on the change */
  neutral?: boolean;
}

const done = (list: PromoMetrics[]) => list.filter((m) => m.status === "complete" && m.primaryChange != null);

/**
 * Two to four months side by side: how the promos of each month did, with the
 * change between the first and last month picked. Filters at the top apply;
 * money is summed and rates are worked out from the totals.
 */
export function MonthCompare({ all, monthly, currency, initial }: { all: PromoMetrics[]; monthly: MonthlyRecord[]; currency: string; initial: string }) {
  const months = useMemo(() => [...new Set([...all.map((m) => m.month), ...monthly.map((m) => m.month)])].sort().reverse(), [all, monthly]);
  const [picked, setPicked] = useState<string[]>(() => [prevMonth(initial), initial].filter((m) => months.includes(m)));
  const cols = [...picked].sort();
  const monthGgr = new Map(monthly.map((m) => [m.month, m.ggr]));
  const data = cols.map((mo) => {
    const list = all.filter((m) => m.month === mo);
    return { mo, list, r: rollup(list) };
  });

  const ROWS: Row[] = [
    { label: "Promotions", format: "count", hint: "Promos that started in the month", get: (r) => r.count, neutral: true },
    { label: "Total GGR (all operators)", format: "money", hint: "The month's total GGR, promos or not", get: (_r, _l, mo) => monthGgr.get(mo) ?? null },
    {
      label: "Total GGR vs previous month",
      format: "change",
      hint: "Month-over-month change of total GGR",
      get: (_r, _l, mo) => {
        const a = monthGgr.get(mo);
        const b = monthGgr.get(prevMonth(mo));
        return a != null && b ? a / b - 1 : null;
      },
    },
    { label: "Promo contribution", format: "money", hint: "Prize funds of the month's promos", get: (r) => r.contribution, neutral: true },
    { label: "GGR before", format: "money", hint: "Summed over the month's promos", get: (r) => r.before },
    { label: "GGR during", format: "money", hint: "Summed over the month's promos", get: (r) => r.during },
    { label: "GGR after", format: "money", hint: "Summed over the month's promos", get: (r) => r.after },
    { label: "During vs before", format: "change", hint: "GGR per day, weighted by each promo's baseline", get: (r) => r.dvb },
    { label: "After vs before", format: "change", hint: "Did the lift last?", get: (r) => r.avb },
    { label: "Total wager", format: "money", hint: "Wagered during the promos", get: (r) => r.wager },
    { label: "Participants", format: "count", hint: "Players who took part", get: (r) => r.participants },
    { label: "Part. rate", format: "rate", hint: "Participants ÷ active players", get: (r) => r.part },
    { label: "RTP", format: "rate", hint: "Return to player during the promos", get: (r) => r.rtp, neutral: true },
    { label: "Promo ROI", format: "roi", hint: "Extra GGR ÷ contribution", get: (r) => r.roi },
    {
      label: "Beat their baseline",
      format: "rate",
      hint: "Share of finished promos with GGR more than 3% above before",
      get: (_r, list) => {
        const d = done(list);
        return d.length ? d.filter((m) => m.primaryChange! > 0.03).length / d.length : null;
      },
    },
  ];

  const change = (row: Row, a: number | null, b: number | null): { text: string; tone: "good" | "bad" | "" } => {
    if (a == null || b == null) return { text: "—", tone: "" };
    let text: string;
    let up: number;
    if (row.format === "money" || row.format === "count") {
      if (a === 0) return { text: "—", tone: "" };
      up = b / a - 1;
      text = formatMetric("change", up, currency);
    } else if (row.format === "roi") {
      up = b - a;
      text = `${up >= 0 ? "+" : "−"}${Math.abs(up).toFixed(1)}×`;
    } else {
      up = (b - a) * 100;
      text = `${up >= 0 ? "+" : "−"}${Math.abs(up).toFixed(1)} pts`;
    }
    const flat = Math.abs(row.format === "money" || row.format === "count" ? up * 100 : row.format === "roi" ? up * 10 : up) < 0.5;
    return { text, tone: row.neutral || flat ? "" : up > 0 ? "good" : "bad" };
  };

  const setAt = (i: number, mo: string) => setPicked((p) => p.map((x, k) => (k === i ? mo : x)));
  const remove = (mo: string) => setPicked((p) => p.filter((x) => x !== mo));
  const add = () => {
    const next = months.find((m) => !picked.includes(m));
    if (next) setPicked((p) => [...p, next]);
  };
  const first = data[0];
  const last = data[data.length - 1];

  return (
    <div className="space-y-3">
      <div className="panel flex flex-wrap items-center gap-2 p-3">
        <p className="mr-1 text-sm font-semibold">Compare months</p>
        {picked.map((mo, i) => (
          <div key={`${mo}-${i}`} className="inline-flex h-8 items-center rounded-full border border-border bg-surface pl-2">
            <select aria-label={`Month ${i + 1}`} value={mo} onChange={(e) => setAt(i, e.target.value)} className="h-full bg-transparent pr-1 text-xs font-semibold outline-none">
              {months.map((m) => (
                <option key={m} value={m} disabled={m !== mo && picked.includes(m)}>
                  {monthLabel(m, "long")}
                </option>
              ))}
            </select>
            {picked.length > 2 && (
              <button aria-label={`Remove ${monthLabel(mo, "long")}`} onClick={() => remove(mo)} className="grid h-full w-7 place-items-center text-muted-foreground hover:text-foreground">
                <X className="size-3.5" />
              </button>
            )}
          </div>
        ))}
        {picked.length < 4 && months.length > picked.length && (
          <button onClick={add} className="press inline-flex h-8 items-center gap-1 rounded-full border border-dashed border-border px-2 text-xs text-muted-foreground hover:text-foreground">
            <CalendarPlus className="size-3.5" /> Add month
          </button>
        )}
        <p className="ml-auto text-[11px] text-muted-foreground">Promos are counted in the month they started. Filters above apply.</p>
      </div>

      {cols.length < 2 ? (
        <div className="panel">
          <EmptyState icon={CalendarPlus} title="Pick at least two months">
            Choose the months to put side by side.
          </EmptyState>
        </div>
      ) : (
        <>
          <div className="grid gap-3 lg:grid-cols-5">
            <div className="panel overflow-x-auto lg:col-span-3">
              <table className="w-full min-w-[480px] text-[13px]">
                <thead>
                  <tr className="border-b border-border bg-surface-raised text-[11px] text-muted-foreground">
                    <th className="px-3 py-2 text-left font-medium">Metric</th>
                    {cols.map((mo) => (
                      <th key={mo} className="px-3 py-2 text-right text-xs font-semibold text-foreground">
                        {monthLabel(mo, "long")}
                      </th>
                    ))}
                    <th className="px-3 py-2 text-right font-medium">
                      {monthLabel(last.mo)} vs {monthLabel(first.mo)}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {ROWS.map((row) => {
                    const vals = data.map((d) => row.get(d.r, d.list, d.mo));
                    const c = change(row, vals[0], vals[vals.length - 1]);
                    return (
                      <tr key={row.label} title={row.hint} className="border-t border-border/70 hover:bg-surface-raised/60">
                        <td className="whitespace-nowrap px-3 py-2 font-medium">{row.label}</td>
                        {vals.map((v, i) => (
                          <td key={cols[i]} className="px-3 py-2 text-right tabular">
                            {formatMetric(row.format, v, currency)}
                          </td>
                        ))}
                        <td className="px-3 py-1.5 text-right">
                          <span
                            className={cn(
                              "inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-[11.5px] font-medium tabular",
                              c.tone === "good" ? "bg-good/12 text-good-ink" : c.tone === "bad" ? "bg-bad/12 text-bad-ink" : "bg-muted text-muted-foreground",
                            )}
                          >
                            {c.text}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="panel min-w-0 p-3 lg:col-span-2">
              <p className="text-sm font-semibold">Promo GGR by month</p>
              <p className="mb-2 text-[11px] text-muted-foreground">Before · During · After, summed over each month's promos</p>
              <GroupedColumns
                categories={data.map((d) => ({ key: d.mo, label: monthLabel(d.mo), values: { before: d.r.before, during: d.r.during, after: d.r.after } }))}
                series={PHASES.map((p) => ({ key: p.key, label: p.label, color: p.color }))}
                format={(v) => formatMetric("money", v, currency)}
                formatFull={(v) => formatMetric("money", v, currency, true)}
                height={230}
              />
            </div>
          </div>

          <div className={cn("grid gap-3", cols.length === 2 ? "md:grid-cols-2" : cols.length === 3 ? "md:grid-cols-3" : "md:grid-cols-2 xl:grid-cols-4")}>
            {data.map((d) => (
              <div key={d.mo} className="panel p-3">
                <p className="mb-1.5 flex items-baseline justify-between text-sm font-semibold">
                  {monthLabel(d.mo, "long")} <span className="text-xs font-normal text-muted-foreground">{d.list.length} promos</span>
                </p>
                {d.list.length ? (
                  <ul className="divide-y divide-border/70">
                    {[...d.list]
                      .sort((a, b) => (b.primaryChange ?? -Infinity) - (a.primaryChange ?? -Infinity))
                      .map((m) => (
                        <li key={m.promo.id}>
                          <Link to="/promo/$promoId" params={{ promoId: m.promo.id }} className="-mx-1.5 flex items-center justify-between gap-2 rounded px-1.5 py-1.5 text-xs hover:bg-surface-raised">
                            <span className="min-w-0">
                              <span className="block truncate font-medium">{m.promo.name}</span>
                              <span className="block truncate text-[11px] text-muted-foreground">{m.promo.operator}</span>
                            </span>
                            <span className="flex shrink-0 items-center gap-2">
                              <span className="tabular">{formatMetric("change", m.primaryChange, currency)}</span>
                              <ResultTag m={m} currency={currency} showLabel={false} />
                            </span>
                          </Link>
                        </li>
                      ))}
                  </ul>
                ) : (
                  <p className="py-4 text-center text-xs text-muted-foreground">No promos started this month.</p>
                )}
              </div>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground">
            GGR changes are observed (before vs during, per day), not adjusted for the market trend. Different months have different promos and markets, so
            this is context, not a like-for-like test.
          </p>
        </>
      )}
    </div>
  );
}
