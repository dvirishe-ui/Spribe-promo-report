import { CalendarDays } from "lucide-react";
import { DailyTimeline } from "@/components/charts/DailyTimeline";
import { PHASES } from "@/components/charts/core";
import { formatRange, monthLabel, prevMonth } from "@/lib/dates";
import { money, moneyFull, pct } from "@/lib/format";
import type { PromoMetrics } from "@/lib/metrics";
import { cn } from "@/lib/utils";
import { Delta, LiveBadge, ResultPill } from "./bits";

/** One promo's report. Used in the side panel and on the full page. */
export function PromoSummary({ m, currency }: { m: PromoMetrics; currency: string }) {
  const p = m.promo;
  const windows = [
    { ...PHASES[0], value: m.ggrBefore, dates: formatRange(m.beforeStart, m.beforeEnd), change: null },
    { ...PHASES[1], value: m.ggrDuring, dates: formatRange(p.startDate, p.endDate), change: m.duringVsBefore },
    { ...PHASES[2], value: m.ggrAfter, dates: formatRange(m.afterStart, m.afterEnd), change: m.afterVsBefore },
  ];

  return (
    <div className="space-y-5">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <ResultPill value={m.duringVsBefore} />
          <LiveBadge status={m.status} />
        </div>
        <h2 className="mt-2 text-2xl">{p.name}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {[p.operator, p.games.join(", "), p.market].filter(Boolean).join(" · ")}
        </p>
        <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
          <CalendarDays className="size-3.5" />
          {formatRange(p.startDate, p.endDate)} · {m.promoDays} day{m.promoDays === 1 ? "" : "s"}
        </p>
      </div>

      {/* Before / During / After */}
      <div className="grid grid-cols-3 gap-2">
        {windows.map((w) => (
          <div key={w.key} className="rounded-xl border border-border bg-surface p-3">
            <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <span className="size-2 rounded-full" style={{ background: w.color }} />
              {w.label}
            </p>
            <p className="mt-1 font-display text-xl font-bold">{money(w.value, currency)}</p>
            <p className="text-xs">{w.change == null ? <span className="text-muted-foreground">{w.key === "before" ? "baseline" : "—"}</span> : <Delta value={w.change} />}</p>
            <p className="mt-1 hidden text-[11px] text-muted-foreground sm:block">{w.dates}</p>
          </div>
        ))}
      </div>

      {p.daily?.length ? (
        <div className="rounded-xl border border-border bg-surface p-3">
          <p className="mb-2 text-xs font-medium text-muted-foreground">GGR per day</p>
          <DailyTimeline
            daily={p.daily}
            before={{ start: m.beforeStart, end: m.beforeEnd }}
            during={{ start: p.startDate, end: p.endDate }}
            after={{ start: m.afterStart, end: m.afterEnd }}
            perDay={{ before: m.perDayBefore, during: m.perDayDuring, after: m.perDayAfter }}
            format={(v) => money(v, currency)}
            formatFull={(v) => moneyFull(v, currency)}
            height={220}
          />
        </div>
      ) : (
        <SimpleBars windows={windows} currency={currency} />
      )}

      <div className="rounded-xl border border-border bg-surface-raised/60 p-4 text-sm leading-relaxed">
        <p className="mb-1 text-eyebrow">In short</p>
        <ul className="space-y-1.5">
          {summaryLines(m, currency).map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ul>
      </div>

      {p.notes && (
        <div className="text-sm">
          <p className="mb-1 text-eyebrow">Notes</p>
          <p className="whitespace-pre-wrap text-muted-foreground">{p.notes}</p>
        </div>
      )}
    </div>
  );
}

function SimpleBars({
  windows,
  currency,
}: {
  windows: Array<{ key: string; label: string; color: string; value: number | null }>;
  currency: string;
}) {
  const max = Math.max(1, ...windows.map((w) => Math.abs(w.value ?? 0)));
  return (
    <div className="space-y-2.5 rounded-xl border border-border bg-surface p-4">
      {windows.map((w) => (
        <div key={w.key} className="grid grid-cols-[52px_1fr_72px] items-center gap-3 text-xs">
          <span className="text-muted-foreground">{w.label}</span>
          <div className="h-2.5 overflow-hidden rounded-r-[4px] bg-surface-raised">
            <div
              className={cn("h-full rounded-r-[4px] transition-[width] duration-700")}
              style={{ width: `${w.value == null ? 0 : (Math.max(0, w.value) / max) * 100}%`, background: w.color }}
            />
          </div>
          <span className="text-right font-medium tabular">{money(w.value, currency)}</span>
        </div>
      ))}
    </div>
  );
}

/** Two to four plain sentences — what you'd say about the promo in a meeting. */
export function summaryLines(m: PromoMetrics, cur: string): string[] {
  const out: string[] = [];
  if (m.perDayBefore == null) return ["Add the GGR before the promo to see how it did."];
  if (m.duringVsBefore != null) {
    const dir = m.duringVsBefore >= 0 ? "up" : "down";
    out.push(
      `${m.status === "live" ? "So far, GGR is" : "During the promo, GGR was"} ${dir} ${pct(Math.abs(m.duringVsBefore)).replace("+", "")} compared with the ${m.windowDays} days before.`,
    );
  } else {
    out.push("GGR for the promo period isn't in yet.");
  }
  if (m.afterVsBefore != null) {
    out.push(
      Math.abs(m.afterVsBefore) < 0.03
        ? "After it ended, GGR went back to about the same level as before."
        : m.afterVsBefore > 0
          ? `After it ended, GGR stayed ${pct(m.afterVsBefore).replace("+", "")} higher than before.`
          : `After it ended, GGR was ${pct(Math.abs(m.afterVsBefore)).replace("+", "")} lower than before.`,
    );
  } else if (m.status !== "complete") {
    out.push("The after-promo numbers will come once it has ended.");
  }
  if (m.promo.prizePool && m.incrementalGgr != null) {
    out.push(
      `It brought about ${money(m.incrementalGgr + (m.haloGgr ?? 0), cur)} extra GGR on a ${money(m.promo.prizePool, cur)} prize pool.`,
    );
  }
  if (m.monthVsPrev != null) {
    out.push(`${monthLabel(m.month, "long", false)} total GGR was ${pct(m.monthVsPrev)} vs ${monthLabel(prevMonth(m.month), "long", false)}.`);
  }
  return out;
}
