import { Link } from "@tanstack/react-router";
import { ArrowRight, History } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { TypeBadge, TypeBanner } from "./PromoType";
import { OutcomeChip } from "./ResultHero";
import { ChangePill, StatusBadge } from "./bits";
import type { CalItem } from "@/routes/calendar";
import { useData } from "@/lib/store";
import { formatDay, formatRange } from "@/lib/dates";
import { money, num, pct, pctPlain } from "@/lib/format";
import { flagFor } from "@/lib/markets";
import { outcomeFor } from "@/lib/verdict";
import { campaignRollup, similarPast, typicalFor } from "@/lib/history";
import type { PromoMetrics } from "@/lib/metrics";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2.5">
      <h3 className="text-eyebrow">{title}</h3>
      {children}
    </section>
  );
}

function Fact({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-lg border border-border px-3 py-2">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-medium">{value}</p>
    </div>
  );
}

/** Side panel for one calendar entry: the result first, then what similar promos did before, then the setup. */
export function CalendarDetail({ item, all }: { item: CalItem; all: PromoMetrics[]; onOpen?: (key: string) => void }) {
  const { dataset } = useData();
  const cur = dataset.currency;
  const c = item.campaign;
  const m = item.m;

  const exclude = [...(m ? [m.promo.id] : []), ...item.linked.map((x) => x.promo.id)];
  const target = { type: item.type, games: c?.games ?? m!.promo.games, operator: m?.promo.operator, start: item.start, exclude };
  const past = similarPast(target, all);
  const typical = typicalFor(item.type, all.filter((x) => x.promo.startDate < item.start), exclude);

  return (
    <div className="space-y-6 px-5 pb-10 pt-4">
      <TypeBanner type={item.type} name={item.name} prize={c?.prizePool} image={c?.banner} className="h-36 w-full rounded-xl border border-border" />

      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <TypeBadge type={item.type} />
          <StatusBadge status={item.status} />
          {c && <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">Network campaign · Promo Calendar</span>}
        </div>
        <h2 className="font-display text-2xl font-bold">{item.name}</h2>
        {c?.tagline && <p className="text-sm italic text-muted-foreground">{c.tagline}</p>}
        <p className="text-sm text-muted-foreground">
          {formatRange(item.start, item.end)}
          {m && ` · ${flagFor(m.promo.market)} ${m.promo.market} · ${m.promo.operator}`}
          {c && ` · ${c.region}`}
        </p>
      </div>

      <Section title="How it went">{m ? <PromoResult m={m} cur={cur} /> : <CampaignResult item={item} cur={cur} />}</Section>

      <Section title="Previous promos like this">
        <p className="text-sm">
          {typical.n > 0 ? (
            <>
              Typical {item.type} result: <span className="font-semibold">{pct(typical.change)}</span> GGR vs before{" "}
              <span className="text-muted-foreground">
                (median of {typical.n} completed{typical.n < 3 ? " — small sample" : ""})
              </span>
            </>
          ) : (
            <span className="text-muted-foreground">No completed {item.type} promos before this one.</span>
          )}
        </p>
        {past.length > 0 && (
          <div className="divide-y divide-border rounded-lg border border-border">
            {past.map(({ m: p, reason }) => (
              <Link
                key={p.promo.id}
                to="/promo/$promoId"
                params={{ promoId: p.promo.id }}
                className="flex items-center justify-between gap-3 px-3 py-2.5 transition-colors hover:bg-surface-raised"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {flagFor(p.promo.market)} {p.promo.name}
                  </p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {p.promo.operator} · {formatRange(p.promo.startDate, p.promo.endDate)} · {reason}
                    {p.participants != null && ` · ${num(p.participants)} players`}
                  </p>
                </div>
                <ChangePill value={p.primaryChange} adjusted={p.isAdjusted} className="shrink-0" />
              </Link>
            ))}
          </div>
        )}
        <p className="text-[11px] text-muted-foreground">Past results are context, not a forecast — market, timing, audience and setup differ between promos.</p>
      </Section>

      {c && (
        <Section title="About the campaign">
          <p className="text-sm">{c.summary}</p>
          <div className="grid grid-cols-2 gap-2">
            <Fact label="Markets" value={c.countries.join(", ")} />
            <Fact label="Prize pool" value={c.prizePool} />
            <Fact label="Games" value={c.games.join(", ")} />
            <Fact label="Funding" value={c.funding} />
          </div>
          <div className="space-y-1 text-sm">
            <p>
              <span className="text-muted-foreground">Who qualifies: </span>
              {c.qualification}
            </p>
            <p>
              <span className="text-muted-foreground">Scoring: </span>
              {c.scoring}
            </p>
          </div>
          {c.prizes.length > 0 && (
            <details className="rounded-lg border border-border px-3 py-2 text-sm">
              <summary className="cursor-pointer font-medium">Prizes</summary>
              <ul className="mt-2 space-y-1">
                {c.prizes.map((p) => (
                  <li key={p.place} className="flex justify-between gap-3">
                    <span className="text-muted-foreground">{p.place}</span>
                    <span>{p.prize}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}
          {c.dailyMissions && (
            <details className="rounded-lg border border-border px-3 py-2 text-sm">
              <summary className="cursor-pointer font-medium">Daily missions ({c.dailyMissions.length} days)</summary>
              <ol className="mt-2 space-y-2">
                {c.dailyMissions.map((d) => (
                  <li key={d.day}>
                    <p className="font-medium">
                      Day {d.day} <span className="font-normal text-muted-foreground">· {d.games.join(", ")}</span>
                    </p>
                    <ul className="ml-4 list-disc text-xs text-muted-foreground">
                      {d.tasks.map((t) => (
                        <li key={t}>{t}</li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ol>
            </details>
          )}
          {c.eventLinked && <p className="text-xs text-muted-foreground">Dates are locked to the event; game, prizes and operators are still to be confirmed.</p>}
        </Section>
      )}
    </div>
  );
}

function PromoResult({ m, cur }: { m: PromoMetrics; cur: string }) {
  if (m.status === "upcoming") return <p className="text-sm text-muted-foreground">Starts {formatDay(m.promo.startDate, true)}. Results appear here once it has run.</p>;
  const o = outcomeFor(m, cur);
  const md = m.missionDays;
  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2.5">
        <OutcomeChip m={m} currency={cur} className="mt-0.5" />
        <div>
          <p className="text-sm font-medium">{o.headline}</p>
          <p className="text-xs text-muted-foreground">{o.sub}</p>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Fact label="GGR vs before" value={<ChangePill value={m.primaryChange} adjusted={m.isAdjusted} />} />
        <Fact label="Players took part" value={num(m.participants)} />
        <Fact label="Reward cost" value={money(m.promo.prizePool, cur)} />
      </div>
      {md && (
        <p className="text-xs text-muted-foreground">
          Missions: {pctPlain(md.overallRate)} of started missions completed
          {md.biggestDrop && md.biggestDrop.rateChange! <= -0.15 && `; biggest drop on Day ${md.biggestDrop.day} (${pctPlain(md.biggestDrop.rate)} completed)`}.
        </p>
      )}
      <Button asChild size="sm" variant="outline">
        <Link to="/promo/$promoId" params={{ promoId: m.promo.id }}>
          Open full report <ArrowRight className="ml-1.5 size-4" />
        </Link>
      </Button>
    </div>
  );
}

function CampaignResult({ item, cur }: { item: CalItem; cur: string }) {
  const c = item.campaign!;
  if (item.status === "upcoming" && !item.linked.length)
    return <p className="text-sm text-muted-foreground">Starts {formatDay(c.start, true)}. Operator results appear here once it has run.</p>;
  if (!item.linked.length)
    return (
      <p className="text-sm text-muted-foreground">
        No operator results linked yet. Results show here when promo records carry this campaign's id (<code className="text-xs">{c.id}</code>).
      </p>
    );
  const r = campaignRollup(c, item.linked);
  const rows = [...item.linked].sort((a, b) => (b.primaryChange ?? -9) - (a.primaryChange ?? -9));
  return (
    <div className="space-y-3">
      <p className="text-sm">
        Across {item.linked.length} operator{item.linked.length === 1 ? "" : "s"}:{" "}
        <span className={r.change == null ? "" : r.change >= 0 ? "font-semibold text-good-ink" : "font-semibold text-bad-ink"}>{pct(r.change)}</span> GGR vs before
        <span className="text-muted-foreground"> (observed, weighted by each operator's baseline)</span>
        {r.withParticipants > 0 && (
          <>
            {" · "}
            <span className="font-semibold">{num(r.participants)}</span> players took part
          </>
        )}
      </p>
      <div className="divide-y divide-border rounded-lg border border-border">
        {rows.map((x) => (
          <Link
            key={x.promo.id}
            to="/promo/$promoId"
            params={{ promoId: x.promo.id }}
            className="flex items-center justify-between gap-3 px-3 py-2.5 transition-colors hover:bg-surface-raised"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
                {flagFor(x.promo.market)} {x.promo.operator}
              </p>
              <p className="truncate text-[11px] text-muted-foreground">
                {x.promo.market}
                {x.participants != null && ` · ${num(x.participants)} players`}
                {x.missionDays && ` · ${pctPlain(x.missionDays.overallRate)} missions completed`}
                {x.promo.prizePool != null && ` · ${money(x.promo.prizePool, cur)} cost`}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <ChangePill value={x.primaryChange} adjusted={x.isAdjusted} />
              <History className="hidden size-3.5 text-muted-foreground sm:block" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
