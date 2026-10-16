import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { CircleAlert, ShieldCheck } from "lucide-react";
import { DailyTimeline } from "@/components/charts/DailyTimeline";
import { PHASES } from "@/components/charts/core";
import { formatDay, formatRange, monthLabel, prevMonth } from "@/lib/dates";
import { money, moneyFull, moneySigned, multiple, num, pct, pctPlain } from "@/lib/format";
import { aggregate, type PromoMetrics } from "@/lib/metrics";
import { cn } from "@/lib/utils";
import { ChangePill, Delta } from "./bits";

/*
 * The sections of one promo's report. Each tab is only offered when the promo
 * has the data for it (see availableTabs), and every section copes with
 * individual numbers being missing.
 */

export type TabKey = "overview" | "players" | "missions" | "rankings" | "financials";

export function availableTabs(m: PromoMetrics): Array<{ key: TabKey; label: string }> {
  const p = m.promo;
  const tabs: Array<{ key: TabKey; label: string }> = [{ key: "overview", label: "Overview" }];
  if (m.participants != null || p.playersBefore != null || p.playersDuring != null) tabs.push({ key: "players", label: "Players" });
  if (m.missions) tabs.push({ key: "missions", label: "Missions" });
  if (m.leaderboard) tabs.push({ key: "rankings", label: "Rankings" });
  if (m.ggrBefore != null || m.ggrDuring != null || p.prizePool != null) tabs.push({ key: "financials", label: "Financials" });
  return tabs;
}

/* ------------------------------------------------------------------ shared */

