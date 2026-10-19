import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CalendarPlus, Copy, FileSpreadsheet, Lock, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Delta, EmptyState, ResultPill } from "@/components/report/bits";
import { PromoEditor } from "@/components/report/PromoEditor";
import { ImportDialog } from "@/components/report/ImportDialog";
import { SettingsDialog } from "@/components/report/SettingsDialog";
import { useDataStatus } from "@/components/report/DataStatus";
import { useConfirm } from "@/components/report/Confirm";
import { useData } from "@/lib/store";
import { computePromo, monthlyMap } from "@/lib/metrics";
import { toNumber } from "@/lib/normalize";
import { formatRange, monthLabel, nextMonth, prevMonth, todayIso } from "@/lib/dates";
import { num } from "@/lib/format";
import { SOURCE_LABEL } from "@/lib/sources";
import type { PromoRecord } from "@/lib/types";
import { marketLabel } from "@/lib/markets";
import { findDuplicates } from "@/lib/quality";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/report/ViewControls";

export function DataPage() {
  const { dataset, editable, config, copyRemoteToManual } = useData();
  const confirm = useConfirm();
  const [creating, setCreating] = useState(false);

  return (
    <main className="mx-auto max-w-[1600px] space-y-4 px-4 py-5 lg:px-8">
      <PageHeader title="Data & Back Office" after={<span className="hidden text-xs text-muted-foreground sm:inline">Source, import, manual entry and settings</span>} />

      <SourceCard />

      {!editable && (
        <div className="panel flex flex-wrap items-center justify-between gap-3 p-4">
          <p className="flex items-center gap-2 text-sm">
            <Lock className="size-4 text-primary" />
            Numbers are coming from the {SOURCE_LABEL[config.kind]}. Change them there.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              if (
                await confirm({
                  title: "Copy these numbers here to edit them?",
                  description: "Anything typed in on this site before is replaced. Then switch Settings to manual entry.",
                  confirmLabel: "Copy",
                })
              ) {
                copyRemoteToManual();
                toast.success("Copied");
              }
            }}
          >
            <Copy className="size-3.5" /> Copy here to edit
          </Button>
        </div>
      )}

      <div className="flex flex-wrap items-end justify-between gap-3 pt-2">
        <div>
          <h2 className="font-display text-lg font-semibold">Manual entry</h2>
          <p className="text-xs text-muted-foreground">For promos the Back Office doesn't cover yet, or corrections. Saved in this browser.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ImportDialog />
          <Button onClick={() => setCreating(true)} disabled={!editable}>
            <Plus className="size-4" /> Add promo
          </Button>
        </div>
      </div>

      <Tabs defaultValue="promos">
        <TabsList>
          <TabsTrigger value="promos">Promos ({dataset.promos.length})</TabsTrigger>
          <TabsTrigger value="monthly">Monthly GGR ({dataset.monthly.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="promos" className="mt-3">
          <PromosTable onAdd={() => setCreating(true)} />
        </TabsContent>
        <TabsContent value="monthly" className="mt-3">
          <MonthlyTable />
        </TabsContent>
      </Tabs>

      <PromoEditor promo={null} open={creating} onOpenChange={setCreating} />
    </main>
  );
}

