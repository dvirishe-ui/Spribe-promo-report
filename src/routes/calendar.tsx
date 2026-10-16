import { useNavigate } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FilterLayout } from "@/components/report/ViewControls";
import { useData } from "@/lib/store";
import { useView } from "@/lib/view";
import { applyFilters } from "@/lib/filters";
import { addDays, formatRange, monthLabel, nextMonth, parseDay, prevMonth, todayIso } from "@/lib/dates";
import { STATUS_LABEL, type PromoMetrics, type PromoStatus } from "@/lib/metrics";
import { flagFor } from "@/lib/markets";
import { cn } from "@/lib/utils";
import { useState } from "react";

const STATUS_BAR: Record<PromoStatus, string> = {
  upcoming: "bg-surface-raised border-border text-foreground",
  live: "bg-primary/15 border-primary/50 text-foreground",
  measuring: "bg-accent/15 border-accent/50 text-foreground",
  complete: "bg-good/10 border-good/30 text-foreground",
};

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Monday on or before a date. */
function weekStart(iso: string): string {
  const dow = (new Date(parseDay(iso)).getUTCDay() + 6) % 7;
  return addDays(iso, -dow);
}

/**
 * Promotions on a calendar. Bars span their dates; colour = status. When one
 * operator has more than one promo on the same day, the day is marked — an
 * overlap isn't necessarily a problem, so it's shown, not flagged red.
 */
export function CalendarPage() {
  const { metrics } = useData();
  const { view } = useView();
  const navigate = useNavigate();
  const [month, setMonth] = useState(todayIso().slice(0, 7));
  const list = applyFilters(metrics, view.filters);

  const first = `${month}-01`;
  const last = addDays(`${nextMonth(month)}-01`, -1);
  const gridStart = weekStart(first);
  const weeks: string[] = [];
  for (let w = gridStart; w <= last; w = addDays(w, 7)) weeks.push(w);
  const inMonth = list.filter((m) => m.promo.startDate <= last && m.promo.endDate >= first);
  const today = todayIso();

  // Same-operator overlaps per day.
  const overlapDays = new Map<string, string[]>();
  for (let d = first; d <= last; d = addDays(d, 1)) {
    const byOp = new Map<string, number>();
    for (const m of inMonth) if (m.promo.startDate <= d && m.promo.endDate >= d) byOp.set(m.promo.operator, (byOp.get(m.promo.operator) ?? 0) + 1);
    const ops = [...byOp.entries()].filter(([, n]) => n > 1).map(([op]) => op);
    if (ops.length) overlapDays.set(d, ops);
  }

  return (
    <main className="mx-auto max-w-[1400px] space-y-4 px-4 py-5 lg:px-8">
      <div>
        <h1 className="font-display text-3xl font-bold sm:text-4xl">
          <span className="brand-gradient-text">Calendar</span>
        </h1>
        <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">Upcoming, live and completed promotions by date. Click one to open its report.</p>
      </div>

      <FilterLayout metrics={metrics} month={month} count={inMonth.length} hidePeriod>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" aria-label="Previous month" onClick={() => setMonth(prevMonth(month))}>
              <ChevronLeft className="size-4" />
            </Button>
            <Button variant="outline" size="icon" aria-label="Next month" onClick={() => setMonth(nextMonth(month))}>
              <ChevronRight className="size-4" />
            </Button>
            <h2 className="ml-1 font-display text-xl font-semibold">{monthLabel(month, "long")}</h2>
            <Button variant="ghost" size="sm" onClick={() => setMonth(today.slice(0, 7))}>
              Today
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            {(["upcoming", "live", "measuring", "complete"] as PromoStatus[]).map((s) => (
              <span key={s} className="flex items-center gap-1.5">
                <span className={cn("size-3 rounded-sm border", STATUS_BAR[s])} /> {STATUS_LABEL[s]}
              </span>
            ))}
            <span className="flex items-center gap-1.5">
              <Layers className="size-3.5 text-accent" /> Same operator overlap
            </span>
          </div>
        </div>

        <div className="panel overflow-x-auto">
          <div className="min-w-[760px]">
            <div className="grid grid-cols-7 border-b border-border text-xs text-muted-foreground">
              {WEEKDAYS.map((d) => (
                <div key={d} className="px-2 py-2">
                  {d}
                </div>
              ))}
            </div>
            {weeks.map((ws) => (
              <Week key={ws} start={ws} month={month} promos={inMonth} overlaps={overlapDays} today={today} onOpen={(id) => navigate({ to: "/promo/$promoId", params: { promoId: id } })} />
            ))}
          </div>
        </div>

        {overlapDays.size > 0 && (
          <p className="text-xs text-muted-foreground">
            Overlaps this month: {[...new Set([...overlapDays.values()].flat())].join(", ")}. Running promos side by side can be deliberate; when comparing their
            results, remember they share the same players and days.
          </p>
        )}
      </FilterLayout>
    </main>
  );
}

