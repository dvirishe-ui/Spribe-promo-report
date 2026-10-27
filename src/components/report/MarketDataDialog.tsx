import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { isValidIsoDay } from "@/lib/dates";
import type { MarketMetricKey, MarketTrend } from "@/lib/types";
import { Field, inputCls } from "./bits";

const METRICS: Array<{ key: MarketMetricKey; label: string; hint?: string }> = [
  { key: "ggr", label: "Market GGR change" },
  { key: "wager", label: "Market wager change" },
  { key: "bets", label: "Market bets change" },
  { key: "players", label: "Market active players change" },
  { key: "activity", label: "Activity index change", hint: "e.g. the Blask Index (search demand) — not GGR" },
];

/** "8.4", "+8.4%", "-6,1" → 0.084 / −0.061; empty → undefined; anything else → NaN. */
function parsePct(s: string): number | undefined {
  const t = s.trim().replace("%", "").replace(",", ".").replace("−", "-");
  if (!t) return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? n / 100 : Number.NaN;
}

const toText = (v: number | undefined) => (v == null ? "" : String(Math.round(v * 10000) / 100));

/**
 * Type in how a market moved over a promo's dates — e.g. figures read from
 * Blask. Saved in this browser and always labelled "entered manually".
 */
export function MarketDataDialog({
  open,
  onOpenChange,
  initial,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: MarketTrend;
  onSave: (t: MarketTrend) => void;
}) {
  const [d, setD] = useState(initial);
  const [vals, setVals] = useState<Record<MarketMetricKey, string>>(() => ({
    ggr: toText(initial.changes.ggr),
    wager: toText(initial.changes.wager),
    bets: toText(initial.changes.bets),
    players: toText(initial.changes.players),
    activity: toText(initial.changes.activity),
  }));
  const set = <K extends keyof MarketTrend>(k: K, v: MarketTrend[K]) => setD((x) => ({ ...x, [k]: v }));
  const isBlask = d.provider.trim().toLowerCase() === "blask";

  const save = () => {
    const dates = [d.from, d.to, d.baselineFrom, d.baselineTo];
    if (!d.market.trim()) return toast.error("Add the market.");
    if (!dates.every(isValidIsoDay)) return toast.error("Fill in all four dates.");
    if (d.from > d.to || d.baselineFrom > d.baselineTo) return toast.error("A period ends before it starts.");
    const changes: MarketTrend["changes"] = {};
    for (const m of METRICS) {
      const n = parsePct(vals[m.key]);
      if (n == null) continue;
      if (Number.isNaN(n)) return toast.error(`${m.label}: enter a number such as 8.4 or -6.1`);
      changes[m.key] = n;
    }
    if (!Object.keys(changes).length) return toast.error("Enter at least one change.");
    onSave({
      ...d,
      provider: d.provider.trim() || "Unnamed source",
      market: d.market.trim(),
      changes,
      activityLabel: changes.activity != null ? d.activityLabel?.trim() || (isBlask ? "Blask Index (search demand)" : `${d.provider.trim()} activity index`) : undefined,
      origin: "manual",
      enteredAt: new Date().toISOString(),
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Market data</DialogTitle>
          <DialogDescription>
            How the market moved over this promo's dates, e.g. read from Blask. Saved in this browser and shown as "entered manually" — never as
            fetched automatically.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Source">
            <input className={inputCls} list="market-providers" value={d.provider} onChange={(e) => set("provider", e.target.value)} placeholder="Blask" />
            <datalist id="market-providers">
              <option value="Blask" />
            </datalist>
          </Field>
          <Field label="Market">
            <input className={inputCls} value={d.market} onChange={(e) => set("market", e.target.value)} />
          </Field>
          <Field label="Period from" hint="The promo's dates">
            <input type="date" className={inputCls} value={d.from} onChange={(e) => set("from", e.target.value)} />
          </Field>
          <Field label="Period to">
            <input type="date" className={inputCls} value={d.to} onChange={(e) => set("to", e.target.value)} />
          </Field>
          <Field label="Compared with, from" hint="The promo's before window">
            <input type="date" className={inputCls} value={d.baselineFrom} onChange={(e) => set("baselineFrom", e.target.value)} />
          </Field>
          <Field label="Compared with, to">
            <input type="date" className={inputCls} value={d.baselineTo} onChange={(e) => set("baselineTo", e.target.value)} />
          </Field>
        </div>

        <p className="mt-4 text-xs text-muted-foreground">
          Change vs the comparison period, in % (per day if the periods differ in length). Fill in only what the source actually reports.
          {isBlask && " Blask's index measures search demand, not GGR — put it under Activity index."}
        </p>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          {METRICS.map((m) => (
            <Field key={m.key} label={`${m.label} (%)`} hint={m.hint}>
              <input
                className={inputCls}
                inputMode="decimal"
                value={vals[m.key]}
                onChange={(e) => setVals((v) => ({ ...v, [m.key]: e.target.value }))}
                placeholder="e.g. 8.4 or -6.1"
              />
            </Field>
          ))}
          {vals.activity.trim() && (
            <Field label="What the activity index is">
              <input
                className={inputCls}
                value={d.activityLabel ?? ""}
                onChange={(e) => set("activityLabel", e.target.value)}
                placeholder={isBlask ? "Blask Index (search demand)" : "Activity index"}
              />
            </Field>
          )}
        </div>
        <Field label="Note (optional)" className="mt-3">
          <input className={inputCls} value={d.note ?? ""} onChange={(e) => set("note", e.target.value)} placeholder="e.g. Blask dashboard, country view, daily" />
        </Field>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={save}>Save market data</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