/** Current source, freshness and the Back Office connection state — stated honestly. */
function SourceCard() {
  const { config, dataset, metrics } = useData();
  const status = useDataStatus();
  const boConfigured = config.kind === "api" && !!config.apiUrl.trim();
  const ended = metrics.filter((m) => m.status === "complete");
  const incomplete = ended.filter((m) => m.quality.level !== "complete");
  const dups = findDuplicates(dataset.promos);
  return (
    <section className="panel flex flex-wrap items-start justify-between gap-4 p-4 sm:p-5">
      <div className="grid flex-1 gap-4 sm:grid-cols-3">
        <div>
          <p className="text-eyebrow">Source now</p>
          <p className="mt-1 font-medium">{status.label}</p>
          <p className="text-xs text-muted-foreground">{status.detail}</p>
        </div>
        <div>
          <p className="text-eyebrow">Back Office</p>
          <p className="mt-1 font-medium">{boConfigured ? "Configured" : "Not connected yet"}</p>
          <p className="text-xs text-muted-foreground">
            {boConfigured
              ? "The report reads the Back Office endpoint set in Settings."
              : "Needs one read-only endpoint from the BO team — the format is in docs/BACKOFFICE_API.md."}
          </p>
        </div>
        <div>
          <p className="text-eyebrow">In the report</p>
          <p className="mt-1 font-medium">
            {dataset.promos.length} promos · {dataset.monthly.length} months
          </p>
          <p className="text-xs text-muted-foreground">
            Shown in {dataset.currency}; other currencies converted with the rates in Settings. Dates in {dataset.timeZone ?? "UTC"}.
          </p>
        </div>
      </div>
      <SettingsDialog />
      <div className="w-full border-t border-border pt-3 text-sm">
        <p className="text-eyebrow mb-1.5">Data completeness</p>
        <div className="flex flex-wrap gap-x-6 gap-y-1">
          <span>
            <span className={cn("mr-1.5 inline-block size-2 rounded-full", incomplete.length ? "bg-accent" : "bg-good")} />
            {ended.length - incomplete.length} of {ended.length} completed promos have all their data
          </span>
          <span>
            <span className={cn("mr-1.5 inline-block size-2 rounded-full", dups.length ? "bg-bad" : "bg-good")} />
            {dups.length ? `${dups.length} possible duplicate${dups.length === 1 ? "" : "s"}: ${dups.map((g) => g[0].name).join(", ")}` : "No duplicates found"}
          </span>
        </div>
        {incomplete.length > 0 && (
          <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
            {incomplete.slice(0, 6).map((m) => (
              <li key={m.promo.id}>
                <span className="text-foreground">{m.promo.name}</span> — missing {m.quality.missing.join(", ")}
              </li>
            ))}
            {incomplete.length > 6 && <li>and {incomplete.length - 6} more</li>}
          </ul>
        )}
      </div>
    </section>
  );
}

/** Number cell you can type straight into; shows 1,234,567 when not focused. */
function NumCell({ value, onCommit, disabled, label }: { value: number | null; onCommit: (v: number | null) => void; disabled?: boolean; label: string }) {
  const [focused, setFocused] = useState(false);
  const [v, setV] = useState(value == null ? "" : String(value));
  useEffect(() => {
    if (!focused) setV(value == null ? "" : String(value));
  }, [value, focused]);
  return (
    <input
      aria-label={label}
      className="cell-input text-right tabular"
      inputMode="decimal"
      value={focused ? v : value == null ? "" : num(value)}
      placeholder="add"
      disabled={disabled}
      onFocus={(e) => {
        setFocused(true);
        requestAnimationFrame(() => e.target.select());
      }}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => {
        setFocused(false);
        const n = toNumber(v);
        if (n !== value) onCommit(n);
      }}
      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
    />
  );
}

