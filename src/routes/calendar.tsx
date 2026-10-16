import { useMemo } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { ArrowRight, ChevronLeft, ChevronRight, ExternalLink, Globe2, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FilterLayout } from "@/components/report/ViewControls";
import { CalendarDetail } from "@/components/report/CalendarDetail";
import { TypeBadge, typeStyle } from "@/components/report/PromoType";
import { ChangePill, StatusBadge } from "@/components/report/bits";
import { useData } from "@/lib/store";
import { useView } from "@/lib/view";
import { applyFilters, type FilterState } from "@/lib/filters";
import { addDays, formatDay, formatRange, monthLabel, nextMonth, parseDay, prevMonth, todayIso } from "@/lib/dates";
import { STATUS_LABEL, median, type PromoMetrics, type PromoStatus } from "@/lib/metrics";
import { CALENDAR_CAMPAIGNS, CALENDAR_SITE_URL, type CalendarCampaign } from "@/lib/campaigns";
import { campaignRollup } from "@/lib/history";
import { flagFor } from "@/lib/markets";
import { num, pct } from "@/lib/format";
import { cn } from "@/lib/utils";

/** One entry on the calendar: an operator promo, or a network campaign from the Promo Calendar. */
export interface CalItem {
  key: string;
  name: string;
  type: string;
  start: string;
  end: string;
  status: PromoStatus;
  /** Operator, or "Network · 3 operators" */
  sub: string;
  flag: string;
  change: number | null;
  adjusted: boolean;
  m?: PromoMetrics;
  campaign?: CalendarCampaign;
  /** Operator records linked to a campaign */
  linked: PromoMetrics[];
}

type CalView = "month" | "week" | "list";
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Monday on or before a date. */
function weekStart(iso: string): string {
  const dow = (new Date(parseDay(iso)).getUTCDay() + 6) % 7;
  return addDays(iso, -dow);
}

function campaignItem(c: CalendarCampaign, linked: PromoMetrics[]): CalItem {
  const r = campaignRollup(c, linked);
  const ops = new Set(linked.map((m) => m.promo.operator)).size;
  return {
    key: `c:${c.id}`,
    name: c.name,
    type: c.type,
    start: c.start,
    end: c.end,
    status: r.status,
    sub: c.eventLinked ? "Network · specifics TBD" : `Network${ops ? ` · ${ops} operator${ops === 1 ? "" : "s"}` : ""}`,
    flag: "🌐",
    change: r.status === "complete" || r.status === "measuring" ? r.change : null,
    adjusted: false,
    campaign: c,
    linked,
  };
}

function promoItem(m: PromoMetrics): CalItem {
  return {
    key: m.promo.id,
    name: m.promo.name,
    type: m.promo.type,
    start: m.promo.startDate,
    end: m.promo.endDate,
    status: m.status,
    sub: m.promo.operator,
    flag: flagFor(m.promo.market),
    change: m.status === "complete" || m.status === "measuring" ? m.primaryChange : null,
    adjusted: m.isAdjusted,
    m,
    linked: [],
  };
}

/**
 * Operator promos and the Promo Calendar's network campaigns, campaign-first.
 * When filters narrow to an operator, market or aggregator, a campaign only
 * shows if one of its matching operator records does.
 */
function buildItems(metrics: PromoMetrics[], f: FilterState): CalItem[] {
  const passing = applyFilters(metrics, f);
  const narrowed = f.operator !== "all" || f.market !== "all" || f.aggregator !== "all";
  const q = f.q.trim().toLowerCase();
  const items: CalItem[] = [];
  for (const c of CALENDAR_CAMPAIGNS) {
    const linked = passing.filter((m) => m.promo.calendarId === c.id);
    if (f.type !== "all" && c.type !== f.type) continue;
    if (f.game !== "all" && !c.games.includes(f.game)) continue;
    if (narrowed && !linked.length) continue;
    if (q && !linked.length && ![c.name, c.type, c.region, ...c.games, ...c.countries].join(" ").toLowerCase().includes(q)) continue;
    items.push(campaignItem(c, linked));
  }
  for (const m of passing) if (!m.promo.calendarId || !CALENDAR_CAMPAIGNS.some((c) => c.id === m.promo.calendarId)) items.push(promoItem(m));
  return items.sort((a, b) => a.start.localeCompare(b.start) || b.end.localeCompare(a.end));
}

