import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { PHASES } from "@/components/charts/core";
import { CircleAlert, ShieldCheck } from "lucide-react";
import { formatDay, monthLabel, prevMonth } from "@/lib/dates";
import { money, moneySigned, multiple, num, pct, pctPlain } from "@/lib/format";
import { aggregate, median, type PromoMetrics } from "@/lib/metrics";
import { cn } from "@/lib/utils";
import { ChangePill, Delta } from "./bits";
import { CompletionByDay, DayDetail } from "./MissionInvestigation";
import { PhaseTable } from "./PhaseTable";

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
  if (m.missions || m.missionDays) tabs.push({ key: "missions", label: "Missions" });
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
  return (
    <div className="space-y-4">
      <NotFinal m={m} />
      <ImpactNote m={m} />

      <div className="grid gap-4 lg:grid-cols-5">
        <Card
          title="Before · During · After"
          subtitle={`Every metric for the ${m.windowDays} days before, the ${m.promoDays}-day promo and the ${m.windowDays} days after`}
          className="lg:col-span-3 lg:self-start"
        >
          <div className="-mx-4 -mb-4 border-t border-border sm:-mx-5 sm:-mb-5">
            <PhaseTable m={m} currency={currency} />
          </div>
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
        <Metric
          label="Took part"
          value={m.participants == null ? "—" : num(m.participants)}
          hint={m.eligibleRate != null ? `${pctPlain(m.eligibleRate)} of ${num(m.eligiblePlayers)} eligible` : "unique participants"}
        />
        <Metric label="Participation" value={m.participationRate == null ? "—" : pctPlain(m.participationRate)} hint="of players active during the promo" />
        <Metric
          label="New vs returning"
          value={m.newShare == null ? "—" : `${pctPlain(m.newShare)} new`}
          hint={m.newShare == null || m.participants == null ? "of participants" : `${num(m.participants - (p.newParticipants ?? 0))} returning players`}
        />
        <Metric label="Came back after" value={m.retentionRate == null ? "—" : pctPlain(m.retentionRate)} hint="participants active in the after period" />
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
          <Card title="Player funnel" subtitle="From being eligible to coming back after the promo">
            <Bars
              rows={[
                ...(m.eligiblePlayers != null ? [{ key: "elig", label: "Eligible", value: m.eligiblePlayers, display: num(m.eligiblePlayers), color: "var(--color-muted-foreground)" }] : []),
                { key: "all", label: "Took part", value: m.participants, display: num(m.participants) },
                ...(completedAll(m) != null ? [{ key: "done", label: "Completed every mission", value: completedAll(m), display: num(completedAll(m)), color: "var(--series-during)" }] : []),
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

function completedAll(m: PromoMetrics): number | null {
  if (m.missions) return m.missions.steps[m.missions.steps.length - 1].reached;
  if (m.missionDays) return m.missionDays.days[m.missionDays.days.length - 1].completed;
  return null;
}

/* ---------------------------------------------------------------- missions */

export function MissionsTab({
  m,
  all,
  day,
  onDay,
}: {
  m: PromoMetrics;
  all: PromoMetrics[];
  day: number | null;
  onDay: (d: number | null) => void;
}) {
  const f = m.missions;
  const s = m.missionDays;
  const hardest = f && f.hardestStep != null ? f.steps[f.hardestStep] : null;
  const rate = s?.overallRate ?? f?.completionRate ?? null;
  return (
    <div className="space-y-4">
      <NotFinal m={m} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <button onClick={() => document.getElementById("completion-by-day")?.scrollIntoView({ behavior: "smooth", block: "center" })} className="text-left" disabled={!s}>
          <Metric
            label="Completion rate"
            value={pctPlain(rate)}
            hint={s ? "of started missions · click for by-day" : "finished ÷ started"}
            className={cn(s && "transition-colors hover:border-primary/60")}
          />
        </button>
        {s ? (
          <>
            <Metric label="Most completed" value={pctPlain(s.mostCompleted.rate)} hint={`Day ${s.mostCompleted.day}: ${s.mostCompleted.requirement}`} />
            <Metric label="Least completed" value={pctPlain(s.leastCompleted.rate)} hint={`Day ${s.leastCompleted.day}: ${s.leastCompleted.requirement}`} />
            <Metric label="Typical time to complete" value={s.typicalMinutes == null ? "—" : `${Math.round(s.typicalMinutes)} min`} hint="median across days" />
          </>
        ) : (
          <>
            <Metric label="Started" value={num(f!.steps[0].reached)} hint={f!.steps[0].name} />
            <Metric label="Completed all" value={num(f!.steps[f!.steps.length - 1].reached)} />
            <Metric label="Hardest step" value={<span className="text-base">{hardest?.name ?? "—"}</span>} hint={hardest?.dropFromPrev != null ? `${pctPlain(hardest.dropFromPrev)} dropped here` : undefined} />
          </>
        )}
      </div>

      {s && <CompletionByDay m={m} selected={day} onSelect={onDay} />}
      {s && day != null && <DayDetail m={m} day={day} all={all} onClose={() => onDay(null)} />}

      {f && (
        <Card title="Player progression" subtitle="Players reaching each step, as a share of those who started. The drop is versus the step before.">
          <div className="space-y-3">
            {f.steps.map((st, i) => (
              <div key={st.name + i} className="grid grid-cols-[minmax(0,10rem)_1fr_auto] items-center gap-3 text-sm sm:grid-cols-[minmax(0,14rem)_1fr_auto]">
                <span className={cn("truncate", i === f.hardestStep && "font-semibold")}>
                  {i + 1}. {st.name}
                </span>
                <div className="h-5 overflow-hidden rounded-r-[4px] bg-surface-raised">
                  <div className="h-full rounded-r-[4px] transition-[width] duration-700" style={{ width: `${st.ofStart * 100}%`, background: i === f.hardestStep ? "var(--series-during)" : "var(--series-before)" }} />
                </div>
                <span className="w-32 text-right tabular">
                  <span className="font-medium">{num(st.reached)}</span> <span className="text-xs text-muted-foreground">{pctPlain(st.ofStart)}</span>
                  {st.dropFromPrev != null && <span className="ml-1.5 text-xs text-bad-ink">−{pctPlain(st.dropFromPrev)}</span>}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {m.gameContribution && (
        <Card title="Game contribution" subtitle="Share of GGR during the promo by game">
          <Bars rows={m.gameContribution.map((g) => ({ key: g.game, label: g.game, value: g.share, display: pctPlain(g.share), color: "var(--series-during)" }))} />
        </Card>
      )}

      {s && (
        <details className="panel group p-4 sm:p-5">
          <summary className="cursor-pointer list-none font-display text-base font-semibold">
            <span className="mr-1 inline-block transition-transform group-open:rotate-90">›</span> All mission days (table)
          </summary>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[620px] text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="py-2 pr-2 font-medium">Day</th>
                  <th className="px-2 py-2 font-medium">Requirement</th>
                  <th className="px-2 py-2 font-medium">Game</th>
                  <th className="px-2 py-2 text-right font-medium">Started</th>
                  <th className="px-2 py-2 text-right font-medium">Completed</th>
                  <th className="px-2 py-2 text-right font-medium">Rate</th>
                  <th className="px-2 py-2 text-right font-medium">Median time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border tabular">
                {s.days.map((d) => (
                  <tr key={d.day} onClick={() => onDay(d.day)} className="cursor-pointer hover:bg-surface-raised">
                    <td className="py-2 pr-2">{d.day}</td>
                    <td className="px-2 py-2">{d.requirement}</td>
                    <td className="px-2 py-2">{d.game}</td>
                    <td className="px-2 py-2 text-right">{num(d.started)}</td>
                    <td className="px-2 py-2 text-right">{num(d.completed)}</td>
                    <td className="px-2 py-2 text-right">{pctPlain(d.rate)}</td>
                    <td className="px-2 py-2 text-right">{d.medianMinutes == null ? "—" : `${d.medianMinutes} min`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
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

export function FinancialsTab({ m, currency, fxNote, all }: { m: PromoMetrics; currency: string; fxNote: string | null; all: PromoMetrics[] }) {
  const peers = all.filter((x) => x.promo.type === m.promo.type && x.promo.id !== m.promo.id && x.status === "complete");
  const peerMed = (pick: (x: PromoMetrics) => number | null) => {
    const xs = peers.map(pick).filter((v): v is number => v != null && Number.isFinite(v));
    return { v: median(xs), n: xs.length };
  };
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
        <Metric label="Promo contribution" value={money(p.prizePool, currency)} hint={m.costPerParticipant != null ? `${money(m.costPerParticipant, currency)} per participant` : "prize fund / rewards paid"} />
        <Metric label="Extra GGR" value={moneySigned(extra, currency)} hint={`${moneySigned(m.incrementalGgr, currency)} during · ${moneySigned(m.haloGgr, currency)} after`} />
        <Metric label="Net impact" value={moneySigned(m.netImpact, currency)} hint="extra GGR − promo contribution" />
        <Metric label="Promo ROI (x)" value={multiple(m.promoRoi)} hint="extra GGR ÷ promo contribution · 1.0× = break-even" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric label="Total wager" value={money(m.turnoverDuring, currency)} hint="wagered during the promo" />
        <Metric label="RTP" value={m.rtp == null ? "—" : `${(m.rtp * 100).toFixed(2)}%${m.rtpReported ? " *" : ""}`} hint={m.rtpReported ? "* reported by the Back Office" : "(total wager − GGR during) ÷ total wager"} />
        <Metric label="Part. rate" value={m.participationRate == null ? "—" : `${pctPlain(m.participationRate, 1)}${m.participationReported ? " *" : ""}`} hint={m.participationReported ? "* reported by the Back Office" : "participants ÷ active players during"} />
        <Metric label="During vs before" value={pct(m.duringVsBefore)} hint={`after vs before ${pct(m.afterVsBefore)} · observed`} />
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
      {peers.length > 0 && (
        <Card title={`Compared with past ${m.promo.type} promos`} subtitle="Median of completed promos of the same type. n = how many have the figure.">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="py-2 pr-3 font-medium" />
                  <th className="px-3 py-2 text-right font-medium">This promo</th>
                  <th className="px-3 py-2 text-right font-medium">Past {m.promo.type}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border tabular">
                {[
                  { l: "GGR change vs baseline", mine: m.primaryChange, p: peerMed((x) => x.primaryChange), f: (v: number | null) => pct(v) },
                  { l: "Cost per participant", mine: m.costPerParticipant, p: peerMed((x) => x.costPerParticipant), f: (v: number | null) => money(v, currency) },
                  { l: "Promo ROI (x)", mine: m.promoRoi, p: peerMed((x) => x.promoRoi), f: (v: number | null) => (v == null ? "—" : multiple(v)) },
                  { l: "GGR margin during", mine: m.marginDuring, p: peerMed((x) => x.marginDuring), f: (v: number | null) => (v == null ? "—" : `${(v * 100).toFixed(2)}%`) },
                ].map((r) => (
                  <tr key={r.l}>
                    <td className="py-2.5 pr-3">{r.l}</td>
                    <td className="px-3 py-2.5 text-right font-medium">{r.f(r.mine)}</td>
                    <td className="px-3 py-2.5 text-right">
                      {r.p.n ? r.f(r.p.v) : "—"} <span className="text-[10px] text-muted-foreground">{r.p.n ? `n=${r.p.n}` : ""}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {m.promo.daily?.length ? (
        <details className="panel group p-4 sm:p-5">
          <summary className="cursor-pointer list-none font-display text-base font-semibold">
            <span className="mr-1 inline-block transition-transform group-open:rotate-90">›</span> Daily GGR (table)
          </summary>
          <div className="mt-3 max-h-80 overflow-auto">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-border tabular">
                {m.promo.daily.map((d) => (
                  <tr key={d.date}>
                    <td className="py-1.5 pr-3 text-muted-foreground">{formatDay(d.date, true)}</td>
                    <td className="py-1.5 text-xs">{d.date < m.promo.startDate ? "Before" : d.date <= m.promo.endDate ? "During" : "After"}</td>
                    <td className="py-1.5 text-right">{money(d.ggr, currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      ) : null}

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
        ? `Extra GGR covered the ${money(m.promo.prizePool, cur)} promo contribution, leaving ${money(m.netImpact, cur)}.`
        : `Extra GGR didn't cover the ${money(m.promo.prizePool, cur)} promo contribution (${moneySigned(m.netImpact, cur)}).`,
    );
  }
  return out;
}