function Week({
  start,
  month,
  promos,
  overlaps,
  today,
  onOpen,
}: {
  start: string;
  month: string;
  promos: PromoMetrics[];
  overlaps: Map<string, string[]>;
  today: string;
  onOpen: (id: string) => void;
}) {
  const end = addDays(start, 6);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const items = promos
    .filter((m) => m.promo.startDate <= end && m.promo.endDate >= start)
    .sort((a, b) => a.promo.startDate.localeCompare(b.promo.startDate) || b.promoDays - a.promoDays);

  // Greedy lane assignment so bars never overlap visually.
  const lanes: string[][] = [];
  const placed = items.map((m) => {
    const s = m.promo.startDate < start ? start : m.promo.startDate;
    const e = m.promo.endDate > end ? end : m.promo.endDate;
    const col = Math.round((parseDay(s) - parseDay(start)) / 86_400_000);
    const span = Math.round((parseDay(e) - parseDay(s)) / 86_400_000) + 1;
    let lane = lanes.findIndex((l) => l.every((d) => d < s || d > e));
    if (lane === -1) {
      lanes.push([]);
      lane = lanes.length - 1;
    }
    for (let d = s; d <= e; d = addDays(d, 1)) lanes[lane].push(d);
    return { m, col, span, lane, clippedStart: m.promo.startDate < start, clippedEnd: m.promo.endDate > end };
  });

  return (
    <div className="relative border-b border-border last:border-b-0">
      <div className="grid grid-cols-7">
        {days.map((d) => (
          <div key={d} className={cn("min-h-24 border-r border-border px-2 py-1.5 last:border-r-0", d.slice(0, 7) !== month && "bg-surface-raised/40")}>
            <div className="flex items-center justify-between">
              <span
                className={cn(
                  "grid size-6 place-items-center rounded-full text-xs",
                  d === today ? "bg-primary font-semibold text-primary-foreground" : d.slice(0, 7) === month ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {Number(d.slice(8))}
              </span>
              {overlaps.has(d) && (
                <span title={`Overlap: ${overlaps.get(d)!.join(", ")} — not necessarily a problem`}>
                  <Layers className="size-3.5 text-accent" />
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="pointer-events-none absolute inset-x-0 top-8 grid grid-cols-7 gap-y-1 px-1" style={{ gridAutoRows: "1.6rem" }}>
        {placed.map(({ m, col, span, lane, clippedStart, clippedEnd }) => (
          <button
            key={m.promo.id}
            onClick={() => onOpen(m.promo.id)}
            title={`${m.promo.name} · ${m.promo.operator} · ${formatRange(m.promo.startDate, m.promo.endDate)} · ${STATUS_LABEL[m.status]}`}
            style={{ gridColumn: `${col + 1} / span ${span}`, gridRow: lane + 1 }}
            className={cn(
              "pointer-events-auto mx-0.5 flex min-w-0 items-center gap-1 truncate border px-1.5 text-left text-[11px] font-medium transition-transform hover:-translate-y-px hover:shadow-md",
              STATUS_BAR[m.status],
              clippedStart ? "rounded-l-none border-l-0" : "rounded-l-md",
              clippedEnd ? "rounded-r-none border-r-0" : "rounded-r-md",
            )}
          >
            {m.status === "live" && <span className="size-1.5 shrink-0 animate-pulse rounded-full bg-primary" />}
            <span className="truncate">
              {flagFor(m.promo.market)} {m.promo.name}
              <span className="font-normal text-muted-foreground"> · {m.promo.operator}</span>
            </span>
          </button>
        ))}
      </div>
      {lanes.length > 2 && <div style={{ height: `${(lanes.length - 2) * 1.75}rem` }} />}
    </div>
  );
}

