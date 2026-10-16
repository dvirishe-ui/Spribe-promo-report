import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ChevronDown, Trash2 } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { computePromo, monthlyMap } from "@/lib/metrics";
import { emptyPromo, parseBandLines, parseStepLines, toNumber } from "@/lib/normalize";
import { useData } from "@/lib/store";
import { PROMO_TYPES, SPRIBE_GAMES, type PromoRecord } from "@/lib/types";
import { addDays, daysBetween, formatRange, isValidIsoDay } from "@/lib/dates";
import { currencySymbol, moneyFull } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Delta, Field, inputCls } from "./bits";
import { useConfirm } from "./Confirm";
import { MARKETS, marketInfo, marketLabel } from "@/lib/markets";
import { DEFAULT_RATES_TO_EUR } from "@/lib/fx";

const NUM_FIELDS = [
  "windowDays",
  "ggrBefore",
  "ggrDuring",
  "ggrAfter",
  "prizePool",
  "playersBefore",
  "playersDuring",
  "playersAfter",
  "participants",
  "newParticipants",
  "retainedParticipants",
  "betsDuring",
  "turnoverBefore",
  "turnoverDuring",
  "turnoverAfter",
  "controlGgrBefore",
  "controlGgrDuring",
] as const;
type NumField = (typeof NUM_FIELDS)[number];
type Draft = Omit<PromoRecord, NumField> & Record<NumField, string> & { missionsText: string; leaderboardText: string };

const MISSION_TYPES = ["Missions", "Cross-Game Challenge", "Collection Campaign", "New Game Launch"];
const RANKING_TYPES = ["Leaderboard", "Network Tournament", "Seasonal Promotion"];

function toDraft(p: PromoRecord): Draft {
  const d = { ...p } as unknown as Draft;
  for (const f of NUM_FIELDS) d[f] = p[f] == null ? "" : String(p[f]);
  d.missionsText = (p.missions ?? []).map((s) => `${s.name}: ${s.reached}`).join("\n");
  d.leaderboardText = (p.leaderboard ?? []).map((b) => `${b.band}: ${b.winners}: ${b.prize}`).join("\n");
  return d;
}

function fromDraft(d: Draft): PromoRecord {
  const { missionsText, leaderboardText, ...rest } = d;
  const p = { ...rest } as unknown as PromoRecord;
  for (const f of NUM_FIELDS) p[f] = toNumber(d[f]);
  p.missions = parseStepLines(missionsText);
  p.leaderboard = parseBandLines(leaderboardText);
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
  const sym = currencySymbol(draft.currency || cur);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));

  const operators = useMemo(() => [...new Set(dataset.promos.map((p) => p.operator).filter(Boolean))].sort(), [dataset.promos]);
  const markets = useMemo(
    () => [...new Set([...MARKETS.map((m) => m.name), ...dataset.promos.map((p) => p.market).filter(Boolean)])].sort(),
    [dataset.promos],
  );
  const aggregators = useMemo(() => [...new Set(dataset.promos.map((p) => p.aggregator).filter(Boolean))].sort(), [dataset.promos]);
  const promoCurrency = draft.currency || dataset.currency;

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
            <Field label="Aggregator">
              <input className={inputCls} list="editor-aggregators" value={draft.aggregator} onChange={(e) => set("aggregator", e.target.value)} placeholder="or Direct" disabled={!editable} />
              <datalist id="editor-aggregators">{["Direct", ...aggregators.filter((a) => a !== "Direct")].map((o) => <option key={o} value={o} />)}</datalist>
            </Field>
            <Field label="Market">
              <input
                className={inputCls}
                list="editor-markets"
                value={draft.market}
                onChange={(e) => {
                  const v = e.target.value;
                  const info = marketInfo(v);
                  // Picking a known market fills in its usual currency, unless one was already chosen.
                  setDraft((d) => ({ ...d, market: v, currency: info && !d.currency ? info.currency : d.currency }));
                }}
                placeholder="e.g. Brazil"
                disabled={!editable}
              />
              <datalist id="editor-markets">{markets.map((o) => <option key={o} value={o}>{marketLabel(o)}</option>)}</datalist>
            </Field>
            <Field label="Currency of the numbers">
              <Select value={promoCurrency} onValueChange={(v) => set("currency", v)} disabled={!editable}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[...new Set([dataset.currency, promoCurrency, ...Object.keys(DEFAULT_RATES_TO_EUR)])].map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Promotion type" className="col-span-2">
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
              <div className="mt-3 space-y-5">
                <Group title="Cost and comparison">
                  {moneyInput("prizePool", "Promo cost (rewards paid)", toNumber(draft.prizePool) != null ? `= ${moneyFull(toNumber(draft.prizePool), promoCurrency)}` : undefined)}
                  {plainInput("windowDays", "Days to compare before/after", promoDays ? String(promoDays) : "same as promo")}
                </Group>
                <Group title="Players" hint="Totals only — never individual players.">
                  {plainInput("participants", "Unique participants")}
                  {plainInput("newParticipants", "Of which new players")}
                  {plainInput("retainedParticipants", "Played again after")}
                  {plainInput("betsDuring", "Bets by participants")}
                  {plainInput("playersBefore", "Active players before")}
                  {plainInput("playersDuring", "Active players during")}
                  {plainInput("playersAfter", "Active players after")}
                </Group>
                <Group title="Turnover (amount wagered)">
                  {moneyInput("turnoverBefore", "Before")}
                  {moneyInput("turnoverDuring", "During")}
                  {moneyInput("turnoverAfter", "After")}
                </Group>
                <Group title="Comparison group" hint="GGR of a similar group without the promo, same days. Lets the report remove the market trend.">
                  {moneyInput("controlGgrBefore", "Comparison GGR before")}
                  {moneyInput("controlGgrDuring", "Comparison GGR during")}
                  <Field label="What the comparison group is" className="col-span-2">
                    <input className={inputCls} value={draft.controlLabel ?? ""} onChange={(e) => set("controlLabel", e.target.value)} placeholder="e.g. Same games at comparable operators without the promo" disabled={!editable} />
                  </Field>
                </Group>
                {(MISSION_TYPES.includes(draft.type) || draft.missionsText) && (
                  <Field label="Mission steps — one per line: step name: players who reached it">
                    <textarea
                      className={cn(inputCls, "h-24 resize-y py-2 font-mono text-xs")}
                      value={draft.missionsText}
                      onChange={(e) => set("missionsText", e.target.value)}
                      placeholder={"Opted in: 4000\nPlace 20 bets: 2500\nAll missions done: 600"}
                      disabled={!editable}
                    />
                  </Field>
                )}
                {(RANKING_TYPES.includes(draft.type) || draft.leaderboardText) && (
                  <Field label="Prize bands — one per line: ranks: winners: total prize">
                    <textarea
                      className={cn(inputCls, "h-24 resize-y py-2 font-mono text-xs")}
                      value={draft.leaderboardText}
                      onChange={(e) => set("leaderboardText", e.target.value)}
                      placeholder={"1st: 1: 5000\n2nd–10th: 9: 9000\n11th–100th: 90: 6000"}
                      disabled={!editable}
                    />
                  </Field>
                )}
                <Field label="Notes">
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

function Group({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold">{title}</p>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
      <div className="mt-2 grid grid-cols-2 gap-3">{children}</div>
    </div>
  );
}