export function CalendarPage() {
  const { metrics } = useData();
  const { view } = useView();
  const search = useSearch({ from: "/calendar" });
  const navigate = useNavigate({ from: "/calendar" });
  const today = todayIso();
  const calView: CalView = search.view === "week" || search.view === "list" ? search.view : "month";
  const month = search.month && /^\d{4}-\d{2}$/.test(search.month) ? search.month : today.slice(0, 7);
  // Week view: an explicit ?week=, else the week of today (or of the 1st of the month being viewed).
  const weekFrom =
    search.week && /^\d{4}-\d{2}-\d{2}$/.test(search.week)
      ? weekStart(search.week)
      : search.month && search.month !== today.slice(0, 7)
        ? weekStart(`${month}-01`)
        : weekStart(today);

  const items = useMemo(() => buildItems(metrics, view.filters), [metrics, view.filters]);
  const opened = search.open ? items.find((i) => i.key === search.open) : undefined;

  function go(patch: { view?: string; month?: string; week?: string; open?: string }) {
    navigate({ search: (s) => ({ ...s, ...patch }), replace: true });
  }

  const first = `${month}-01`;
  const last = addDays(`${nextMonth(month)}-01`, -1);
  const range = calView === "week" ? { from: weekFrom, to: addDays(weekFrom, 6) } : { from: first, to: last };
  const inRange = items.filter((i) => i.start <= range.to && i.end >= range.from);
  const weeks: string[] = [];
  if (calView === "month") for (let w = weekStart(first); w <= last; w = addDays(w, 7)) weeks.push(w);
  else if (calView === "week") weeks.push(weekFrom);

  // Same-operator overlaps per day, over every operator record (campaign entries included).
  const overlapDays = useMemo(() => {
    const out = new Map<string, string[]>();
    const list = applyFilters(metrics, view.filters).filter((m) => m.promo.startDate <= range.to && m.promo.endDate >= range.from);
    for (let d = range.from; d <= range.to; d = addDays(d, 1)) {
      const byOp = new Map<string, number>();
      for (const m of list) if (m.promo.startDate <= d && m.promo.endDate >= d) byOp.set(m.promo.operator, (byOp.get(m.promo.operator) ?? 0) + 1);
      const ops = [...byOp.entries()].filter(([, n]) => n > 1).map(([op]) => op);
      if (ops.length) out.set(d, ops);
    }
    return out;
  }, [metrics, view.filters, range.from, range.to]);

  const shown = calView === "list" ? items : inRange;
  const finished = shown.filter((i) => i.status === "complete" && i.change != null);
  const typical = median(finished.map((i) => i.change!));
  const coming = shown.filter((i) => i.status === "upcoming" || i.status === "live").length;
  const types = [...new Set(shown.map((i) => i.type))];

  const step = (dir: 1 | -1) => {
    if (calView === "week") {
      const w = addDays(weekFrom, dir * 7);
      go({ week: w, month: w.slice(0, 7) });
    }
    else go({ month: dir === 1 ? nextMonth(month) : prevMonth(month) });
  };
  const title =
    calView === "list" ? "All promotions" : calView === "week" ? `Week of ${formatDay(weekFrom, true)}` : monthLabel(month, "long");

  return (
    <main className="mx-auto max-w-[1400px] space-y-4 px-4 py-5 lg:px-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold sm:text-4xl">
            <span className="brand-gradient-text">Promo Calendar</span>
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">
            Network campaigns from the Promo Calendar and every operator promo, with how the past ones went. Click one for details and similar past promos.
          </p>
        </div>
        <Button asChild variant="outline">
          <a href={CALENDAR_SITE_URL} target="_blank" rel="noopener noreferrer">
            Full calendar site <ExternalLink className="ml-1.5 size-4" />
          </a>
        </Button>
      </div>

      <FilterLayout metrics={metrics} month={month} count={shown.length} hidePeriod>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {calView !== "list" && (
              <>
                <Button variant="outline" size="icon" aria-label="Previous" onClick={() => step(-1)}>
                  <ChevronLeft className="size-4" />
                </Button>
                <Button variant="outline" size="icon" aria-label="Next" onClick={() => step(1)}>
                  <ChevronRight className="size-4" />
                </Button>
              </>
            )}
            <h2 className="ml-1 font-display text-xl font-semibold">{title}</h2>
            {calView !== "list" && (
              <Button variant="ghost" size="sm" onClick={() => go({ month: undefined, week: undefined })}>
                Today
              </Button>
            )}
          </div>
          <Tabs value={calView} onValueChange={(v) => go({ view: v === "month" ? undefined : v, open: undefined })}>
            <TabsList>
              <TabsTrigger value="month">Month</TabsTrigger>
              <TabsTrigger value="week">Week</TabsTrigger>
              <TabsTrigger value="list">List</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{shown.length}</span> promotion{shown.length === 1 ? "" : "s"}
          {finished.length > 0 && (
            <>
              {" · "}
              <span className="font-medium text-foreground">{finished.length}</span> finished, typical GGR change{" "}
              <span className={cn("font-medium", (typical ?? 0) >= 0 ? "text-good-ink" : "text-bad-ink")}>{pct(typical)}</span> (median)
            </>
          )}
          {coming > 0 && (
            <>
              {" · "}
              <span className="font-medium text-foreground">{coming}</span> live or coming up
            </>
          )}
        </p>

        {calView === "list" ? (
          <ListView items={items} onOpen={(k) => go({ open: k })} />
        ) : (
          <div className="panel overflow-x-auto">
            <div className="min-w-[760px]">
              <div className="grid grid-cols-7 border-b border-border bg-surface-raised text-eyebrow">
                {WEEKDAYS.map((d) => (
                  <div key={d} className="px-2 py-2 text-center">
                    {d}
                  </div>
                ))}
              </div>
              {weeks.map((ws) => (
                <Week
                  key={ws}
                  start={ws}
                  month={calView === "month" ? month : null}
                  items={inRange}
                  overlaps={overlapDays}
                  today={today}
                  tall={calView === "week"}
                  onOpen={(k) => go({ open: k })}
                />
              ))}
            </div>
          </div>
        )}

        {calView !== "list" && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
            {types.map((t) => (
              <span key={t} className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-sm" style={{ background: typeStyle(t).color }} /> {t}
              </span>
            ))}
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-4 rounded-sm border border-dashed border-muted-foreground" /> Coming up
            </span>
            <span className="flex items-center gap-1.5">
              <Globe2 className="size-3.5" /> Network campaign
            </span>
            <span className="flex items-center gap-1.5">
              <Layers className="size-3.5 text-accent" /> Same operator overlap
            </span>
          </div>
        )}

        {calView !== "list" && overlapDays.size > 0 && (
          <p className="text-xs text-muted-foreground">
            Overlaps: {[...new Set([...overlapDays.values()].flat())].join(", ")}. Running promos side by side can be deliberate; when comparing their results, remember they
            share the same players and days.
          </p>
        )}
      </FilterLayout>

      <Sheet open={!!opened} onOpenChange={(o) => !o && go({ open: undefined })}>
        <SheetContent className="w-full overflow-y-auto border-border bg-surface sm:max-w-xl">
          <SheetTitle className="sr-only">{opened?.name ?? "Promotion"}</SheetTitle>
          {opened && <CalendarDetail item={opened} all={metrics} onOpen={(k) => go({ open: k })} />}
        </SheetContent>
      </Sheet>
    </main>
  );
}