function PromosTable({ onAdd }: { onAdd: () => void }) {
  const { dataset, editable, savePromo, deletePromo, duplicatePromo } = useData();
  const confirm = useConfirm();
  const [editing, setEditing] = useState<PromoRecord | null>(null);
  const [query, setQuery] = useState("");
  const months = monthlyMap(dataset.monthly);
  const q = query.trim().toLowerCase();
  const all = [...dataset.promos].sort((a, b) => b.startDate.localeCompare(a.startDate));
  const rows = q ? all.filter((p) => [p.name, p.operator, p.aggregator, p.market, p.type, ...p.games].join(" ").toLowerCase().includes(q)) : all;

  if (!all.length)
    return (
      <div className="panel">
        <EmptyState icon={FileSpreadsheet} title="No promos yet">
          <Button className="mt-3" onClick={onAdd} disabled={!editable}>
            <Plus className="size-4" /> Add your first promo
          </Button>
        </EmptyState>
      </div>
    );

  return (
    <div className="panel overflow-x-auto">
      <div className="border-b border-border p-3">
        <div className="relative max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            aria-label="Search promos"
            className="h-9 w-full rounded-md border border-border bg-surface-raised pl-8 pr-2 text-sm outline-none placeholder:text-muted-foreground/70 focus:ring-2 focus:ring-ring"
            placeholder="Search name, market, operator, aggregator…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>
      <table className="w-full min-w-[820px] text-sm">
        <thead className="text-left text-xs text-muted-foreground">
          <tr className="border-b border-border">
            <th className="px-4 py-2.5 font-medium">Promo</th>
            <th className="w-14 px-2 py-2.5 font-medium">Cur.</th>
            <th className="w-32 px-2 py-2.5 text-right font-medium">GGR before</th>
            <th className="w-32 px-2 py-2.5 text-right font-medium">GGR during</th>
            <th className="w-32 px-2 py-2.5 text-right font-medium">GGR after</th>
            <th className="w-28 px-2 py-2.5 text-right font-medium">Result</th>
            <th className="w-24 px-2 py-2.5" />
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((p) => {
            const m = computePromo(p, months);
            return (
              <tr key={p.id} className="hover:bg-surface-raised/50">
                <td className="max-w-0 px-4 py-2">
                  <button className="block w-full truncate text-left font-medium hover:text-primary" onClick={() => setEditing(p)}>
                    {p.name}
                  </button>
                  <p className="truncate text-xs text-muted-foreground">
                    {[p.market && marketLabel(p.market), p.operator, p.aggregator, formatRange(p.startDate, p.endDate)].filter(Boolean).join(" · ")}
                  </p>
                </td>
                <td className="px-2 py-2 text-xs text-muted-foreground">{p.currency || dataset.currency}</td>
                <td className="px-1 py-2">
                  <NumCell label={`${p.name} GGR before`} value={p.ggrBefore} onCommit={(v) => savePromo({ ...p, ggrBefore: v })} disabled={!editable} />
                </td>
                <td className="px-1 py-2">
                  <NumCell label={`${p.name} GGR during`} value={p.ggrDuring} onCommit={(v) => savePromo({ ...p, ggrDuring: v })} disabled={!editable} />
                </td>
                <td className="px-1 py-2">
                  <NumCell label={`${p.name} GGR after`} value={p.ggrAfter} onCommit={(v) => savePromo({ ...p, ggrAfter: v })} disabled={!editable} />
                </td>
                <td className="px-2 py-2 text-right">
                  <ResultPill value={m.duringVsBefore} />
                </td>
                <td className="px-2 py-2">
                  <div className="flex justify-end">
                    <IconBtn label="Edit" onClick={() => setEditing(p)}>
                      <Pencil className="size-3.5" />
                    </IconBtn>
                    {editable && (
                      <IconBtn
                        label="Duplicate (for a repeat promo)"
                        onClick={() => {
                          const id = duplicatePromo(p.id);
                          const copy = id && { ...p, id, name: `${p.name} (copy)` };
                          if (copy) setEditing(copy);
                        }}
                      >
                        <Copy className="size-3.5" />
                      </IconBtn>
                    )}
                    {editable && (
                      <IconBtn
                        label="Delete"
                        onClick={async () => {
                          if (await confirm({ title: `Delete "${p.name}"?`, description: "This can't be undone.", confirmLabel: "Delete", destructive: true })) {
                            deletePromo(p.id);
                            toast.success("Deleted");
                          }
                        }}
                      >
                        <Trash2 className="size-3.5" />
                      </IconBtn>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {rows.length === 0 && <p className="px-4 py-6 text-center text-sm text-muted-foreground">No promos match “{query}”.</p>}
      <p className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
        Numbers are in each promo's own currency (Cur.). Click a number to change it — <code>120k</code> or <code>€120,000</code> both work. Click a promo's name for all its details.
      </p>
      <PromoEditor promo={editing} open={!!editing} onOpenChange={(o) => !o && setEditing(null)} />
    </div>
  );
}

function IconBtn({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      title={label}
      aria-label={label}
      onClick={onClick}
      className="grid size-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-surface-raised hover:text-foreground"
    >
      {children}
    </button>
  );
}

function MonthlyTable() {
  const { dataset, editable, saveMonthly, deleteMonthly } = useData();
  const rows = [...dataset.monthly].sort((a, b) => b.month.localeCompare(a.month));
  const map = monthlyMap(dataset.monthly);
  const count = new Map<string, number>();
  for (const p of dataset.promos) count.set(p.startDate.slice(0, 7), (count.get(p.startDate.slice(0, 7)) ?? 0) + 1);

  const suggested = (() => {
    let m = rows[0] ? nextMonth(rows[0].month) : todayIso().slice(0, 7);
    while (map.has(m)) m = nextMonth(m);
    return m;
  })();
  const [newMonth, setNewMonth] = useState(suggested);
  const addMonth = () => {
    if (!/^\d{4}-\d{2}$/.test(newMonth)) return toast.error("Pick a month first");
    if (map.has(newMonth)) return toast.error(`${monthLabel(newMonth, "long")} is already in the list`);
    saveMonthly({ month: newMonth, ggr: null, notes: "" });
    setNewMonth(nextMonth(newMonth));
  };

  return (
    <div className="panel overflow-x-auto">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
        <p className="text-sm text-muted-foreground">Total GGR for each month — used for "vs previous month".</p>
        <div className="flex items-center gap-2">
          <input
            type="month"
            aria-label="Month to add"
            className="h-9 rounded-md border border-border bg-surface-raised px-2 text-sm"
            value={newMonth}
            onChange={(e) => setNewMonth(e.target.value)}
            disabled={!editable}
          />
          <Button size="sm" variant="outline" onClick={addMonth} disabled={!editable}>
            <CalendarPlus className="size-3.5" /> Add month
          </Button>
        </div>
      </div>
      {rows.length === 0 ? (
        <EmptyState icon={CalendarPlus} title="No months yet" />
      ) : (
        <table className="w-full min-w-[520px] text-sm">
          <thead className="text-left text-xs text-muted-foreground">
            <tr className="border-b border-border">
              <th className="px-4 py-2.5 font-medium">Month</th>
              <th className="w-44 px-2 py-2.5 text-right font-medium">Total GGR</th>
              <th className="w-36 px-2 py-2.5 text-right font-medium">vs previous month</th>
              <th className="w-20 px-2 py-2.5 text-right font-medium">Promos</th>
              <th className="w-12 px-2 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r) => {
              const prev = map.get(prevMonth(r.month));
              return (
                <tr key={r.month} className="hover:bg-surface-raised/50">
                  <td className="px-4 py-2 font-medium">{monthLabel(r.month, "long")}</td>
                  <td className="px-1 py-2">
                    <NumCell label={`${monthLabel(r.month, "long")} GGR`} value={r.ggr} onCommit={(v) => saveMonthly({ ...r, ggr: v })} disabled={!editable} />
                  </td>
                  <td className="px-2 py-2 text-right">
                    <Delta value={r.ggr != null && prev ? r.ggr / prev - 1 : null} className="text-xs" />
                  </td>
                  <td className="px-2 py-2 text-right tabular text-muted-foreground">{count.get(r.month) ?? 0}</td>
                  <td className="px-2 py-2">
                    {editable && (
                      <IconBtn label="Delete month" onClick={() => deleteMonthly(r.month)}>
                        <Trash2 className="size-3.5" />
                      </IconBtn>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
