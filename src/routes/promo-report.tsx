import { useState } from "react";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  ArrowLeft,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardCopy,
  Coins,
  Gamepad2,
  Globe2,
  Lightbulb,
  Pencil,
  Printer,
  Repeat,
  StickyNote,
  Tag,
  TrendingUp,
  Users,
  Building2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChartCard, Delta, MiniTable, StatTile, StatusBadge, VerdictBadge } from "@/components/report/bits";
import { PromoEditor } from "@/components/report/PromoEditor";
import { NotFoundPage } from "@/routes/not-found";
import { DailyTimeline } from "@/components/charts/DailyTimeline";
import { PHASES } from "@/components/charts/core";
import { useData } from "@/lib/store";
import { formatDay, formatRange, monthLabel, prevMonth } from "@/lib/dates";
import { money, moneyFull, moneySigned, multiple, num, pct } from "@/lib/format";
import type { PromoMetrics } from "@/lib/metrics";
import { cn } from "@/lib/utils";

export function PromoReportPage() {
  const { promoId } = useParams({ from: "/promo/$promoId" });
  const { metrics, dataset, editable } = useData();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [perDay, setPerDay] = useState(false);

  const ordered = [...metrics].sort((a, b) => a.promo.startDate.localeCompare(b.promo.startDate));
  const idx = ordered.findIndex((m) => m.promo.id === promoId);
  const m = ordered[idx];
  if (!m) return <NotFoundPage />;
  const prev = ordered[idx - 1];
  const next = ordered[idx + 1];
  const p = m.promo;
  const cur = dataset.currency;
  const fmt = (v: number) => money(v, cur);
  const fmtFull = (v: number) => moneyFull(v, cur);
  const insights = buildInsights(m, cur);

  const copySummary = async () => {
    const text = [
      `${p.name} — ${p.operator || "—"} · ${p.type} · ${formatRange(p.startDate, p.endDate)}`,
      `GGR before ${moneyFull(m.ggrBefore, cur)} · during ${moneyFull(m.ggrDuring, cur)} · after ${moneyFull(m.ggrAfter, cur)}`,
      `During vs before ${pct(m.duringVsBefore)} · After vs before ${pct(m.afterVsBefore)}`,
      `Extra GGR ${moneySigned(m.incrementalGgr == null ? null : m.incrementalGgr + (m.haloGgr ?? 0), cur)} · Prize pool ${moneyFull(p.prizePool, cur)} · ROI ${multiple(m.roi)}`,
      m.monthVsPrev != null ? `${monthLabel(m.month, "long")} GGR vs ${monthLabel(prevMonth(m.month), "long")}: ${pct(m.monthVsPrev)}` : "",
      "",
      ...insights.map((i) => `• ${i}`),
    ]
      .filter((l, i, a) => l || a[i - 1])
      .join("\n");
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Summary copied — paste it into Slack or an email");
    } catch {
      toast.error("Couldn't access the clipboard");
    }
  };

  const phaseVals = [
    { ...PHASES[0], total: m.ggrBefore, day: m.perDayBefore, range: formatRange(m.beforeStart, m.beforeEnd), days: m.windowDays },
    { ...PHASES[1], total: m.ggrDuring, day: m.perDayDuring, range: formatRange(p.startDate, p.endDate), days: m.promoDays },
    { ...PHASES[2], total: m.ggrAfter, day: m.perDayAfter, range: formatRange(m.afterStart, m.afterEnd), days: m.windowDays },
  ];
  const players = [p.playersBefore, p.playersDuring, p.playersAfter];

  return (
    <main className="mx-auto max-w-[1400px] space-y-5 px-4 py-6 lg:px-8">
      <div className="no-print flex flex-wrap items-center justify-between gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link to="/">
            <ArrowLeft className="size-4" /> Dashboard
          </Link>
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={copySummary}>
            <ClipboardCopy className="size-3.5" /> Copy summary
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="size-3.5" /> Print / PDF
          </Button>
          {editable && (
            <Button size="sm" onClick={() => setEditing(true)}>
              <Pencil className="size-3.5" /> Edit numbers
            </Button>
          )}
        </div>
      </div>

      {/* Header */}
      <section className="brand-surface relative overflow-hidden rounded-2xl p-5 sm:p-6">
        <div className="flight-trail pointer-events-none absolute inset-0 opacity-60" />
        <div className="relative">
          <div className="flex flex-wrap items-center gap-2">
            <VerdictBadge verdict={m.verdict} />
            <StatusBadge status={m.status} />
          </div>
          <h1 className="mt-2 text-3xl sm:text-4xl">{p.name}</h1>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
            <Meta icon={Building2}>{p.operator || "—"}</Meta>
            <Meta icon={Tag}>{p.type}</Meta>
            <Meta icon={Gamepad2}>{p.games.join(", ") || "—"}</Meta>
            <Meta icon={Globe2}>{p.market || "—"}</Meta>
            <Meta icon={CalendarDays}>
              {formatRange(p.startDate, p.endDate)} · {m.promoDays} day{m.promoDays === 1 ? "" : "s"}
            </Meta>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Compared with the {m.windowDays} days before ({formatRange(m.beforeStart, m.beforeEnd)}) and the {m.windowDays} days
            after ({formatRange(m.afterStart, m.afterEnd)}), on GGR per day.
          </p>
        </div>
      </section>

      {/* KPIs */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {phaseVals.map((ph) => (
          <StatTile
            key={ph.key}
            label={`GGR ${ph.label.toLowerCase()}`}
            value={money(ph.total, cur)}
            hint={
              <>
                {ph.day != null ? `${money(ph.day, cur)}/day` : "not in yet"}
                {ph.key === "during" && m.partialDuring && " · so far"}
              </>
            }
            accent={ph.color}
          />
        ))}
        <StatTile icon={TrendingUp} label="During vs before" value={pct(m.duringVsBefore)} hint={`${moneySigned(m.incrementalGgr, cur)} extra while live`} />
        <StatTile
          icon={Repeat}
          label="After vs before"
          value={pct(m.afterVsBefore)}
          hint={m.upliftRetained != null ? `${Math.round(m.upliftRetained * 100)}% of the lift retained` : "halo after the promo"}
        />
        <StatTile
          icon={Coins}
          label="Net impact"
          value={moneySigned(m.netImpact, cur)}
          hint={p.prizePool ? `ROI ${multiple(m.roi)} on ${money(p.prizePool, cur)} prizes` : "add a prize pool for ROI"}
        />
      </section>

      <section className="grid gap-5 lg:grid-cols-3">
        <ChartCard
          className="lg:col-span-2"
          title={p.daily?.length ? "Daily GGR" : "GGR by window"}
          subtitle={
            p.daily?.length
              ? "Each window shaded; the thin rule is the window's average per day."
              : "Add a daily series from the backoffice to see the day-by-day timeline here."
          }
          table={() => (
            <MiniTable
              head={["Window", "Dates", "GGR", "Per day", "vs before"]}
              rows={phaseVals.map((ph, i) => [
                ph.label,
                ph.range,
                money(ph.total, cur),
                money(ph.day, cur),
                i === 0 ? "—" : pct(i === 1 ? m.duringVsBefore : m.afterVsBefore),
              ])}
            />
          )}
        >
          {p.daily?.length ? (
            <DailyTimeline
              daily={p.daily}
              before={{ start: m.beforeStart, end: m.beforeEnd }}
              during={{ start: p.startDate, end: p.endDate }}
              after={{ start: m.afterStart, end: m.afterEnd }}
              perDay={{ before: m.perDayBefore, during: m.perDayDuring, after: m.perDayAfter }}
              format={fmt}
              formatFull={fmtFull}
            />
          ) : (
            <PhaseBars values={phaseVals.map((ph) => ({ ...ph, value: ph.total }))} format={fmtFull} base={m.ggrBefore} />
          )}
        </ChartCard>

        <ChartCard
          title="Window comparison"
          actions={
            <div className="no-print flex rounded-md border border-border p-0.5 text-xs">
              {(["Total", "Per day"] as const).map((l) => (
                <button
                  key={l}
                  onClick={() => setPerDay(l === "Per day")}
                  className={cn("rounded px-2 py-0.5", (l === "Per day") === perDay ? "bg-surface-raised text-foreground" : "text-muted-foreground")}
                >
                  {l}
                </button>
              ))}
            </div>
          }
          subtitle={perDay ? "Average GGR per day in each window" : "Total GGR in each window"}
        >
          <PhaseBars
            values={phaseVals.map((ph) => ({ ...ph, value: perDay ? ph.day : ph.total }))}
            format={fmtFull}
            base={perDay ? m.perDayBefore : m.ggrBefore}
            showPct={perDay || m.windowDays === m.promoDays}
          />
          {!perDay && m.windowDays !== m.promoDays && (
            <p className="mt-3 text-[11px] text-muted-foreground">
              The windows have different lengths, so % changes are shown on the per-day view only.
            </p>
          )}
        </ChartCard>
      </section>

      <section className="grid gap-5 lg:grid-cols-3">
        <section className="panel animate-rise min-w-0 p-5 lg:col-span-2">
          <h2 className="mb-3 flex items-center gap-2 text-base">
            <Lightbulb className="size-4 text-primary" /> What happened
          </h2>
          <ul className="space-y-2.5 text-sm leading-relaxed">
            {insights.map((t, i) => (
              <li key={i} className="flex gap-2.5">
                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
                <span>{t}</span>
              </li>
            ))}
          </ul>
          {p.notes && (
            <div className="mt-4 rounded-lg border border-border bg-surface-raised/60 p-3 text-sm">
              <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <StickyNote className="size-3.5" /> Notes
              </p>
              <p className="whitespace-pre-wrap">{p.notes}</p>
            </div>
          )}
        </section>

        <div className="min-w-0 space-y-5">
          <section className="panel animate-rise p-5">
            <h2 className="mb-1 text-base">Month impact</h2>
            <p className="mb-4 text-xs text-muted-foreground">
              Total GGR for {monthLabel(m.month, "long")} vs {monthLabel(prevMonth(m.month), "long")}
            </p>
            {m.monthGgr != null || m.prevMonthGgr != null ? (
              <>
                <PhaseBars
                  values={[
                    { key: "prev", label: monthLabel(prevMonth(m.month)), color: "var(--color-muted-foreground)", value: m.prevMonthGgr },
                    { key: "this", label: monthLabel(m.month), color: "var(--series-before)", value: m.monthGgr },
                  ]}
                  format={fmt}
                  base={null}
                />
                <p className="mt-3 text-sm">
                  <Delta value={m.monthVsPrev} /> <span className="text-muted-foreground">month over month</span>
                </p>
                {m.incrementalGgr != null && m.monthGgr ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    This promo's extra GGR is {((m.incrementalGgr / m.monthGgr) * 100).toFixed(2)}% of the month's total.
                  </p>
                ) : null}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Add monthly totals on the{" "}
                <Link to="/data" className="text-primary hover:underline">
                  Data page
                </Link>{" "}
                to compare months.
              </p>
            )}
          </section>

          {players.some((v) => v != null) && (
            <section className="panel animate-rise p-5">
              <h2 className="mb-4 flex items-center gap-2 text-base">
                <Users className="size-4 text-primary" /> Active players
              </h2>
              <PhaseBars
                values={PHASES.map((ph, i) => ({ ...ph, value: players[i] }))}
                format={num}
                base={p.playersBefore}
                showPct={m.windowDays === m.promoDays}
              />
            </section>
          )}
        </div>
      </section>

      <nav className="no-print flex items-center justify-between gap-2">
        {prev ? (
          <Button variant="ghost" onClick={() => navigate({ to: "/promo/$promoId", params: { promoId: prev.promo.id } })}>
            <ChevronLeft className="size-4" /> <span className="max-w-28 truncate sm:max-w-48">{prev.promo.name}</span>
          </Button>
        ) : (
          <span />
        )}
        {next && (
          <Button variant="ghost" onClick={() => navigate({ to: "/promo/$promoId", params: { promoId: next.promo.id } })}>
            <span className="max-w-28 truncate sm:max-w-48">{next.promo.name}</span> <ChevronRight className="size-4" />
          </Button>
        )}
      </nav>

      <PromoEditor promo={p} open={editing} onOpenChange={setEditing} />
    </main>
  );
}

