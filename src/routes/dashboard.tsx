import { useMemo, useState } from "react";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import {
  ArrowRight,
  Award,
  CalendarRange,
  Coins,
  Flame,
  Gauge,
  Inbox,
  Layers,
  Repeat,
  Sparkles,
  TrendingUp,
  Trophy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChartCard, Delta, EmptyState, MiniTable, StatTile, VerdictBadge } from "@/components/report/bits";
import { PromoTable } from "@/components/report/PromoTable";
import { PromoCurve } from "@/components/charts/PromoCurve";
import { MonthColumns } from "@/components/charts/MonthColumns";
import { UpliftBars } from "@/components/charts/UpliftBars";
import { GroupedColumns } from "@/components/charts/GroupedColumns";
import { RoiScatter } from "@/components/charts/RoiScatter";
import { Sparkline } from "@/components/charts/Sparkline";
import { PHASES } from "@/components/charts/core";
import { useData } from "@/lib/store";
import { aggregate, monthRows, type PromoMetrics } from "@/lib/metrics";
import { monthLabel, monthRange, prevMonth } from "@/lib/dates";
import { money, moneyFull, moneySigned, multiple, num, pct, pctPlain } from "@/lib/format";

type Period = "all" | "last3" | "ytd" | string;
type GroupBy = "type" | "games" | "operator" | "market";

const ALL = "__all";

function periodMonths(period: Period, latest: string): string[] | null {
  if (period === "all") return null;
  if (period === "last3") return [prevMonth(prevMonth(latest)), prevMonth(latest), latest];
  if (period === "ytd") return monthRange(`${latest.slice(0, 4)}-01`, latest);
  return [period];
}

function periodLabel(period: Period): string {
  if (period === "all") return "All time";
  if (period === "last3") return "Last 3 months";
  if (period === "ytd") return "Year to date";
  return monthLabel(period, "long");
}

