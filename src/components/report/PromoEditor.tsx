import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Calculator, Save, Trash2 } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { computePromo, monthlyMap } from "@/lib/metrics";
import { emptyPromo, toNumber } from "@/lib/normalize";
import { useData } from "@/lib/store";
import { PROMO_TYPES, SPRIBE_GAMES, type PromoRecord } from "@/lib/types";
import { addDays, daysBetween, formatRange, isValidIsoDay } from "@/lib/dates";
import { currencySymbol, moneyFull, multiple, pct, moneySigned } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Delta, Field, inputCls } from "./bits";

const NUM_FIELDS = [
  "windowDays",
  "ggrBefore",
  "ggrDuring",
  "ggrAfter",
  "prizePool",
  "playersBefore",
  "playersDuring",
  "playersAfter",
] as const;
type NumField = (typeof NUM_FIELDS)[number];

type Draft = Omit<PromoRecord, NumField> & Record<NumField, string>;

function toDraft(p: PromoRecord): Draft {
  const d = { ...p } as unknown as Draft;
  for (const f of NUM_FIELDS) d[f] = p[f] == null ? "" : String(p[f]);
  return d;
}

function fromDraft(d: Draft): PromoRecord {
  const p = { ...d } as unknown as PromoRecord;
  for (const f of NUM_FIELDS) p[f] = toNumber(d[f]);
  return p;
}

