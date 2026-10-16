import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ChevronDown, Trash2 } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { computePromo, monthlyMap } from "@/lib/metrics";
import { emptyPromo, toNumber } from "@/lib/normalize";
import { useData } from "@/lib/store";
import { PROMO_TYPES, SPRIBE_GAMES, type PromoRecord } from "@/lib/types";
import { addDays, daysBetween, formatRange, isValidIsoDay } from "@/lib/dates";
import { currencySymbol, moneyFull } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Delta, Field, inputCls } from "./bits";
import { useConfirm } from "./Confirm";

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
}: {
  /** Promo to edit, or null to add a new one */
  promo: PromoRecord | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { dataset, savePromo, deletePromo, editable } = useData();
  const confirm = useConfirm();
  const [draft, setDraft] = useState<Draft>(() => toDraft(promo ?? emptyPromo()));
  const [more, setMore] = useState(false);

  useEffect(() => {
    if (open) {
      setDraft(toDraft(promo ?? emptyPromo()));
      setMore(false);
    }
  }, [open, promo]);

  const cur = dataset.currency;
  const sym = currencySymbol(cur);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));

  const operators = useMemo(() => [...new Set(dataset.promos.map((p) => p.operator).filter(Boolean))].sort(), [dataset.promos]);
  const markets = useMemo(() => [...new Set(dataset.promos.map((p) => p.market).filter(Boolean))].sort(), [dataset.promos]);

  const datesOk = isValidIsoDay(draft.startDate) && isValidIsoDay(draft.endDate) && draft.endDate >= draft.startDate;
  const record = fromDraft(draft);
  const preview = datesOk ? computePromo(record, monthlyMap(dataset.monthly)) : null;
  const promoDays = datesOk ? daysBetween(draft.startDate, draft.endDate) : null;
  const win = record.windowDays && record.windowDays > 0 ? record.windowDays : promoDays;

  const windowHint = (k: "ggrBefore" | "ggrDuring" | "ggrAfter") => {
    if (!datesOk || !win) return "Set the dates first";
    if (k === "ggrBefore") return formatRange(addDays(draft.startDate, -win), addDays(draft.startDate, -1));
    if (k === "ggrDuring") return formatRange(draft.startDate, draft.endDate);
    return formatRange(addDays(draft.endDate, 1), addDays(draft.endDate, win));
  };

  const save = () => {
    if (!draft.name.trim()) return toast.error("Give the promo a name");
    if (!datesOk) return toast.error("Add a start and end date (the end can't be before the start)");
    savePromo({ ...record, name: record.name.trim() });
    toast.success(promo ? "Saved" : "Promo added");
    onOpenChange(false);
  };

  const moneyInput = (k: NumField, label: string, hint?: string) => (
    <Field label={label} hint={hint}>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{sym}</span>
        <input
          inputMode="decimal"
          className={cn(inputCls, "pl-8 tabular")}
          value={draft[k]}
          placeholder="0"
          onChange={(e) => set(k, e.target.value)}
          onBlur={() => {
            const n = toNumber(draft[k]);
            if (n != null) set(k, String(n));
          }}
          disabled={!editable}
        />
      </div>
    </Field>
  );

  const plainInput = (k: NumField, label: string, placeholder = "") => (
    <Field label={label}>
      <input inputMode="numeric" className={cn(inputCls, "tabular")} value={draft[k]} placeholder={placeholder} onChange={(e) => set(k, e.target.value)} disabled={!editable} />
    </Field>
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent aria-describedby={undefined} className="flex w-full flex-col border-border bg-background p-0 sm:max-w-lg">
        <div className="border-b border-border px-5 py-4">
          <SheetTitle className="font-display text-lg font-semibold">{promo ? "Edit promo" : "Add a promo"}</SheetTitle>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
          <section className="grid grid-cols-2 gap-3">
            <Field label="Name" className="col-span-2">
              <input className={inputCls} value={draft.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Aviator Weekend Rain" disabled={!editable} />
            </Field>
            <Field label="Operator">
              <input className={inputCls} list="editor-operators" value={draft.operator} onChange={(e) => set("operator", e.target.value)} disabled={!editable} />
              <datalist id="editor-operators">{operators.map((o) => <option key={o} value={o} />)}</datalist>
            </Field>
            <Field label="Type">
              <Select value={draft.type} onValueChange={(v) => set("type", v)} disabled={!editable}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[...new Set([...PROMO_TYPES, draft.type])].filter(Boolean).map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Start date">
              <input type="date" className={inputCls} value={draft.startDate} onChange={(e) => set("startDate", e.target.value)} disabled={!editable} />
            </Field>
            <Field label="End date">
              <input type="date" className={inputCls} value={draft.endDate} min={draft.startDate || undefined} onChange={(e) => set("endDate", e.target.value)} disabled={!editable} />
            </Field>
            <div className="col-span-2">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">Games</span>
              <div className="flex flex-wrap gap-1.5">
                {[...new Set([...SPRIBE_GAMES, ...draft.games])].map((g) => (
                  <button
                    key={g}
                    type="button"
                    disabled={!editable}
                    onClick={() => set("games", draft.games.includes(g) ? draft.games.filter((x) => x !== g) : [...draft.games, g])}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-xs transition-colors",
                      draft.games.includes(g) ? "border-primary bg-primary/10 font-medium text-foreground" : "border-border text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section>
            <h3 className="mb-1 text-sm font-semibold">GGR</h3>
            <p className="mb-3 text-xs text-muted-foreground">
              {promoDays
                ? `Compare the ${win} days before and after with the ${promoDays} days of the promo.`
                : "Before and after use the same number of days as the promo."}
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              {moneyInput("ggrBefore", "Before", windowHint("ggrBefore"))}
              {moneyInput("ggrDuring", "During", windowHint("ggrDuring"))}
              {moneyInput("ggrAfter", "After", windowHint("ggrAfter"))}
            </div>
            {preview && (preview.duringVsBefore != null || preview.afterVsBefore != null) && (
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 rounded-lg bg-surface-raised px-3 py-2 text-sm">
                <span>
                  During vs before <Delta value={preview.duringVsBefore} />
                </span>
                <span>
                  After vs before <Delta value={preview.afterVsBefore} />
                </span>
              </div>
            )}
          </section>

          <section>
            <button type="button" onClick={() => setMore((v) => !v)} className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
              <ChevronDown className={cn("size-4 transition-transform", more && "rotate-180")} />
              More details (optional)
            </button>
            {more && (
              <div className="mt-3 grid grid-cols-2 gap-3">
                {moneyInput("prizePool", "Prize pool", toNumber(draft.prizePool) != null ? `= ${moneyFull(toNumber(draft.prizePool), cur)}` : undefined)}
                <Field label="Market">
                  <input className={inputCls} list="editor-markets" value={draft.market} onChange={(e) => set("market", e.target.value)} placeholder="e.g. Brazil" disabled={!editable} />
                  <datalist id="editor-markets">{markets.map((o) => <option key={o} value={o} />)}</datalist>
                </Field>
                {plainInput("windowDays", "Days to compare before/after", promoDays ? String(promoDays) : "same as promo")}
                <span />
                {plainInput("playersBefore", "Players before")}
                {plainInput("playersDuring", "Players during")}
                {plainInput("playersAfter", "Players after")}
                <span />
                <Field label="Notes" className="col-span-2">
                  <textarea className={cn(inputCls, "h-20 resize-y py-2")} value={draft.notes} onChange={(e) => set("notes", e.target.value)} disabled={!editable} />
                </Field>
              </div>
            )}
          </section>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-border px-5 py-3">
          {promo && editable ? (
            <Button
              variant="ghost"
              className="text-bad-ink"
              onClick={async () => {
                if (await confirm({ title: `Delete "${promo.name}"?`, description: "This can't be undone.", confirmLabel: "Delete", destructive: true })) {
                  deletePromo(promo.id);
                  toast.success("Deleted");
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
              Save
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
