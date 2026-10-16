import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  CalendarPlus,
  ClipboardPaste,
  Copy,
  Download,
  ExternalLink,
  FileJson,
  FileSpreadsheet,
  FlaskConical,
  Lock,
  Maximize2,
  Plus,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Delta, EmptyState, Field, inputCls } from "@/components/report/bits";
import { PromoEditor } from "@/components/report/PromoEditor";
import { useConfirm } from "@/components/report/Confirm";
import { useData, type ImportMode } from "@/lib/store";
import { computePromo, monthlyMap } from "@/lib/metrics";
import { normalizeDataset, normalizeMonthly, normalizePromos, toNumber } from "@/lib/normalize";
import {
  MONTHLY_TEMPLATE,
  PROMO_TEMPLATE,
  downloadText,
  monthlyToCsv,
  parseDelimited,
  promosToCsv,
  rowsToObjects,
} from "@/lib/csv";
import { isValidIsoDay, monthLabel, nextMonth, prevMonth } from "@/lib/dates";
import { currencySymbol, num, pct } from "@/lib/format";
import { SOURCE_LABEL } from "@/lib/sources";
import type { MonthlyRecord, PromoRecord } from "@/lib/types";
import { cn } from "@/lib/utils";

const CURRENCIES = ["EUR", "USD", "GBP", "BRL", "MXN", "INR", "NGN", "KES", "PEN", "COP", "CLP", "ARS", "ZAR", "UAH"];