export function PromoEditor({
  promo,
  open,
  onOpenChange,
  onSaved,
}: {
  /** Existing promo to edit, or null to create a new one */
  promo: PromoRecord | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSaved?: (id: string) => void;
}) {
  const { dataset, savePromo, deletePromo, editable } = useData();
  const [draft, setDraft] = useState<Draft>(() => toDraft(promo ?? emptyPromo()));
  const [customGame, setCustomGame] = useState("");

  useEffect(() => {
    if (open) setDraft(toDraft(promo ?? emptyPromo()));
  }, [open, promo]);

  const cur = dataset.currency;
  const sym = currencySymbol(cur);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));

  const suggestions = useMemo(() => {
    const uniq = (xs: string[]) => [...new Set(xs.filter(Boolean))].sort();
    return {
      operators: uniq(dataset.promos.map((p) => p.operator)),
      markets: uniq(dataset.promos.map((p) => p.market)),
      types: uniq([...PROMO_TYPES, ...dataset.promos.map((p) => p.type)]),
    };
  }, [dataset.promos]);

  const datesOk = isValidIsoDay(draft.startDate) && isValidIsoDay(draft.endDate) && draft.endDate >= draft.startDate;
  const record = fromDraft(draft);
  const preview = datesOk ? computePromo(record, monthlyMap(dataset.monthly)) : null;
  const promoDays = datesOk ? daysBetween(draft.startDate, draft.endDate) : null;
  const win = record.windowDays && record.windowDays > 0 ? record.windowDays : promoDays;

  const save = () => {
    if (!draft.name.trim()) return toast.error("Give the promo a name.");
    if (!datesOk) return toast.error("Start and end dates are required, and the end can't be before the start.");
    savePromo({ ...record, name: record.name.trim() });
    toast.success(promo ? "Promo updated" : "Promo added");
    onSaved?.(record.id);
    onOpenChange(false);
  };

  const toggleGame = (g: string) =>
    set("games", draft.games.includes(g) ? draft.games.filter((x) => x !== g) : [...draft.games, g]);

  const money = (k: NumField, label: string, hint?: string) => (
    <Field label={label} hint={toNumber(draft[k]) != null ? `= ${moneyFull(toNumber(draft[k]), cur)}` : hint}>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{sym}</span>
        <input
          inputMode="decimal"
          className={cn(inputCls, "pl-8 tabular")}
          value={draft[k]}
          placeholder="0"
          onChange={(e) => set(k, e.target.value)}
          disabled={!editable}
        />
      </div>
    </Field>
  );

  const count = (k: NumField, label: string) => (
    <Field label={label}>
      <input
        inputMode="numeric"
        className={cn(inputCls, "tabular")}
        value={draft[k]}
        placeholder="optional"
        onChange={(e) => set(k, e.target.value)}
        disabled={!editable}
      />
    </Field>
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col bg-surface p-0 sm:max-w-2xl">
        <div className="border-b border-border px-5 py-4">
          <SheetTitle className="font-display text-lg font-semibold">{promo ? "Edit promo" : "Add a promo"}</SheetTitle>
          <p className="text-xs text-muted-foreground">
            Numbers accept pasted formats like <code>€120,000</code>, <code>120k</code> or <code>1.234,50</code>.
          </p>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
          <section className="grid gap-3 sm:grid-cols-2">
            <Field label="Promo name" className="sm:col-span-2">
              <input className={inputCls} value={draft.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Aviator Weekend Rain" autoFocus disabled={!editable} />
            </Field>
            <Field label="Type">
              <input className={inputCls} list="promo-types" value={draft.type} onChange={(e) => set("type", e.target.value)} disabled={!editable} />
              <datalist id="promo-types">{suggestions.types.map((t) => <option key={t} value={t} />)}</datalist>
            </Field>
            <Field label="Operator">
              <input className={inputCls} list="promo-operators" value={draft.operator} onChange={(e) => set("operator", e.target.value)} disabled={!editable} />
              <datalist id="promo-operators">{suggestions.operators.map((t) => <option key={t} value={t} />)}</datalist>
            </Field>
            <Field label="Market">
              <input className={inputCls} list="promo-markets" value={draft.market} onChange={(e) => set("market", e.target.value)} placeholder="Country / region" disabled={!editable} />
              <datalist id="promo-markets">{suggestions.markets.map((t) => <option key={t} value={t} />)}</datalist>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Start date">
                <input type="date" className={inputCls} value={draft.startDate} onChange={(e) => set("startDate", e.target.value)} disabled={!editable} />
              </Field>
              <Field label="End date">
                <input type="date" className={inputCls} value={draft.endDate} min={draft.startDate || undefined} onChange={(e) => set("endDate", e.target.value)} disabled={!editable} />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">Games</span>
              <div className="flex flex-wrap gap-1.5">
                {[...new Set([...SPRIBE_GAMES, ...draft.games])].map((g) => (
                  <button
                    key={g}
                    type="button"
                    disabled={!editable}
                    onClick={() => toggleGame(g)}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-xs transition-colors",
                      draft.games.includes(g) ? "border-primary bg-primary/15 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {g}
                  </button>
                ))}
                <input
                  className="h-7 w-28 rounded-full border border-dashed border-border bg-transparent px-2.5 text-xs outline-none focus:border-ring"
                  placeholder="+ other game"
                  value={customGame}
                  disabled={!editable}
                  onChange={(e) => setCustomGame(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && customGame.trim()) {
                      e.preventDefault();
                      if (!draft.games.includes(customGame.trim())) set("games", [...draft.games, customGame.trim()]);
                      setCustomGame("");
                    }
                  }}
                />
              </div>
            </div>
          </section>

          <section>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm">GGR per window</h3>
              {datesOk && win && (
                <span className="text-[11px] text-muted-foreground">
                  Before {formatRange(addDays(draft.startDate, -win), addDays(draft.startDate, -1))} · After{" "}
                  {formatRange(addDays(draft.endDate, 1), addDays(draft.endDate, win))}
                </span>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {money("ggrBefore", "GGR before")}
              {money("ggrDuring", "GGR during")}
              {money("ggrAfter", "GGR after", "leave empty until it's in")}
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <Field label="Comparison window (days)" hint={promoDays ? `Empty = same as the promo (${promoDays} days)` : "Empty = same length as the promo"}>
                <input inputMode="numeric" className={cn(inputCls, "tabular")} value={draft.windowDays} placeholder={promoDays ? String(promoDays) : "auto"} onChange={(e) => set("windowDays", e.target.value)} disabled={!editable} />
              </Field>
              {money("prizePool", "Prize pool / cost", "used for ROI")}
            </div>
          </section>

          <section>
            <h3 className="mb-2 text-sm">
              Active players <span className="font-normal text-muted-foreground">(optional)</span>
            </h3>
            <div className="grid gap-3 sm:grid-cols-3">
              {count("playersBefore", "Players before")}
              {count("playersDuring", "Players during")}
              {count("playersAfter", "Players after")}
            </div>
          </section>

          <Field label="Notes">
            <textarea
              className={cn(inputCls, "h-20 resize-y py-2")}
              value={draft.notes}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="Context worth keeping: overlaps, technical issues, mechanics…"
              disabled={!editable}
            />
          </Field>

          {preview && (
            <section className="rounded-xl border border-border bg-surface-raised/50 p-4">
              <h3 className="mb-3 flex items-center gap-2 text-sm">
                <Calculator className="size-4 text-primary" /> Live preview
              </h3>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
                <Preview label="During vs before"><Delta value={preview.duringVsBefore} /></Preview>
                <Preview label="After vs before"><Delta value={preview.afterVsBefore} /></Preview>
                <Preview label="Extra GGR">{moneySigned(preview.incrementalGgr == null ? null : preview.incrementalGgr + (preview.haloGgr ?? 0), cur)}</Preview>
                <Preview label="ROI">{multiple(preview.roi)}</Preview>
                <Preview label="Uplift retained">{preview.upliftRetained == null ? "—" : pct(preview.upliftRetained, 0).replace("+", "")}</Preview>
                <Preview label="Month vs prev">{pct(preview.monthVsPrev)}</Preview>
              </dl>
            </section>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-border px-5 py-3">
          {promo && editable ? (
            <Button
              variant="ghost"
              className="text-bad-ink"
              onClick={() => {
                if (confirm(`Delete "${promo.name}"? This can't be undone.`)) {
                  deletePromo(promo.id);
                  toast.success("Promo deleted");
                  onOpenChange(false);
                }
              }}
            >
              <Trash2 className="size-4" /> Delete
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={!editable}>
              <Save className="size-4" /> Save
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Preview({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
      <dd className="font-medium tabular">{children}</dd>
    </div>
  );
}