export function DashboardPage() {
  const { dataset, metrics, status } = useData();
  const search = useSearch({ from: "/" });
  const navigate = useNavigate();
  const period: Period = search.period ?? "all";
  const setPeriod = (p: Period) => navigate({ to: "/", search: p === "all" ? {} : { period: p }, replace: true });

  const [operator, setOperator] = useState(ALL);
  const [type, setType] = useState(ALL);
  const [game, setGame] = useState(ALL);
  const [market, setMarket] = useState(ALL);
  const [groupBy, setGroupBy] = useState<GroupBy>("type");
  const cur = dataset.currency;
  const fmt = (v: number) => money(v, cur);
  const fmtFull = (v: number) => moneyFull(v, cur);
  const open = (id: string) => navigate({ to: "/promo/$promoId", params: { promoId: id } });

  const options = useMemo(() => {
    const uniq = (xs: string[]) => [...new Set(xs.filter(Boolean))].sort();
    return {
      operators: uniq(dataset.promos.map((p) => p.operator)),
      types: uniq(dataset.promos.map((p) => p.type)),
      games: uniq(dataset.promos.flatMap((p) => p.games)),
      markets: uniq(dataset.promos.map((p) => p.market)),
    };
  }, [dataset.promos]);

  // Full month axis across both promos and monthly totals.
  const allMonths = useMemo(() => {
    const ms = [...dataset.monthly.map((m) => m.month), ...metrics.map((m) => m.month)].sort();
    return ms.length ? monthRange(ms[0], ms[ms.length - 1]) : [];
  }, [dataset.monthly, metrics]);
  const latest = allMonths[allMonths.length - 1] ?? new Date().toISOString().slice(0, 7);

  const filtered = useMemo(
    () =>
      metrics.filter(
        (m) =>
          (operator === ALL || m.promo.operator === operator) &&
          (type === ALL || m.promo.type === type) &&
          (game === ALL || m.promo.games.includes(game)) &&
          (market === ALL || m.promo.market === market),
      ),
    [metrics, operator, type, game, market],
  );

  const months = periodMonths(period, latest);
  const inPeriod = months ? filtered.filter((m) => months.includes(m.month)) : filtered;
  const prevMonths = months ? months.map((mm) => {
    let p = mm;
    for (let i = 0; i < months.length; i++) p = prevMonth(p);
    return p;
  }) : null;
  const inPrev = prevMonths ? filtered.filter((m) => prevMonths.includes(m.month)) : null;

  const agg = aggregate(inPeriod);
  const prevAgg = inPrev ? aggregate(inPrev) : null;
  const rows = monthRows(allMonths, dataset.monthly, filtered);
  const focusMonth = months && months.length === 1 ? months[0] : null;
  const ggrRow =
    (focusMonth ? rows.find((r) => r.month === focusMonth) : [...rows].reverse().find((r) => r.ggr != null)) ?? null;

  const filtersActive = operator !== ALL || type !== ALL || game !== ALL || market !== ALL;

  if (!dataset.promos.length && !dataset.monthly.length) {
    return (
      <main className="mx-auto max-w-[1400px] px-4 py-12 lg:px-8">
        <div className="panel p-8">
          <EmptyState icon={Inbox} title={status === "loading" ? "Loading data…" : "No promo data yet"}>
            Add promos on the Data page — type them in, paste from Excel / Google Sheets, or import a CSV — or connect the
            backoffice so the report fills itself.
            <div className="mt-5 flex justify-center gap-2">
              <Button asChild>
                <Link to="/data">Add data</Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/connect">Connect a source</Link>
              </Button>
            </div>
          </EmptyState>
        </div>
      </main>
    );
  }

  const withIndex = inPeriod.filter((m) => m.index && m.index.during != null);
  const ranked = [...inPeriod].sort((a, b) => (b.duringVsBefore ?? -Infinity) - (a.duringVsBefore ?? -Infinity));
  const best = ranked.find((m) => m.duringVsBefore != null);
  const worst = [...ranked].reverse().find((m) => m.duringVsBefore != null);
  const bestRoi = [...inPeriod].filter((m) => m.roi != null).sort((a, b) => (b.roi ?? 0) - (a.roi ?? 0))[0];

  const groups = groupRows(inPeriod, groupBy);

  return (
    <main className="mx-auto max-w-[1400px] space-y-5 px-4 py-6 lg:px-8">
      {/* Hero */}
      <section className="brand-surface relative overflow-hidden rounded-2xl p-5 sm:p-6">
        <div className="flight-trail pointer-events-none absolute inset-0 opacity-70" />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-eyebrow">Promo performance · {periodLabel(period)}</p>
            <h1 className="mt-1 text-3xl sm:text-4xl">
              Did the promo <span className="brand-gradient-text">move GGR?</span>
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Every promotion compared with the same number of days before and after it, weighted by its baseline GGR —
              plus how each month did against the one before.
            </p>
          </div>
          <div className="w-full sm:w-56">
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger aria-label="Period">
                <CalendarRange className="size-4 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All time</SelectItem>
                <SelectItem value="last3">Last 3 months</SelectItem>
                <SelectItem value="ytd">Year to date</SelectItem>
                {[...allMonths].reverse().map((m) => (
                  <SelectItem key={m} value={m}>
                    {monthLabel(m, "long")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        {/* Filters: one row above the charts */}
        <div className="relative mt-5 grid grid-cols-2 gap-2 md:grid-cols-4">
          <FilterSelect label="Operator" value={operator} onChange={setOperator} options={options.operators} />
          <FilterSelect label="Promo type" value={type} onChange={setType} options={options.types} />
          <FilterSelect label="Game" value={game} onChange={setGame} options={options.games} />
          <FilterSelect label="Market" value={market} onChange={setMarket} options={options.markets} />
        </div>
        {filtersActive && (
          <button
            className="relative mt-2 text-xs text-primary hover:underline"
            onClick={() => (setOperator(ALL), setType(ALL), setGame(ALL), setMarket(ALL))}
          >
            Clear filters
          </button>
        )}
      </section>

      {/* KPI tiles */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <StatTile
          icon={Layers}
          label="Promos run"
          value={num(agg.count)}
          delta={prevAgg && prevAgg.count ? agg.count / prevAgg.count - 1 : prevAgg ? null : undefined}
          deltaSuffix={prevAgg ? `vs ${prevAgg.count} before` : undefined}
          hint={!prevAgg ? `${agg.withData} with GGR data` : undefined}
          trend={<Sparkline values={rows.map((r) => r.promoCount)} />}
        />
        <StatTile
          icon={Flame}
          label="GGR during promos"
          value={money(agg.ggrDuring, cur)}
          hint={`vs ${money(agg.ggrBefore, cur)} before`}
          accent={PHASES[1].color}
        />
        <StatTile
          icon={TrendingUp}
          label="During vs before"
          value={<span className={agg.duringVsBefore != null && agg.duringVsBefore < 0 ? "text-bad-ink" : ""}>{pct(agg.duringVsBefore)}</span>}
          hint={agg.positiveShare != null ? `${pctPlain(agg.positiveShare)} of promos lifted GGR` : "per-day, baseline-weighted"}
          accent={PHASES[1].color}
        />
        <StatTile
          icon={Repeat}
          label="After vs before"
          value={pct(agg.afterVsBefore)}
          hint="did the lift stick once it ended?"
          accent={PHASES[2].color}
        />
        <StatTile
          icon={Coins}
          label="Extra GGR generated"
          value={moneySigned(agg.incrementalGgr + agg.haloGgr, cur)}
          hint={`net ${moneySigned(agg.netImpact, cur)} after ${money(agg.prizePool, cur)} prizes`}
        />
        <StatTile
          icon={Gauge}
          label="GGR vs previous month"
          value={money(ggrRow?.ggr, cur)}
          delta={ggrRow?.momChange ?? null}
          deltaSuffix={ggrRow ? `${monthLabel(ggrRow.month)} vs ${monthLabel(prevMonth(ggrRow.month))}` : undefined}
          trend={<Sparkline values={rows.map((r) => r.ggr)} />}
        />
      </section>

      {/* Curve + headlines */}
      <section className="grid gap-5 lg:grid-cols-3">
        <ChartCard
          className="lg:col-span-2"
          title="Before → During → After"
          subtitle="GGR per day, indexed so each promo's before-window = 100. Hover a line to see the promo, click to open its report."
          table={() => (
            <MiniTable
              head={["Promo", "Before", "During", "After"]}
              rows={withIndex.map((m) => [
                m.promo.name,
                "100",
                m.index!.during?.toFixed(0) ?? "—",
                m.index!.after?.toFixed(0) ?? "—",
              ])}
            />
          )}
        >
          {withIndex.length ? (
            <PromoCurve
              lines={withIndex.map((m) => ({
                key: m.promo.id,
                label: m.promo.name,
                sub: `${m.promo.operator} · ${m.promo.type}`,
                index: m.index!,
              }))}
              average={agg.index}
              onSelect={open}
            />
          ) : (
            <EmptyState icon={Sparkles} title="No promos with before & during GGR in this view" />
          )}
        </ChartCard>

        <section className="panel animate-rise flex min-w-0 flex-col gap-4 p-5">
          <h2 className="text-base">Headlines</h2>
          <Headline
            icon={Trophy}
            label="Biggest lift"
            metric={best}
            value={best ? pct(best.duringVsBefore) : "—"}
            onOpen={open}
          />
          <Headline
            icon={Award}
            label="Best ROI"
            metric={bestRoi}
            value={bestRoi ? multiple(bestRoi.roi) : "—"}
            onOpen={open}
          />
          <Headline
            icon={TrendingUp}
            label="Weakest result"
            metric={worst && worst !== best ? worst : undefined}
            value={worst && worst !== best ? pct(worst.duringVsBefore) : "—"}
            onOpen={open}
          />
          <div className="mt-auto rounded-lg border border-border bg-surface-raised/60 p-3 text-xs leading-relaxed text-muted-foreground">
            Across {agg.withData} promo{agg.withData === 1 ? "" : "s"} with data, GGR ran{" "}
            <strong className="text-foreground">{pct(agg.duringVsBefore)}</strong> above the pre-promo run-rate while
            live and <strong className="text-foreground">{pct(agg.afterVsBefore)}</strong> after.{" "}
            {agg.roi != null && (
              <>
                Prizes paid back <strong className="text-foreground">{multiple(agg.roi + 1)}</strong> in extra GGR
                (ROI {multiple(agg.roi)}).
              </>
            )}
          </div>
        </section>
      </section>

      {/* Monthly */}
      <section className="grid gap-5 lg:grid-cols-2">
        <ChartCard
          title="Total GGR by month"
          subtitle={
            ggrRow ? (
              <>
                {monthLabel(ggrRow.month, "long")}: {money(ggrRow.ggr, cur)} <Delta value={ggrRow.momChange} className="text-xs" /> vs{" "}
                {monthLabel(prevMonth(ggrRow.month), "long")}
              </>
            ) : (
              "Add monthly totals on the Data page"
            )
          }
          table={() => (
            <MiniTable
              head={["Month", "GGR", "vs prev month", "Promos", "Extra GGR"]}
              rows={rows.map((r) => [monthLabel(r.month, "long"), money(r.ggr, cur), pct(r.momChange), r.promoCount, moneySigned(r.incrementalGgr, cur)])}
            />
          )}
        >
          <MonthColumns
            data={rows.map((r) => ({
              month: r.month,
              value: r.ggr,
              extra: [
                { label: "vs previous month", value: pct(r.momChange) },
                { label: "Promos started", value: String(r.promoCount) },
                { label: "Extra GGR from promos", value: moneySigned(r.incrementalGgr, cur) },
              ],
            }))}
            valueName="Total GGR"
            format={fmt}
            formatFull={fmtFull}
            highlight={focusMonth}
            label={(d) => {
              const r = rows.find((x) => x.month === d.month);
              return `${money(d.value, cur)}  ${pct(r?.momChange ?? null)}`;
            }}
            onSelect={setPeriod}
          />
        </ChartCard>
        <ChartCard
          title="Number of promos by month"
          subtitle={
            ggrRow
              ? `${monthLabel(ggrRow.month, "long")}: ${ggrRow.promoCount} promo${ggrRow.promoCount === 1 ? "" : "s"} (${ggrRow.prevPromoCount} the month before)`
              : undefined
          }
          table={() => (
            <MiniTable
              head={["Month", "Promos", "Previous month"]}
              rows={rows.map((r) => [monthLabel(r.month, "long"), r.promoCount, r.prevPromoCount])}
            />
          )}
        >
          <MonthColumns
            data={rows.map((r) => ({
              month: r.month,
              value: r.promoCount,
              extra: [{ label: "Extra GGR from promos", value: moneySigned(r.incrementalGgr, cur) }],
            }))}
            valueName="Promos started"
            format={(v) => num(v)}
            highlight={focusMonth}
            color="var(--series-during)"
            label={(d) => String(d.value)}
            onSelect={setPeriod}
          />
        </ChartCard>
      </section>

      {/* Uplift per promo + by group */}
      <section className="grid gap-5 lg:grid-cols-2">
        <ChartCard
          title="Uplift per promo"
          subtitle="Bar = GGR/day during vs before. Dot = after vs before. Sorted by lift."
          table={() => (
            <MiniTable
              head={["Promo", "During vs before", "After vs before"]}
              rows={ranked.map((m) => [m.promo.name, pct(m.duringVsBefore), pct(m.afterVsBefore)])}
            />
          )}
        >
          {ranked.length ? (
            <UpliftBars
              rows={ranked.map((m) => ({
                key: m.promo.id,
                label: m.promo.name,
                sub: `${m.promo.operator} · ${m.promo.market}`,
                during: m.duringVsBefore,
                after: m.afterVsBefore,
              }))}
              onSelect={open}
            />
          ) : (
            <EmptyState icon={Sparkles} title="No promos in this view" />
          )}
        </ChartCard>
        <ChartCard
          title="Before / During / After GGR"
          subtitle="Summed GGR for each window, grouped. Hover for the uplift."
          actions={
            <Select value={groupBy} onValueChange={(v) => setGroupBy(v as GroupBy)}>
              <SelectTrigger className="h-8 w-32 text-xs" aria-label="Group by">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="type">By type</SelectItem>
                <SelectItem value="games">By game</SelectItem>
                <SelectItem value="operator">By operator</SelectItem>
                <SelectItem value="market">By market</SelectItem>
              </SelectContent>
            </Select>
          }
          table={() => (
            <MiniTable
              head={["Group", "Promos", "Before", "During", "After", "During vs before"]}
              rows={groups.map((g) => [g.label, g.agg.count, money(g.agg.ggrBefore, cur), money(g.agg.ggrDuring, cur), money(g.agg.ggrAfter, cur), pct(g.agg.duringVsBefore)])}
            />
          )}
        >
          <GroupedColumns
            series={PHASES.map((p) => ({ key: p.key, label: `${p.label} the promo`, color: p.color }))}
            categories={groups.slice(0, 8).map((g) => ({
              key: g.label,
              label: g.label,
              values: { before: g.agg.ggrBefore, during: g.agg.ggrDuring, after: g.agg.ggrAfter },
              extra: [
                { label: "Promos", value: String(g.agg.count) },
                { label: "During vs before", value: pct(g.agg.duringVsBefore) },
                { label: "After vs before", value: pct(g.agg.afterVsBefore) },
              ],
            }))}
            format={fmt}
            formatFull={fmtFull}
          />
          {groups.length > 8 && <p className="mt-2 text-xs text-muted-foreground">Showing the 8 largest groups — the table view has all {groups.length}.</p>}
        </ChartCard>
      </section>

      {/* ROI + monthly impact */}
      <section className="grid gap-5 lg:grid-cols-2">
        <ChartCard
          title="Prize pool vs extra GGR"
          subtitle="Above the line the promo more than paid for its prizes. Orange = paid back, grey = didn't."
          table={() => (
            <MiniTable
              head={["Promo", "Prize pool", "Extra GGR", "ROI"]}
              rows={inPeriod
                .filter((m) => m.incrementalGgr != null && m.promo.prizePool)
                .map((m) => [m.promo.name, money(m.promo.prizePool, cur), moneySigned((m.incrementalGgr ?? 0) + (m.haloGgr ?? 0), cur), multiple(m.roi)])}
            />
          )}
        >
          <RoiScatter
            points={inPeriod
              .filter((m) => m.incrementalGgr != null && m.promo.prizePool)
              .map((m) => ({
                key: m.promo.id,
                label: m.promo.name,
                sub: `${m.promo.operator} · ${m.promo.type}`,
                cost: m.promo.prizePool ?? 0,
                incremental: (m.incrementalGgr ?? 0) + (m.haloGgr ?? 0),
                roi: m.roi,
              }))}
            format={fmt}
            formatFull={fmtFull}
            onSelect={open}
          />
        </ChartCard>
        <ChartCard title="Month-over-month impact" subtitle="Each month's total GGR against the month before, and what promos added.">
          <MiniTable
            head={["Month", "Total GGR", "vs prev", "Promos", "Extra GGR", "Share"]}
            rows={[...rows].reverse().map((r) => [
              <button key={r.month} onClick={() => setPeriod(r.month)} className="text-left hover:text-primary">
                {monthLabel(r.month, "long")}
              </button>,
              money(r.ggr, cur),
              <Delta key="d" value={r.momChange} />,
              `${r.promoCount}${r.promoCount !== r.prevPromoCount ? ` (${r.promoCount - r.prevPromoCount > 0 ? "+" : ""}${r.promoCount - r.prevPromoCount})` : ""}`,
              moneySigned(r.incrementalGgr, cur),
              pctPlain(r.promoShare, 1),
            ])}
          />
          <p className="mt-2 text-[11px] text-muted-foreground">Share = extra GGR from promos as a share of the month's total GGR.</p>
        </ChartCard>
      </section>

      {/* Leaderboard */}
      <section className="panel animate-rise min-w-0 p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base">All promos · {periodLabel(period)}</h2>
            <p className="mt-1 text-xs text-muted-foreground">Click a promo for its full report. Click a column to sort.</p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link to="/data">
              Edit numbers <ArrowRight className="size-3.5" />
            </Link>
          </Button>
        </div>
        <PromoTable metrics={inPeriod} currency={cur} onOpen={open} />
      </section>
    </main>
  );
}

function groupRows(list: PromoMetrics[], by: GroupBy) {
  const map = new Map<string, PromoMetrics[]>();
  for (const m of list) {
    const keys = by === "games" ? (m.promo.games.length ? m.promo.games : ["—"]) : [m.promo[by] || "—"];
    for (const k of keys) map.set(k, [...(map.get(k) ?? []), m]);
  }
  return [...map.entries()]
    .map(([label, items]) => ({ label, agg: aggregate(items) }))
    .sort((a, b) => b.agg.ggrDuring - a.agg.ggrDuring);
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger aria-label={label} className="bg-surface/80">
        <span className="truncate">
          <span className="text-muted-foreground">{label}: </span>
          {value === ALL ? "All" : value}
        </span>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>All</SelectItem>
        {options.map((o) => (
          <SelectItem key={o} value={o}>
            {o}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function Headline({
  icon: Icon,
  label,
  metric,
  value,
  onOpen,
}: {
  icon: typeof Trophy;
  label: string;
  metric: PromoMetrics | undefined;
  value: string;
  onOpen: (id: string) => void;
}) {
  if (!metric)
    return (
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <Icon className="size-4" /> {label}: —
      </div>
    );
  return (
    <button
      onClick={() => onOpen(metric.promo.id)}
      className="group flex items-center gap-3 rounded-lg p-2 -m-2 text-left transition-colors hover:bg-surface-raised"
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/12">
        <Icon className="size-4 text-primary" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="text-eyebrow">{label}</span>
        <span className="block truncate text-sm font-medium">{metric.promo.name}</span>
        <span className="block truncate text-xs text-muted-foreground">
          {metric.promo.operator} · {monthLabel(metric.month)}
        </span>
      </span>
      <span className="text-right">
        <span className="block text-lg font-semibold tabular">{value}</span>
        <VerdictBadge verdict={metric.verdict} />
      </span>
    </button>
  );
}