export function DataPage() {
  const { dataset, editable, config, copyRemoteToManual, setCurrency } = useData();
  const [tab, setTab] = useState("promos");
  const confirm = useConfirm();

  return (
    <main className="mx-auto max-w-[1400px] space-y-5 px-4 py-6 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-eyebrow">Data</p>
          <h1 className="mt-1 text-3xl">Put the numbers in</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Type straight into the table, open a promo for the full form, or paste rows from Excel / Google Sheets. Every
            chart and report updates as you go.
          </p>
        </div>
        <div className="w-40">
          <Field label="Display currency">
            <Select value={dataset.currency} onValueChange={setCurrency} disabled={!editable}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[...new Set([dataset.currency, ...CURRENCIES])].map((c) => (
                  <SelectItem key={c} value={c}>
                    {c} · {currencySymbol(c)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
      </div>

      {!editable && (
        <div className="panel flex flex-wrap items-center justify-between gap-3 border-primary/40 p-4">
          <p className="flex items-center gap-2 text-sm">
            <Lock className="size-4 text-primary" />
            Data is coming from <strong>{SOURCE_LABEL[config.kind]}</strong>, so it's read-only here — edit it at the source.
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                if (
                  await confirm({
                    title: "Copy the synced data into manual mode?",
                    description: "This replaces anything you'd typed in manually before.",
                    confirmLabel: "Copy",
                  })
                ) {
                  copyRemoteToManual();
                  toast.success("Copied. Switch the source to Manual on the Connect page to edit it.");
                }
              }}
            >
              <Copy className="size-3.5" /> Copy to manual
            </Button>
            <Button asChild size="sm">
              <Link to="/connect">Change source</Link>
            </Button>
          </div>
        </div>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="h-10 max-w-full overflow-x-auto">
          <TabsTrigger value="promos" className="h-8">
            Promos <span className="ml-1 rounded-full bg-background/30 px-1.5 text-[11px]">{dataset.promos.length}</span>
          </TabsTrigger>
          <TabsTrigger value="monthly" className="h-8">
            Monthly GGR <span className="ml-1 rounded-full bg-background/30 px-1.5 text-[11px]">{dataset.monthly.length}</span>
          </TabsTrigger>
          <TabsTrigger value="import" className="h-8">
            Import &amp; export
          </TabsTrigger>
        </TabsList>
        <TabsContent value="promos" className="mt-3">
          <PromosGrid />
        </TabsContent>
        <TabsContent value="monthly" className="mt-3">
          <MonthlyGrid />
        </TabsContent>
        <TabsContent value="import" className="mt-3">
          <ImportExport onDone={(t) => setTab(t)} />
        </TabsContent>
      </Tabs>
    </main>
  );
}

/* ---------------------------------------------------------------- cells */

function TextCell({ value, onCommit, disabled, list, placeholder, className }: { value: string; onCommit: (v: string) => void; disabled?: boolean; list?: string; placeholder?: string; className?: string }) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  return (
    <input
      className={cn("cell-input", className)}
      value={v}
      list={list}
      placeholder={placeholder}
      disabled={disabled}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => v !== value && onCommit(v)}
      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
    />
  );
}

function NumCell({ value, onCommit, disabled }: { value: number | null; onCommit: (v: number | null) => void; disabled?: boolean }) {
  const [focused, setFocused] = useState(false);
  const [v, setV] = useState(value == null ? "" : String(value));
  useEffect(() => {
    if (!focused) setV(value == null ? "" : String(value));
  }, [value, focused]);
  return (
    <input
      className="cell-input text-right tabular"
      inputMode="decimal"
      value={focused ? v : value == null ? "" : num(value)}
      placeholder="—"
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

function DateCell({ value, onCommit, disabled, min }: { value: string; onCommit: (v: string) => void; disabled?: boolean; min?: string }) {
  return (
    <input
      type="date"
      className="cell-input"
      value={value}
      min={min}
      disabled={disabled}
      onChange={(e) => isValidIsoDay(e.target.value) && onCommit(e.target.value)}
    />
  );
}

/* ---------------------------------------------------------------- promos */

function PromosGrid() {
  const { dataset, editable, savePromo, deletePromo, duplicatePromo } = useData();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<PromoRecord | null>(null);
  const [creating, setCreating] = useState(false);
  const months = useMemo(() => monthlyMap(dataset.monthly), [dataset.monthly]);

  const q = query.toLowerCase();
  const rows = [...dataset.promos]
    .filter((p) => !q || [p.name, p.operator, p.type, p.market, ...p.games].join(" ").toLowerCase().includes(q))
    .sort((a, b) => b.startDate.localeCompare(a.startDate));

  const update = (p: PromoRecord, patch: Partial<PromoRecord>) => {
    const next = { ...p, ...patch };
    if (next.endDate && next.startDate && next.endDate < next.startDate) {
      toast.error("End date can't be before the start date");
      return;
    }
    savePromo(next);
  };

  return (
    <section className="panel p-3 sm:p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input className={cn(inputCls, "pl-9")} placeholder="Search promos, operators, games…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <Button onClick={() => setCreating(true)} disabled={!editable}>
          <Plus className="size-4" /> Add promo
        </Button>
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={FileSpreadsheet} title={query ? "No promos match your search" : "No promos yet"}>
          {!query && "Add one with the button above, or paste a whole sheet on the Import & export tab."}
        </EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[1640px] table-fixed text-sm">
            <colgroup>
              <col className="w-[230px]" />
              <col className="w-[120px]" />
              <col className="w-[150px]" />
              <col className="w-[110px]" />
              <col className="w-[150px]" />
              <col className="w-[150px]" />
              <col className="w-[120px]" />
              <col className="w-[120px]" />
              <col className="w-[120px]" />
              <col className="w-[110px]" />
              <col className="w-[100px]" />
              <col className="w-[100px]" />
              <col className="w-[140px]" />
            </colgroup>
            <thead className="bg-surface-raised text-left text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-2 py-2 font-medium">Promo</th>
                <th className="px-2 py-2 font-medium">Type</th>
                <th className="px-2 py-2 font-medium">Operator</th>
                <th className="px-2 py-2 font-medium">Market</th>
                <th className="px-2 py-2 font-medium">Start</th>
                <th className="px-2 py-2 font-medium">End</th>
                <th className="px-2 py-2 text-right font-medium">
                  <span className="mr-1 inline-block size-2 rounded-[2px] bg-before" />
                  GGR before
                </th>
                <th className="px-2 py-2 text-right font-medium">
                  <span className="mr-1 inline-block size-2 rounded-[2px] bg-during" />
                  GGR during
                </th>
                <th className="px-2 py-2 text-right font-medium">
                  <span className="mr-1 inline-block size-2 rounded-[2px] bg-after" />
                  GGR after
                </th>
                <th className="px-2 py-2 text-right font-medium">Prize pool</th>
                <th className="px-2 py-2 text-right font-medium">During vs before</th>
                <th className="px-2 py-2 text-right font-medium">After vs before</th>
                <th className="px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => {
                const m = computePromo(p, months);
                return (
                  <tr key={p.id} className="border-t border-border hover:bg-surface-raised/40">
                    <td className="px-1 py-1">
                      <TextCell value={p.name} onCommit={(v) => update(p, { name: v || p.name })} disabled={!editable} className="font-medium" />
                    </td>
                    <td className="px-1 py-1">
                      <TextCell value={p.type} onCommit={(v) => update(p, { type: v })} disabled={!editable} />
                    </td>
                    <td className="px-1 py-1">
                      <TextCell value={p.operator} onCommit={(v) => update(p, { operator: v })} disabled={!editable} />
                    </td>
                    <td className="px-1 py-1">
                      <TextCell value={p.market} onCommit={(v) => update(p, { market: v })} disabled={!editable} />
                    </td>
                    <td className="px-1 py-1">
                      <DateCell value={p.startDate} onCommit={(v) => update(p, { startDate: v })} disabled={!editable} />
                    </td>
                    <td className="px-1 py-1">
                      <DateCell value={p.endDate} min={p.startDate} onCommit={(v) => update(p, { endDate: v })} disabled={!editable} />
                    </td>
                    <td className="px-1 py-1">
                      <NumCell value={p.ggrBefore} onCommit={(v) => update(p, { ggrBefore: v })} disabled={!editable} />
                    </td>
                    <td className="px-1 py-1">
                      <NumCell value={p.ggrDuring} onCommit={(v) => update(p, { ggrDuring: v })} disabled={!editable} />
                    </td>
                    <td className="px-1 py-1">
                      <NumCell value={p.ggrAfter} onCommit={(v) => update(p, { ggrAfter: v })} disabled={!editable} />
                    </td>
                    <td className="px-1 py-1">
                      <NumCell value={p.prizePool} onCommit={(v) => update(p, { prizePool: v })} disabled={!editable} />
                    </td>
                    <td className="px-2 py-1 text-right">
                      <Delta value={m.duringVsBefore} className="text-xs" />
                    </td>
                    <td className="px-2 py-1 text-right">
                      <Delta value={m.afterVsBefore} className="text-xs" />
                    </td>
                    <td className="px-1 py-1">
                      <div className="flex justify-end gap-0.5">
                        <IconBtn label="Open full form" onClick={() => setEditing(p)}>
                          <Maximize2 className="size-3.5" />
                        </IconBtn>
                        <IconBtn label="View report" onClick={() => navigate({ to: "/promo/$promoId", params: { promoId: p.id } })}>
                          <ExternalLink className="size-3.5" />
                        </IconBtn>
                        {editable && (
                          <>
                            <IconBtn
                              label="Duplicate"
                              onClick={() => {
                                duplicatePromo(p.id);
                                toast.success("Duplicated");
                              }}
                            >
                              <Copy className="size-3.5" />
                            </IconBtn>
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
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-2 text-[11px] text-muted-foreground">
        Changes save automatically in this browser. Games, players, comparison window and notes are in the full form (
        <Maximize2 className="inline size-3" />
        ).
      </p>

      <PromoEditor promo={editing} open={!!editing} onOpenChange={(o) => !o && setEditing(null)} />
      <PromoEditor promo={null} open={creating} onOpenChange={setCreating} />
    </section>
  );
}

function IconBtn({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      title={label}
      aria-label={label}
      onClick={onClick}
      className="grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-surface-raised hover:text-foreground"
    >
      {children}
    </button>
  );
}

/* ---------------------------------------------------------------- monthly */

function MonthlyGrid() {
  const { dataset, editable, saveMonthly, deleteMonthly } = useData();
  const rows = [...dataset.monthly].sort((a, b) => b.month.localeCompare(a.month));
  const map = monthlyMap(dataset.monthly);
  const promoCounts = new Map<string, number>();
  for (const p of dataset.promos) promoCounts.set(p.startDate.slice(0, 7), (promoCounts.get(p.startDate.slice(0, 7)) ?? 0) + 1);

  const addMonth = () => {
    const latest = rows[0]?.month;
    let month = latest ? nextMonth(latest) : new Date().toISOString().slice(0, 7);
    while (map.has(month)) month = nextMonth(month);
    saveMonthly({ month, ggr: null, notes: "" });
  };

  return (
    <section className="panel p-3 sm:p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="max-w-xl text-sm text-muted-foreground">
          Total GGR per month — the scope you report on (all operators, a region…). Powers the "GGR vs previous month"
          numbers. Promo counts per month are calculated from the promos.
        </p>
        <Button onClick={addMonth} disabled={!editable}>
          <CalendarPlus className="size-4" /> Add month
        </Button>
      </div>
      {rows.length === 0 ? (
        <EmptyState icon={CalendarPlus} title="No monthly totals yet" />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-surface-raised text-left text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-2 py-2 font-medium">Month</th>
                <th className="px-2 py-2 text-right font-medium">Total GGR</th>
                <th className="px-2 py-2 text-right font-medium">vs previous month</th>
                <th className="px-2 py-2 text-right font-medium">Promos</th>
                <th className="px-2 py-2 font-medium">Notes</th>
                <th className="px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const prev = map.get(prevMonth(r.month));
                const mom = r.ggr != null && prev ? r.ggr / prev - 1 : null;
                return (
                  <tr key={r.month} className="border-t border-border hover:bg-surface-raised/40">
                    <td className="w-48 px-1 py-1">
                      <input
                        type="month"
                        className="cell-input"
                        value={r.month}
                        disabled={!editable}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (!/^\d{4}-\d{2}$/.test(v) || v === r.month) return;
                          if (map.has(v)) return toast.error(`${monthLabel(v, "long")} already has a row`);
                          saveMonthly({ ...r, month: v }, r.month);
                        }}
                      />
                    </td>
                    <td className="w-44 px-1 py-1">
                      <NumCell value={r.ggr} onCommit={(v) => saveMonthly({ ...r, ggr: v })} disabled={!editable} />
                    </td>
                    <td className="px-2 py-1 text-right">
                      <Delta value={mom} className="text-xs" />
                    </td>
                    <td className="px-2 py-1 text-right tabular text-muted-foreground">{promoCounts.get(r.month) ?? 0}</td>
                    <td className="px-1 py-1">
                      <TextCell value={r.notes} onCommit={(v) => saveMonthly({ ...r, notes: v })} disabled={!editable} placeholder="optional" />
                    </td>
                    <td className="w-10 px-1 py-1">
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
        </div>
      )}
    </section>
  );
}

/* ---------------------------------------------------------------- import / export */

type Target = "promos" | "monthly";

function ImportExport({ onDone }: { onDone: (tab: string) => void }) {
  const { dataset, editable, importPromos, importMonthly, loadSample, clearAll } = useData();
  const [target, setTarget] = useState<Target>("promos");
  const [mode, setMode] = useState<ImportMode>("merge");
  const [text, setText] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const confirm = useConfirm();

  const parsed = useMemo(() => {
    if (!text.trim()) return null;
    const objs = rowsToObjects(parseDelimited(text));
    if (target === "promos") {
      const r = normalizePromos(objs);
      return { count: r.records.length, warnings: r.warnings, promos: r.records, monthly: [] as MonthlyRecord[], headers: Object.keys(objs[0] ?? {}) };
    }
    const r = normalizeMonthly(objs);
    return { count: r.records.length, warnings: r.warnings, promos: [] as PromoRecord[], monthly: r.records, headers: Object.keys(objs[0] ?? {}) };
  }, [text, target]);

  const doImport = async () => {
    if (!parsed?.count) return;
    if (
      mode === "replace" &&
      !(await confirm({
        title: `Replace all ${target === "promos" ? "promos" : "monthly totals"}?`,
        description: `Everything currently there is replaced by these ${parsed.count} rows.`,
        confirmLabel: "Replace",
        destructive: true,
      }))
    )
      return;
    if (target === "promos") importPromos(parsed.promos, mode);
    else importMonthly(parsed.monthly, mode);
    toast.success(`Imported ${parsed.count} ${target === "promos" ? "promo" : "month"}${parsed.count === 1 ? "" : "s"}`);
    setText("");
    onDone(target);
  };

  const onFile = async (file: File) => {
    const content = await file.text();
    if (/\.json$/i.test(file.name) || content.trim().startsWith("{") || content.trim().startsWith("[")) {
      try {
        const { dataset: d, warnings } = normalizeDataset(JSON.parse(content));
        const ok = await confirm({
          title: `Restore ${d.promos.length} promos and ${d.monthly.length} months?`,
          description: `From ${file.name}. This replaces the current data.`,
          confirmLabel: "Restore",
          destructive: true,
        });
        if (!ok) return;
        importPromos(d.promos, "replace");
        importMonthly(d.monthly, "replace");
        toast.success(`Restored ${d.promos.length} promos`, { description: warnings.slice(0, 3).join(" ") || undefined });
      } catch {
        toast.error("That JSON file couldn't be read");
      }
      return;
    }
    setText(content);
  };

  const stamp = new Date().toISOString().slice(0, 10);

  return (
    <div className="grid gap-5 lg:grid-cols-5">
      <section className="panel p-4 sm:p-5 lg:col-span-3">
        <h2 className="flex items-center gap-2 text-base">
          <ClipboardPaste className="size-4 text-primary" /> Paste from Excel or Google Sheets
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Copy the cells <strong>including the header row</strong> and paste below — or drop in a CSV file. Column names
          are matched loosely (<code>GGR Before</code>, <code>ggr_before</code> and <code>Before</code> all work).
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Seg value={target} onChange={(v) => setTarget(v as Target)} options={[["promos", "Promos"], ["monthly", "Monthly GGR"]]} />
          <Seg value={mode} onChange={(v) => setMode(v as ImportMode)} options={[["merge", "Add / update"], ["replace", "Replace all"]]} />
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={!editable}>
            <Upload className="size-3.5" /> Upload file
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.tsv,.txt,.json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onFile(f);
              e.target.value = "";
            }}
          />
        </div>
        <textarea
          className={cn(inputCls, "mt-3 h-44 resize-y py-2 font-mono text-xs")}
          placeholder={target === "promos" ? PROMO_TEMPLATE : MONTHLY_TEMPLATE}
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={!editable}
        />
        {parsed && (
          <div className="mt-3 rounded-lg border border-border bg-surface-raised/50 p-3 text-sm">
            <p>
              <strong>{parsed.count}</strong> {target === "promos" ? "promo" : "month"}
              {parsed.count === 1 ? "" : "s"} ready to import
              {parsed.headers.length > 0 && <span className="text-muted-foreground"> · columns: {parsed.headers.join(", ")}</span>}
            </p>
            {parsed.warnings.length > 0 && (
              <ul className="mt-2 max-h-28 list-disc space-y-0.5 overflow-auto pl-5 text-xs text-muted-foreground">
                {parsed.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            )}
            {target === "promos" && parsed.promos.length > 0 && (
              <div className="mt-2 overflow-x-auto text-xs">
                <table className="w-full">
                  <tbody>
                    {parsed.promos.slice(0, 4).map((p) => {
                      const m = computePromo(p);
                      return (
                        <tr key={p.id} className="border-t border-border">
                          <td className="py-1 pr-2">{p.name}</td>
                          <td className="py-1 pr-2 text-muted-foreground">
                            {p.startDate} → {p.endDate}
                          </td>
                          <td className="py-1 text-right tabular">{pct(m.duringVsBefore)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <Button className="mt-3" onClick={() => void doImport()} disabled={!parsed.count || !editable}>
              Import {parsed.count} row{parsed.count === 1 ? "" : "s"}
            </Button>
          </div>
        )}
      </section>

      <div className="space-y-5 lg:col-span-2">
        <section className="panel p-4 sm:p-5">
          <h2 className="flex items-center gap-2 text-base">
            <Download className="size-4 text-primary" /> Export &amp; templates
          </h2>
          <div className="mt-3 grid gap-2">
            <Button variant="outline" className="justify-start" onClick={() => downloadText(`spribe-promos-${stamp}.csv`, promosToCsv(dataset.promos))}>
              <FileSpreadsheet className="size-4" /> Promos as CSV
            </Button>
            <Button variant="outline" className="justify-start" onClick={() => downloadText(`spribe-monthly-ggr-${stamp}.csv`, monthlyToCsv(dataset.monthly))}>
              <FileSpreadsheet className="size-4" /> Monthly GGR as CSV
            </Button>
            <Button
              variant="outline"
              className="justify-start"
              onClick={() =>
                downloadText(
                  `spribe-promo-report-backup-${stamp}.json`,
                  JSON.stringify({ currency: dataset.currency, promos: dataset.promos, monthly: dataset.monthly }, null, 2),
                  "application/json",
                )
              }
            >
              <FileJson className="size-4" /> Full backup (JSON)
            </Button>
            <div className="my-1 h-px bg-border" />
            <Button variant="ghost" className="justify-start" onClick={() => downloadText("promos-template.csv", PROMO_TEMPLATE)}>
              <Download className="size-4" /> Promo template (CSV)
            </Button>
            <Button variant="ghost" className="justify-start" onClick={() => downloadText("monthly-ggr-template.csv", MONTHLY_TEMPLATE)}>
              <Download className="size-4" /> Monthly template (CSV)
            </Button>
          </div>
          <p className="mt-3 text-[11px] text-muted-foreground">
            The JSON backup is the same shape the backoffice API sends, so it doubles as a test payload.
          </p>
        </section>

        {editable && (
          <section className="panel p-4 sm:p-5">
            <h2 className="text-base">Start over</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  if (await confirm({ title: "Load the sample numbers?", description: "This replaces the current data.", confirmLabel: "Load sample", destructive: true })) {
                    loadSample();
                    toast.success("Sample data loaded");
                  }
                }}
              >
                <FlaskConical className="size-3.5" /> Load sample data
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={async () => {
                  if (
                    await confirm({
                      title: "Delete all promos and monthly totals?",
                      description: "This clears everything saved in this browser. Export a backup first if you need one.",
                      confirmLabel: "Delete everything",
                      destructive: true,
                    })
                  ) {
                    clearAll();
                    toast.success("All data cleared");
                  }
                }}
              >
                <Trash2 className="size-3.5" /> Clear everything
              </Button>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function Seg({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: Array<[string, string]> }) {
  return (
    <div className="flex rounded-md border border-border p-0.5 text-xs">
      {options.map(([v, l]) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          className={cn("rounded px-2.5 py-1", value === v ? "bg-surface-raised text-foreground" : "text-muted-foreground hover:text-foreground")}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
