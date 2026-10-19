import { Fragment, useMemo, useState } from "react";
import { ArrowDown, ArrowRight, ArrowUp, Check, ChevronDown } from "lucide-react";
import { ChangePill, StatusBadge } from "./bits";
import { MissingDataMark, ResultTag } from "./Outcome";
import type { PromoMetrics } from "@/lib/metrics";
import { formatRange } from "@/lib/dates";
import { flagFor } from "@/lib/markets";
import { money, multiple, num, pct, pctPlain } from "@/lib/format";
import { outcomeFor, TONE_ORDER } from "@/lib/verdict";
import { cn } from "@/lib/utils";

type Col = "name" | "operator" | "market" | "date" | "change" | "part" | "result" | "status";

const STATUS_RANK = { live: 0, measuring: 1, complete: 2, upcoming: 3 } as const;

/**
 * The main promotion list: one compact row per promo — name, operator,
 * market, dates, GGR change, participation, result and status. Sort by any
 * column, tick rows to compare them, click a row to open its report, or
 * expand it for a quick summary without leaving the page.
 */
export function PromoTable({
  list,
  currency,
  selected,
  onToggle,
  onOpen,
  limit = 10,
  title = "Promotions",
}: {
  list: PromoMetrics[];
  currency: string;
  selected: string[];
  onToggle: (id: string) => void;
  onOpen: (id: string) => void;
  limit?: number;
  title?: string;
}) {
  const [sort, setSort] = useState<{ col: Col; dir: 1 | -1 }>({ col: "date", dir: -1 });
  const [open, setOpen] = useState<string | null>(null);
  const [all, setAll] = useState(false);

  const sorted = useMemo(() => {
    const val: Record<Col, (m: PromoMetrics) => number | string | null> = {
      name: (m) => m.promo.name.toLowerCase(),
      operator: (m) => m.promo.operator.toLowerCase(),
      market: (m) => m.promo.market,
      date: (m) => m.promo.startDate,
      change: (m) => m.primaryChange,
      part: (m) => m.participationRate,
      result: (m) => TONE_ORDER.indexOf(outcomeFor(m, currency).tone),
      status: (m) => STATUS_RANK[m.status],
    };
    const f = val[sort.col];
    return [...list].sort((a, b) => {
      const x = f(a);
      const y = f(b);
      if (x == null) return 1;
      if (y == null) return -1;
      return (typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y))) * sort.dir;
    });
  }, [list, sort, currency]);
  const rows = all ? sorted : sorted.slice(0, limit);

  const th = (col: Col, label: string, className?: string) => (
    <th className={cn("px-2 py-2 font-medium", className)}>
      <button
        onClick={() => setSort((s) => ({ col, dir: s.col === col ? ((-s.dir) as 1 | -1) : col === "name" || col === "operator" || col === "market" || col === "result" || col === "status" ? 1 : -1 }))}
        className={cn("inline-flex items-center gap-0.5 hover:text-foreground", sort.col === col && "text-foreground")}
      >
        {label}
        {sort.col === col && (sort.dir === 1 ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />)}
      </button>
    </th>
  );
  const allOn = rows.length > 0 && rows.every((m) => selected.includes(m.promo.id));

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">
          {title} <span className="font-normal text-muted-foreground">· {list.length}</span>
        </h3>
        <span className="text-[11px] text-muted-foreground">Tick to compare · click to open · ⌄ for a quick look</span>
      </div>
      <div className="panel overflow-hidden">
        <table className="w-full table-fixed text-sm">
          <colgroup>
            <col className="w-8" />
            <col />
            <col className="hidden w-[13%] md:table-column" />
            <col className="hidden w-[10%] lg:table-column" />
            <col className="hidden w-[13%] md:table-column" />
            <col className="w-[5.75rem] sm:w-[7.5rem]" />
            <col className="hidden w-[6.5rem] sm:table-column" />
            <col className="w-8 sm:w-[6.5rem]" />
            <col className="hidden w-[7rem] lg:table-column" />
            <col className="w-8" />
          </colgroup>
          <thead>
            <tr className="border-b border-border bg-surface-raised text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="px-2 py-2">
                <button
                  aria-label={allOn ? "Deselect shown promos" : "Select shown promos"}
                  onClick={() => rows.forEach((m) => (allOn ? selected.includes(m.promo.id) : !selected.includes(m.promo.id)) && onToggle(m.promo.id))}
                  className={cn("grid size-4 place-items-center rounded border", allOn ? "border-primary bg-primary text-primary-foreground" : "border-border")}
                >
                  {allOn && <Check className="size-3" />}
                </button>
              </th>
              {th("name", "Promotion")}
              {th("operator", "Operator", "hidden md:table-cell")}
              {th("market", "Market", "hidden lg:table-cell")}
              {th("date", "Date", "hidden md:table-cell")}
              {th("change", "GGR change", "text-right")}
              {th("part", "Part.", "hidden text-right sm:table-cell")}
              {th("result", "Result")}
              {th("status", "Status", "hidden lg:table-cell")}
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((m) => {
              const on = selected.includes(m.promo.id);
              const isOpen = open === m.promo.id;
              return (
                <Fragment key={m.promo.id}>
                  <tr
                    onClick={() => onOpen(m.promo.id)}
                    className={cn("cursor-pointer border-b border-border/70 transition-colors hover:bg-surface-raised", on && "bg-primary/[0.06]", isOpen && "bg-surface-raised")}
                  >
                    <td className="px-2 py-1.5">
                      <button
                        aria-label={on ? `Deselect ${m.promo.name}` : `Select ${m.promo.name} to compare`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggle(m.promo.id);
                        }}
                        className={cn("grid size-4 place-items-center rounded border", on ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-primary/60")}
                      >
                        {on && <Check className="size-3" />}
                      </button>
                    </td>
                    <td className="min-w-0 px-2 py-1">
                      <p className="flex items-center gap-1.5 leading-tight">
                        <span className="truncate font-medium" title={m.promo.name}>
                          {m.promo.name}
                        </span>
                        <MissingDataMark m={m} />
                      </p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {m.promo.type}
                        <span className="md:hidden"> · {m.promo.operator}</span>
                      </p>
                    </td>
                    <td className="hidden truncate px-2 py-1.5 text-xs text-muted-foreground md:table-cell">{m.promo.operator}</td>
                    <td className="hidden truncate px-2 py-1.5 text-xs text-muted-foreground lg:table-cell" title={m.promo.market}>
                      {flagFor(m.promo.market)} {m.promo.market}
                    </td>
                    <td className="hidden truncate px-2 py-1.5 text-xs text-muted-foreground md:table-cell">{formatRange(m.promo.startDate, m.promo.endDate)}</td>
                    <td className="px-2 py-1.5 text-right">
                      {m.primaryChange == null ? <span className="text-xs text-muted-foreground">—</span> : <ChangePill value={m.primaryChange} adjusted={m.isAdjusted} className="justify-end" compact />}
                    </td>
                    <td className="hidden px-2 py-1.5 text-right text-xs tabular sm:table-cell">{m.participationRate == null ? "—" : pctPlain(m.participationRate, 1)}</td>
                    <td className="px-2 py-1.5">
                      <ResultTag m={m} currency={currency} />
                    </td>
                    <td className="hidden px-2 py-1.5 lg:table-cell">
                      <StatusBadge status={m.status} className="px-1.5 py-0 text-[10px]" />
                    </td>
                    <td className="px-1 py-1.5">
                      <button
                        aria-label={isOpen ? "Hide quick look" : "Quick look"}
                        aria-expanded={isOpen}
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpen(isOpen ? null : m.promo.id);
                        }}
                        className="grid size-6 place-items-center rounded text-muted-foreground hover:bg-surface hover:text-foreground"
                      >
                        <ChevronDown className={cn("size-4 transition-transform", isOpen && "rotate-180")} />
                      </button>
                    </td>
                  </tr>
                  {isOpen && (
                    <tr className="border-b border-border/70 bg-surface-raised/50">
                      <td colSpan={10} className="px-3 py-3">
                        <QuickLook m={m} currency={currency} selected={on} onToggle={() => onToggle(m.promo.id)} onOpen={() => onOpen(m.promo.id)} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
        {sorted.length > limit && (
          <button onClick={() => setAll((v) => !v)} className="w-full border-t border-border py-1.5 text-xs text-primary hover:bg-surface-raised">
            {all ? "Show fewer" : `Show all ${sorted.length}`}
          </button>
        )}
      </div>
    </div>
  );
}

function QuickLook({ m, currency, selected, onToggle, onOpen }: { m: PromoMetrics; currency: string; selected: boolean; onToggle: () => void; onOpen: () => void }) {
  const o = outcomeFor(m, currency);
  const cells: Array<[string, string]> = [
    ["GGR before", money(m.ggrBefore, currency)],
    ["GGR during", money(m.ggrDuring, currency)],
    ["GGR after", money(m.ggrAfter, currency)],
    ["After vs before", pct(m.afterVsBefore)],
    ["Players", num(m.participants)],
    ["Total wager", money(m.turnoverDuring, currency)],
    ["Contribution", money(m.promo.prizePool, currency)],
    ["Promo ROI", multiple(m.promoRoi)],
  ];
  return (
    <div className="space-y-2.5">
      <p className="text-sm">
        <span className="font-medium">{o.headline}.</span> <span className="text-muted-foreground">{o.sub}</span>
      </p>
      <div className="grid grid-cols-4 gap-x-4 gap-y-1.5 lg:grid-cols-8">
        {cells.map(([k, v]) => (
          <div key={k}>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{k}</p>
            <p className="text-sm font-semibold tabular">{v}</p>
          </div>
        ))}
      </div>
      {m.quality.missing.length > 0 && m.status !== "upcoming" && <p className="text-[11px] text-muted-foreground">Missing: {m.quality.missing.join(", ")}.</p>}
      <div className="flex gap-2">
        <button onClick={onOpen} className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground">
          Open report <ArrowRight className="size-3" />
        </button>
        <button onClick={onToggle} className="rounded-md border border-border px-2.5 py-1 text-xs hover:bg-surface">
          {selected ? "Remove from comparison" : "Add to comparison"}
        </button>
      </div>
    </div>
  );
}