function Metric({ label, value, hint, className }: { label: string; value: ReactNode; hint?: ReactNode; className?: string }) {
  return (
    <div className={cn("min-w-0 rounded-xl border border-border bg-surface p-3.5", className)}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-xl font-bold">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Card({ title, subtitle, children, className }: { title: string; subtitle?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("panel min-w-0 p-4 sm:p-5", className)}>
      <h3 className="font-display text-base font-semibold">{title}</h3>
      {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

/** Horizontal bars with value labels; widths relative to the largest value. */
function Bars({ rows }: { rows: Array<{ key: string; label: ReactNode; value: number | null; display: string; color?: string; note?: ReactNode }> }) {
  const max = Math.max(1, ...rows.map((r) => Math.abs(r.value ?? 0)));
  return (
    <div className="space-y-2.5">
      {rows.map((r) => (
        <div key={r.key} className="grid grid-cols-[minmax(0,7rem)_1fr_7.5rem] items-center gap-3 text-sm sm:grid-cols-[minmax(0,12rem)_1fr_9rem]">
          <span className="truncate text-muted-foreground">{r.label}</span>
          <div className="h-2.5 overflow-hidden rounded-r-[4px] bg-surface-raised">
            <div
              className="h-full rounded-r-[4px] transition-[width] duration-700"
              style={{ width: `${r.value == null ? 0 : (Math.max(0, r.value) / max) * 100}%`, background: r.color ?? "var(--series-before)" }}
            />
          </div>
          <span className="text-right tabular">
            <span className="font-medium">{r.display}</span>
            {r.note && <span className="ml-2 text-xs">{r.note}</span>}
          </span>
        </div>
      ))}
    </div>
  );
}

function NotFinal({ m }: { m: PromoMetrics }) {
  if (m.status === "complete") return null;
  const text =
    m.status === "upcoming"
      ? "This promo hasn't started yet."
      : m.status === "live"
        ? "This promo is still running — numbers are so far, not final."
        : `The promo has ended, but the after period runs until ${formatDay(m.afterEnd, true)}. Results aren't final yet.`;
  return <p className="rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-xs">{text}</p>;
}

/* ---------------------------------------------------------------- overview */

export function OverviewTab({ m, currency, all }: { m: PromoMetrics; currency: string; all: PromoMetrics[] }) {
  const p = m.promo;
  const windows = [
    { ...PHASES[0], value: m.ggrBefore, dates: formatRange(m.beforeStart, m.beforeEnd), change: null as number | null },
    { ...PHASES[1], value: m.ggrDuring, dates: formatRange(p.startDate, p.endDate), change: m.duringVsBefore },
    { ...PHASES[2], value: m.ggrAfter, dates: formatRange(m.afterStart, m.afterEnd), change: m.afterVsBefore },
  ];
  const extra = m.incrementalGgr == null ? null : m.incrementalGgr + (m.haloGgr ?? 0);

  return (
    <div className="space-y-4">
      <NotFinal m={m} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric label="GGR change" value={<ChangePill value={m.primaryChange} adjusted={m.isAdjusted} />} hint="per day, during vs before" />
        <Metric label="Extra GGR" value={moneySigned(extra, currency)} hint="during + after, over the before run-rate" />
        <Metric label="Unique participants" value={m.participants == null ? "—" : num(m.participants)} hint={m.newShare != null ? `${pctPlain(m.newShare)} new players` : undefined} />
        <Metric
          label="Net impact"
          value={p.prizePool ? moneySigned(m.netImpact, currency) : "—"}
          hint={p.prizePool ? `after ${money(p.prizePool, currency)} promo cost${m.status !== "complete" ? " · not final" : ""}` : "no promo cost entered"}
        />
      </div>

      <ImpactNote m={m} />

      <div className="grid gap-4 lg:grid-cols-5">
        <Card title="GGR before, during and after" subtitle={`${m.windowDays}-day before and after periods vs the ${m.promoDays}-day promo`} className="lg:col-span-3">
          <div className="mb-4 grid grid-cols-3 gap-2">
            {windows.map((w) => (
              <div key={w.key} className="min-w-0 rounded-xl border border-border bg-surface p-2.5 sm:p-3">
                <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <span className="size-2 rounded-full" style={{ background: w.color }} />
                  {w.label}
                </p>
                <p className="mt-1 font-display text-lg font-bold sm:text-xl">{money(w.value, currency)}</p>
                <p className="text-xs">{w.change == null ? <span className="text-muted-foreground">{w.key === "before" ? "baseline" : "—"}</span> : <Delta value={w.change} />}</p>
                <p className="mt-1 hidden text-[11px] text-muted-foreground sm:block">{w.dates}</p>
              </div>
            ))}
          </div>
          {p.daily?.length ? (
            <DailyTimeline
              daily={p.daily}
              before={{ start: m.beforeStart, end: m.beforeEnd }}
              during={{ start: p.startDate, end: p.endDate }}
              after={{ start: m.afterStart, end: m.afterEnd }}
              perDay={{ before: m.perDayBefore, during: m.perDayDuring, after: m.perDayAfter }}
              format={(v) => money(v, currency)}
              formatFull={(v) => moneyFull(v, currency)}
              height={210}
            />
          ) : (
            <p className="text-xs text-muted-foreground">A day-by-day chart appears when daily GGR is available (from the Back Office).</p>
          )}
        </Card>
        <div className="min-w-0 space-y-4 lg:col-span-2">
          <Card title="In short">
            <ul className="space-y-2 text-sm leading-relaxed">
              {summaryLines(m, currency).map((t, i) => (
                <li key={i}>{t}</li>
              ))}
            </ul>
            {p.notes && (
              <div className="mt-4 border-t border-border pt-3 text-sm">
                <p className="mb-1 text-eyebrow">Notes</p>
                <p className="whitespace-pre-wrap text-muted-foreground">{p.notes}</p>
              </div>
            )}
          </Card>
          <PastPromos m={m} all={all} />
        </div>
      </div>
    </div>
  );
}

/** Whether the change can be called the promo's own effect — stated plainly. */
function ImpactNote({ m }: { m: PromoMetrics }) {
  if (m.primaryChange == null) return null;
  if (m.isAdjusted)
    return (
      <div className="flex gap-2.5 rounded-lg border border-good/30 bg-good/5 px-3.5 py-2.5 text-sm">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-good-ink" />
        <p>
          <strong className="font-semibold">Adjusted for the market trend.</strong> The comparison group ({m.promo.controlLabel || "no description"}) moved{" "}
          {pct(m.controlChange)} over the same days, while this promo's GGR moved {pct(m.duringVsBefore)}. The estimated promo effect is{" "}
          <strong className="font-semibold">{pct(m.adjustedChange)}</strong>.
        </p>
      </div>
    );
  return (
    <div className="flex gap-2.5 rounded-lg border border-border bg-surface-raised/60 px-3.5 py-2.5 text-sm">
      <CircleAlert className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <p className="text-muted-foreground">
        <strong className="font-semibold text-foreground">Not adjusted for the market trend.</strong> This compares GGR before and during the
        promo. It may also reflect seasonality, other promos or general market movement, so it isn't proof the promo caused the change.
        Adding a comparison group makes it an incremental estimate.
      </p>
    </div>
  );
}

/** Historical comparison: the same type of promo in the past. */
function PastPromos({ m, all }: { m: PromoMetrics; all: PromoMetrics[] }) {
  const peers = all.filter((x) => x.promo.type === m.promo.type && x.promo.id !== m.promo.id && x.primaryChange != null);
  if (!peers.length) return null;
  const ranked = [...peers, m].filter((x) => x.primaryChange != null).sort((a, b) => b.primaryChange! - a.primaryChange!);
  const rank = ranked.findIndex((x) => x.promo.id === m.promo.id) + 1;
  const typical = aggregate(peers).duringVsBefore;
  const recent = [...peers].sort((a, b) => b.promo.startDate.localeCompare(a.promo.startDate)).slice(0, 4);
  return (
    <Card
      title={`Other ${m.promo.type} promos`}
      subtitle={
        <>
          {peers.length} to compare with · they averaged {pct(typical)} (raw)
          {rank > 0 && m.primaryChange != null ? ` · this one ranks ${rank} of ${ranked.length}` : ""}
        </>
      }
    >
      <ul className="divide-y divide-border">
        {recent.map((x) => (
          <li key={x.promo.id}>
            <Link
              to="/promo/$promoId"
              params={{ promoId: x.promo.id }}
              className="-mx-2 flex items-center justify-between gap-3 rounded-md px-2 py-2 text-sm hover:bg-surface-raised"
            >
              <span className="min-w-0">
                <span className="block truncate font-medium">{x.promo.name}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {[x.promo.operator, monthLabel(x.month)].filter(Boolean).join(" · ")}
                </span>
              </span>
              <ChangePill value={x.primaryChange} adjusted={x.isAdjusted} />
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/* ----------------------------------------------------------------- players */

export function PlayersTab({ m }: { m: PromoMetrics }) {
  const p = m.promo;
  const active = [p.playersBefore, p.playersDuring, p.playersAfter];
  return (
    <div className="space-y-4">
      <NotFinal m={m} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric label="Unique participants" value={m.participants == null ? "—" : num(m.participants)} hint="took part in the promo" />
        <Metric label="New players" value={m.newShare == null ? "—" : pctPlain(m.newShare)} hint={p.newParticipants != null ? `${num(p.newParticipants)} first-timers` : "of participants"} />
        <Metric label="Participation" value={m.participationRate == null ? "—" : pctPlain(m.participationRate)} hint="of active players during the promo" />
        <Metric label="Retention" value={m.retentionRate == null ? "—" : pctPlain(m.retentionRate)} hint="participants who played again after" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {active.some((v) => v != null) && (
          <Card title="Active players" subtitle="Everyone playing these games in each period, not only participants">
            <Bars
              rows={PHASES.map((ph, i) => ({
                key: ph.key,
                label: ph.label,
                value: active[i],
                display: num(active[i]),
                color: ph.color,
                note: i > 0 ? <Delta value={i === 1 ? m.playersDuringVsBefore : m.playersAfterVsBefore} /> : undefined,
              }))}
            />
            {m.windowDays !== m.promoDays && <p className="mt-3 text-xs text-muted-foreground">Periods differ in length, so player changes aren't compared.</p>}
          </Card>
        )}
        {m.participants != null && (
          <Card title="Participants" subtitle="From taking part to coming back after the promo">
            <Bars
              rows={[
                { key: "all", label: "Took part", value: m.participants, display: num(m.participants) },
                { key: "new", label: "Of which new players", value: p.newParticipants ?? null, display: num(p.newParticipants) },
                { key: "ret", label: "Played again after", value: p.retainedParticipants ?? null, display: num(p.retainedParticipants), color: "var(--series-after)" },
              ]}
            />
            {m.betsPerParticipant != null && (
              <p className="mt-4 text-sm">
                Engagement: <strong className="font-semibold">{m.betsPerParticipant.toFixed(0)} bets</strong>{" "}
                <span className="text-muted-foreground">per participant during the promo</span>
              </p>
            )}
          </Card>
        )}
      </div>
      <p className="text-[11px] text-muted-foreground">Aggregate counts only — the report never shows individual players.</p>
    </div>
  );
}

/* ---------------------------------------------------------------- missions */

export function MissionsTab({ m }: { m: PromoMetrics }) {
  const f = m.missions!;
  const hardest = f.hardestStep != null ? f.steps[f.hardestStep] : null;
  return (
    <div className="space-y-4">
      <NotFinal m={m} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric label="Started" value={num(f.steps[0].reached)} hint={f.steps[0].name} />
        <Metric label="Completed all" value={num(f.steps[f.steps.length - 1].reached)} hint={f.steps[f.steps.length - 1].name} />
        <Metric label="Completion rate" value={pctPlain(f.completionRate)} hint="finished ÷ started" />
        <Metric
          label="Hardest step"
          value={<span className="text-base">{hardest?.name ?? "—"}</span>}
          hint={hardest?.dropFromPrev != null ? `${pctPlain(hardest.dropFromPrev)} of players dropped here` : undefined}
        />
      </div>
      <Card title="Progression" subtitle="Players reaching each step, as a share of those who started. The drop is versus the step before.">
        <div className="space-y-3">
          {f.steps.map((st, i) => (
            <div key={st.name + i} className="grid grid-cols-[minmax(0,10rem)_1fr_auto] items-center gap-3 text-sm sm:grid-cols-[minmax(0,14rem)_1fr_auto]">
              <span className={cn("truncate", i === f.hardestStep && "font-semibold")}>
                {i + 1}. {st.name}
              </span>
              <div className="h-5 overflow-hidden rounded-r-[4px] bg-surface-raised">
                <div
                  className="h-full rounded-r-[4px]"
                  style={{ width: `${st.ofStart * 100}%`, background: i === f.hardestStep ? "var(--series-during)" : "var(--series-before)" }}
                />
              </div>
              <span className="w-32 text-right tabular">
                <span className="font-medium">{num(st.reached)}</span>{" "}
                <span className="text-xs text-muted-foreground">{pctPlain(st.ofStart)}</span>
                {st.dropFromPrev != null && <span className="ml-1.5 text-xs text-bad-ink">−{pctPlain(st.dropFromPrev)}</span>}
              </span>
            </div>
          ))}
        </div>
        {hardest && (
          <p className="mt-4 text-sm text-muted-foreground">
            The biggest drop-off is at <strong className="font-semibold text-foreground">{hardest.name}</strong> — worth checking whether
            it's too hard or unclear.
          </p>
        )}
      </Card>
    </div>
  );
}

/* ---------------------------------------------------------------- rankings */

export function RankingsTab({ m, currency }: { m: PromoMetrics; currency: string }) {
  const lb = m.leaderboard!;
  const top = lb.bands[0];
  return (
    <div className="space-y-4">
      <NotFinal m={m} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric label="Winners" value={num(lb.winners)} hint={lb.winRate != null ? `${pctPlain(lb.winRate, 1)} of participants` : undefined} />
        <Metric label="Prizes paid" value={money(lb.totalPrize, currency)} />
        <Metric label={`Top prize (${top.band})`} value={pctPlain(top.share)} hint="of the prize pool" />
        <Metric label="Rank bands" value={lb.bands.length} />
      </div>
      <Card title="Prize distribution" subtitle="How the prize pool was split across ranks (aggregate by band)">
        <Bars
          rows={lb.bands.map((b) => ({
            key: b.band,
            label: `${b.band} · ${b.winners} winner${b.winners === 1 ? "" : "s"}`,
            value: b.prize,
            display: money(b.prize, currency),
            color: "var(--series-during)",
            note: <span className="text-muted-foreground">{pctPlain(b.share)}</span>,
          }))}
        />
      </Card>
    </div>
  );
}

/* -------------------------------------------------------------- financials */

export function FinancialsTab({ m, currency, fxNote }: { m: PromoMetrics; currency: string; fxNote: string | null }) {
  const p = m.promo;
  const rows: Array<{ label: string; before: number | null; during: number | null; after: number | null; isPct?: boolean; change?: number | null; afterChange?: number | null }> = [
    { label: "GGR", before: m.ggrBefore, during: m.ggrDuring, after: m.ggrAfter, change: m.duringVsBefore, afterChange: m.afterVsBefore },
    { label: "Turnover", before: m.turnoverBefore, during: m.turnoverDuring, after: m.turnoverAfter, change: m.turnoverChange },
    {
      label: "GGR margin (GGR ÷ turnover)",
      before: m.marginBefore,
      during: m.marginDuring,
      after: m.turnoverAfter && m.ggrAfter != null ? m.ggrAfter / m.turnoverAfter : null,
      isPct: true,
    },
  ];
  const extra = m.incrementalGgr == null ? null : m.incrementalGgr + (m.haloGgr ?? 0);
  const fmt = (v: number | null, isPct?: boolean) => (isPct ? (v == null ? "—" : `${(v * 100).toFixed(2)}%`) : money(v, currency));

  return (
    <div className="space-y-4">
      <NotFinal m={m} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric label="Promo cost" value={money(p.prizePool, currency)} hint={m.costPerParticipant != null ? `${money(m.costPerParticipant, currency)} per participant` : "rewards paid"} />
        <Metric label="Extra GGR" value={moneySigned(extra, currency)} hint={`${moneySigned(m.incrementalGgr, currency)} during · ${moneySigned(m.haloGgr, currency)} after`} />
        <Metric label="Net impact" value={moneySigned(m.netImpact, currency)} hint="extra GGR − promo cost" />
        <Metric label="Return on cost" value={m.roi == null ? "—" : multiple(m.roi)} hint="net impact ÷ promo cost" />
      </div>

      <Card title="Before, during and after" subtitle={`Totals per period, in ${currency}. % changes are per day.`}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr className="border-b border-border">
                <th className="py-2 pr-3 font-medium" />
                {PHASES.map((ph) => (
                  <th key={ph.key} className="px-3 py-2 text-right font-medium">
                    <span className="mr-1.5 inline-block size-2 rounded-full" style={{ background: ph.color }} />
                    {ph.label}
                  </th>
                ))}
                <th className="px-3 py-2 text-right font-medium">During vs before</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border tabular">
              {rows.map((r) => (
                <tr key={r.label}>
                  <td className="py-2.5 pr-3 font-medium">{r.label}</td>
                  <td className="px-3 py-2.5 text-right">{fmt(r.before, r.isPct)}</td>
                  <td className="px-3 py-2.5 text-right">{fmt(r.during, r.isPct)}</td>
                  <td className="px-3 py-2.5 text-right">{fmt(r.after, r.isPct)}</td>
                  <td className="px-3 py-2.5 text-right">{r.isPct ? "" : <Delta value={r.change ?? null} />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Market trend">
          {m.isAdjusted ? (
            <p className="text-sm">
              Comparison group ({p.controlLabel || "no description"}): GGR {money(p.controlGgrBefore, currency)} → {money(p.controlGgrDuring, currency)}, {pct(m.controlChange)}. Extra GGR above is measured against the
              before run-rate moved by that trend.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">No comparison group for this promo, so the extra GGR is measured against the plain before run-rate.</p>
          )}
        </Card>
        <Card title="Month">
          {m.monthGgr != null || m.prevMonthGgr != null ? (
            <p className="text-sm">
              Total GGR in {monthLabel(m.month, "long")}: <strong className="font-semibold">{money(m.monthGgr, currency)}</strong>,{" "}
              <Delta value={m.monthVsPrev} /> vs {monthLabel(prevMonth(m.month), "long")}. Month totals cover all operators, so they show the
              wider picture, not this promo's effect.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">No monthly totals for this month yet.</p>
          )}
        </Card>
      </div>
      {fxNote && <p className="text-[11px] text-muted-foreground">{fxNote}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ text */

/** A few plain sentences — descriptive, and only causal when adjusted for the market trend. */
export function summaryLines(m: PromoMetrics, cur: string): string[] {
  const out: string[] = [];
  if (m.promo.fxMissing) return [`There's no exchange rate for ${m.promo.currency}, so money figures can't be shown. Add one in Data → Settings.`];
  if (m.perDayBefore == null) return ["Add the GGR before the promo to see how it compares."];
  if (m.duringVsBefore != null) {
    const dir = m.duringVsBefore >= 0 ? "higher" : "lower";
    out.push(
      `GGR per day was ${pctPlain(Math.abs(m.duringVsBefore), 1)} ${dir} ${m.status === "live" ? "so far" : "during the promo"} than in the ${m.windowDays} days before.`,
    );
    if (m.isAdjusted)
      out.push(`The comparison group moved ${pct(m.controlChange)} over the same days, so the promo's estimated own effect is ${pct(m.adjustedChange)}.`);
  } else {
    out.push("GGR for the promo period isn't in yet.");
  }
  if (m.afterVsBefore != null) {
    out.push(
      Math.abs(m.afterVsBefore) < 0.03
        ? "After it ended, GGR went back to about the before level."
        : m.afterVsBefore > 0
          ? `After it ended, GGR stayed ${pctPlain(m.afterVsBefore, 1)} above the before level.`
          : `After it ended, GGR was ${pctPlain(Math.abs(m.afterVsBefore), 1)} below the before level.`,
    );
  }
  if (m.promo.prizePool && m.netImpact != null && m.status !== "complete") {
    out.push("Whether it earned back its cost will be known once the promo is fully measured.");
  } else if (m.promo.prizePool && m.netImpact != null) {
    out.push(
      m.netImpact >= 0
        ? `Extra GGR covered the ${money(m.promo.prizePool, cur)} promo cost, leaving ${money(m.netImpact, cur)}.`
        : `Extra GGR didn't cover the ${money(m.promo.prizePool, cur)} promo cost (${moneySigned(m.netImpact, cur)}).`,
    );
  }
  return out;
}