function Meta({ icon: Icon, children }: { icon: typeof Tag; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-1.5">
      <Icon className="size-4" />
      {children}
    </span>
  );
}

/** Horizontal bars, one per window, value at the tip and % vs the first bar. */
function PhaseBars({
  values,
  format,
  base,
  showPct = true,
}: {
  values: Array<{ key: string; label: string; color: string; value: number | null; range?: string }>;
  format: (v: number) => string;
  base: number | null;
  showPct?: boolean;
}) {
  const max = Math.max(1, ...values.map((v) => Math.abs(v.value ?? 0)));
  return (
    <div className="space-y-3.5">
      {values.map((v, i) => (
        <div key={v.key}>
          <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-[3px]" style={{ background: v.color }} />
              <span className="font-medium">{v.label}</span>
              {v.range && <span className="text-muted-foreground">{v.range}</span>}
            </span>
            <span className="tabular">
              <span className="font-semibold">{v.value == null ? "—" : format(v.value)}</span>
              {showPct && i > 0 && base != null && base > 0 && v.value != null && (
                <span className={cn("ml-1.5", v.value >= base ? "text-good-ink" : "text-bad-ink")}>{pct(v.value / base - 1)}</span>
              )}
            </span>
          </div>
          <div className="h-3 overflow-hidden rounded-r-[4px] bg-surface-raised">
            <div
              className="h-full rounded-r-[4px] transition-[width] duration-700"
              style={{ width: `${v.value == null ? 0 : (Math.max(0, v.value) / max) * 100}%`, background: v.color }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Plain-language read-out of the numbers — what someone would say in the weekly review. */
function buildInsights(m: PromoMetrics, cur: string): string[] {
  const out: string[] = [];
  const p = m.promo;
  if (m.perDayBefore == null) {
    out.push("There's no GGR for the before-window yet, so there's no baseline to compare against.");
    return out;
  }
  if (m.duringVsBefore != null) {
    out.push(
      `${m.status === "live" ? "So far, while live" : "While live"}, GGR averaged ${money(m.perDayDuring, cur)}/day — ${pct(m.duringVsBefore)} vs ${money(m.perDayBefore, cur)}/day in the ${m.windowDays} days before.`,
    );
  }
  if (m.incrementalGgr != null) {
    out.push(
      m.incrementalGgr >= 0
        ? `That's about ${moneyFull(m.incrementalGgr, cur)} of extra GGR over the pre-promo run-rate during the ${m.promoDays}-day promo.`
        : `GGR came in ${moneyFull(Math.abs(m.incrementalGgr), cur)} below the pre-promo run-rate during the promo.`,
    );
  }
  if (m.afterVsBefore != null) {
    if (m.upliftRetained != null && m.upliftRetained > 0.05) {
      out.push(
        `After it ended, GGR stayed ${pct(m.afterVsBefore)} above the baseline — about ${Math.round(m.upliftRetained * 100)}% of the lift stuck around (${moneySigned(m.haloGgr, cur)} halo).`,
      );
    } else if (m.afterVsBefore < -0.03) {
      out.push(`After it ended, GGR dropped ${pct(m.afterVsBefore)} below the baseline — worth checking whether the promo pulled play forward.`);
    } else {
      out.push(`After it ended, GGR went back to roughly the baseline (${pct(m.afterVsBefore)}).`);
    }
  } else if (m.status !== "complete") {
    out.push(`After-window numbers will be available from ${formatDay(m.afterEnd, true)}.`);
  }
  if (p.prizePool && m.netImpact != null) {
    out.push(
      m.netImpact >= 0
        ? `Net of the ${moneyFull(p.prizePool, cur)} prize pool, the promo generated ${moneyFull(m.netImpact, cur)} (ROI ${multiple(m.roi)}).`
        : `Extra GGR didn't cover the ${moneyFull(p.prizePool, cur)} prize pool — net ${moneySigned(m.netImpact, cur)}.`,
    );
  }
  if (m.playersDuringVsBefore != null) {
    out.push(`Active players changed ${pct(m.playersDuringVsBefore)} during the promo.`);
  }
  if (m.monthVsPrev != null) {
    out.push(`${monthLabel(m.month, "long")} total GGR was ${pct(m.monthVsPrev)} vs ${monthLabel(prevMonth(m.month), "long")}.`);
  }
  return out;
}