function Week({
  start,
  month,
  items,
  overlaps,
  today,
  tall,
  onOpen,
}: {
  start: string;
  /** Month being shown; days outside it are dimmed. Null in week view. */
  month: string | null;
  items: CalItem[];
  overlaps: Map<string, string[]>;
  today: string;
  tall: boolean;
  onOpen: (key: string) => void;
}) {
  const end = addDays(start, 6);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const inWeek = items.filter((i) => i.start <= end && i.end >= start);

  // Greedy lane assignment so bars never overlap visually.
  const lanes: string[][] = [];
  const placed = inWeek.map((it) => {
    const s = it.start < start ? start : it.start;
    const e = it.end > end ? end : it.end;
    const col = Math.round((parseDay(s) - parseDay(start)) / 86_400_000);
    const span = Math.round((parseDay(e) - parseDay(s)) / 86_400_000) + 1;
    let lane = lanes.findIndex((l) => l.every((d) => d < s || d > e));
    if (lane === -1) {
      lanes.push([]);
      lane = lanes.length - 1;
    }
    for (let d = s; d <= e; d = addDays(d, 1)) lanes[lane].push(d);
    return { it, col, span, lane, clippedStart: it.start < start, clippedEnd: it.end > end };
  });
  const rowH = tall ? 2.6 : 1.6;
  const base = tall ? 10 : 2;

  return (
    <div className="relative border-b border-border last:border-b-0">
      <div className="grid grid-cols-7">
        {days.map((d) => (
          <div
            key={d}
            className={cn("border-r border-border px-2 py-1.5 last:border-r-0", tall ? "min-h-64" : "min-h-24", month && d.slice(0, 7) !== month && "bg-surface-raised/40")}
          >
            <div className="flex items-center justify-between">
              <span
                className={cn(
                  "grid size-6 place-items-center rounded-full text-xs",
                  d === today ? "bg-primary font-semibold text-primary-foreground" : !month || d.slice(0, 7) === month ? "text-foreground" : "text-muted-foreground",
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
      <div className="pointer-events-none absolute inset-x-0 top-8 grid grid-cols-7 gap-y-1 px-1" style={{ gridAutoRows: `${rowH}rem` }}>
        {placed.map(({ it, col, span, lane, clippedStart, clippedEnd }) => (
          <Bar key={it.key} it={it} col={col} span={span} lane={lane} clippedStart={clippedStart} clippedEnd={clippedEnd} tall={tall} onOpen={onOpen} />
        ))}
      </div>
      {lanes.length > base && <div style={{ height: `${(lanes.length - base) * (rowH + 0.25)}rem` }} />}
    </div>
  );
}

function Bar({
  it,
  col,
  span,
  lane,
  clippedStart,
  clippedEnd,
  tall,
  onOpen,
}: {
  it: CalItem;
  col: number;
  span: number;
  lane: number;
  clippedStart: boolean;
  clippedEnd: boolean;
  tall: boolean;
  onOpen: (key: string) => void;
}) {
  const { color, icon: Icon } = typeStyle(it.type);
  const upcoming = it.status === "upcoming";
  const result = it.change != null ? `${pct(it.change, 0)} GGR` : null;
  return (
    <button
      onClick={() => onOpen(it.key)}
      title={`${it.name} · ${it.sub} · ${formatRange(it.start, it.end)} · ${STATUS_LABEL[it.status]}${result ? ` · ${result} vs before` : ""}`}
      style={{
        gridColumn: `${col + 1} / span ${span}`,
        gridRow: lane + 1,
        borderColor: `color-mix(in oklch, ${color} ${upcoming ? 55 : 40}%, transparent)`,
        backgroundColor: `color-mix(in oklch, ${color} ${upcoming ? 6 : 15}%, var(--color-surface))`,
        borderLeftWidth: clippedStart ? 0 : 3,
        borderLeftColor: color,
      }}
      className={cn(
        "pointer-events-auto mx-0.5 flex min-w-0 items-center gap-1 border px-1.5 text-left text-[11px] font-medium transition-transform hover:-translate-y-px hover:shadow-md",
        upcoming && "border-dashed",
        clippedStart ? "rounded-l-none" : "rounded-l-md",
        clippedEnd ? "rounded-r-none border-r-0" : "rounded-r-md",
      )}
    >
      {it.status === "live" ? (
        <span className="size-1.5 shrink-0 animate-pulse rounded-full bg-primary" />
      ) : it.campaign ? (
        <Globe2 className="size-3 shrink-0" style={{ color }} />
      ) : (
        <Icon className="size-3 shrink-0" style={{ color }} />
      )}
      <span className={cn("min-w-0 flex-1", tall ? "leading-tight" : "truncate")}>
        <span className="block truncate">
          {!it.campaign && `${it.flag} `}
          {it.name}
          {!tall && <span className="font-normal text-muted-foreground"> · {it.sub}</span>}
        </span>
        {tall && <span className="block truncate text-[10px] font-normal text-muted-foreground">{it.sub}</span>}
      </span>
      {result && span > 1 && (
        <span className={cn("shrink-0 tabular text-[10px] font-semibold", it.change! >= 0 ? "text-good-ink" : "text-bad-ink")}>{pct(it.change, 0)}</span>
      )}
    </button>
  );
}

/** Coming up first, then previous promotions with their results. */
function ListView({ items, onOpen }: { items: CalItem[]; onOpen: (key: string) => void }) {
  const ahead = items.filter((i) => i.status === "upcoming" || i.status === "live");
  const past = items.filter((i) => i.status === "measuring" || i.status === "complete").sort((a, b) => b.start.localeCompare(a.start));
  if (!items.length) return <div className="panel p-8 text-center text-sm text-muted-foreground">No promotions match the current filters.</div>;
  return (
    <div className="space-y-4">
      {ahead.length > 0 && <ListGroup title="Live and coming up" items={ahead} onOpen={onOpen} />}
      {past.length > 0 && <ListGroup title="Previous promotions" items={past} onOpen={onOpen} withResults />}
    </div>
  );
}

function ListGroup({ title, items, onOpen, withResults = false }: { title: string; items: CalItem[]; onOpen: (key: string) => void; withResults?: boolean }) {
  return (
    <section>
      <h3 className="mb-2 text-eyebrow">
        {title} · {items.length}
      </h3>
      <div className="panel divide-y divide-border overflow-hidden">
        {items.map((it) => {
          const participants = it.m ? it.m.participants : it.linked.reduce((s, m) => s + (m.participants ?? 0), 0) || null;
          return (
            <button
              key={it.key}
              onClick={() => onOpen(it.key)}
              className="flex w-full flex-col gap-2 px-4 py-3 text-left transition-colors hover:bg-surface-raised sm:flex-row sm:items-center sm:justify-between"
              style={{ borderLeft: `3px solid ${typeStyle(it.type).color}` }}
            >
              <div className="min-w-0">
                <p className="truncate font-display text-sm font-semibold">
                  {it.flag} {it.name}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                  <TypeBadge type={it.type} />
                  <span>{it.sub}</span>
                  <span>· {formatRange(it.start, it.end)}</span>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-4">
                {withResults && (
                  <>
                    {participants != null && <span className="hidden text-xs text-muted-foreground md:inline">{num(participants)} players</span>}
                    {it.change != null ? <ChangePill value={it.change} adjusted={it.adjusted} /> : <span className="text-xs text-muted-foreground">No results yet</span>}
                  </>
                )}
                <StatusBadge status={it.status} />
                <ArrowRight className="size-4 text-muted-foreground" />
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
