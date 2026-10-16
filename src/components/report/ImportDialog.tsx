import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowLeftRight, Download, FileJson, FileSpreadsheet, Upload } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useData, type ImportMode } from "@/lib/store";
import { normalizeDataset, normalizeMonthly, normalizePromos } from "@/lib/normalize";
import { MONTHLY_TEMPLATE, PROMO_TEMPLATE, downloadText, monthlyToCsv, parseDelimited, promosToCsv, rowsToObjects } from "@/lib/csv";
import { cn } from "@/lib/utils";
import { inputCls } from "./bits";
import { useConfirm } from "./Confirm";

type Target = "promos" | "monthly";

export function ImportDialog() {
  const { dataset, editable, importPromos, importMonthly, loadSample, clearAll } = useData();
  const confirm = useConfirm();
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<Target>("promos");
  const [mode, setMode] = useState<ImportMode>("merge");
  const [text, setText] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const parsed = useMemo(() => {
    if (!text.trim()) return null;
    const objs = rowsToObjects(parseDelimited(text));
    if (target === "promos") {
      const r = normalizePromos(objs);
      return { count: r.records.length, warnings: r.warnings, promos: r.records, monthly: [] };
    }
    const r = normalizeMonthly(objs);
    return { count: r.records.length, warnings: r.warnings, promos: [], monthly: r.records };
  }, [text, target]);

  const doImport = async () => {
    if (!parsed?.count) return;
    if (
      mode === "replace" &&
      !(await confirm({
        title: `Replace all ${target === "promos" ? "promos" : "monthly totals"}?`,
        description: `What's there now is replaced by these ${parsed.count} rows.`,
        confirmLabel: "Replace",
        destructive: true,
      }))
    )
      return;
    if (target === "promos") importPromos(parsed.promos, mode);
    else importMonthly(parsed.monthly, mode);
    toast.success(`Added ${parsed.count} ${target === "promos" ? "promo" : "month"}${parsed.count === 1 ? "" : "s"}`);
    setText("");
    setOpen(false);
  };

  const onFile = async (file: File) => {
    const content = await file.text();
    const trimmed = content.trim();
    if (/\.json$/i.test(file.name) || trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try {
        const { dataset: d } = normalizeDataset(JSON.parse(content));
        const ok = await confirm({
          title: `Restore ${d.promos.length} promos and ${d.monthly.length} months?`,
          description: `From ${file.name}. This replaces what's here now.`,
          confirmLabel: "Restore",
          destructive: true,
        });
        if (!ok) return;
        importPromos(d.promos, "replace");
        importMonthly(d.monthly, "replace");
        toast.success("Backup restored");
        setOpen(false);
      } catch {
        toast.error("That file couldn't be read");
      }
      return;
    }
    setText(content);
  };

  const stamp = new Date().toISOString().slice(0, 10);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <ArrowLeftRight className="size-4" /> Import / export
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import / export</DialogTitle>
          <DialogDescription>
            Copy rows from Excel or Google Sheets — including the header row — and paste them here.
          </DialogDescription>
        </DialogHeader>

        {editable && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Seg value={target} onChange={(v) => setTarget(v as Target)} options={[["promos", "Promos"], ["monthly", "Monthly GGR"]]} />
              <Seg value={mode} onChange={(v) => setMode(v as ImportMode)} options={[["merge", "Add to existing"], ["replace", "Replace all"]]} />
            </div>
            <textarea
              className={cn(inputCls, "h-36 resize-y py-2 font-mono text-xs")}
              placeholder={target === "promos" ? PROMO_TEMPLATE : MONTHLY_TEMPLATE}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Button variant="ghost" size="sm" onClick={() => fileRef.current?.click()}>
                <Upload className="size-3.5" /> Or upload a CSV file
              </Button>
              <Button onClick={() => void doImport()} disabled={!parsed?.count}>
                {parsed?.count ? `Add ${parsed.count} row${parsed.count === 1 ? "" : "s"}` : "Add rows"}
              </Button>
            </div>
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
            {parsed && parsed.warnings.length > 0 && (
              <ul className="max-h-24 list-disc space-y-0.5 overflow-auto pl-5 text-xs text-muted-foreground">
                {parsed.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            )}
            <p className="text-xs text-muted-foreground">
              Not sure about the columns?{" "}
              <button className="text-primary hover:underline" onClick={() => downloadText("promos-template.csv", PROMO_TEMPLATE)}>
                Download the promo template
              </button>{" "}
              or the{" "}
              <button className="text-primary hover:underline" onClick={() => downloadText("monthly-ggr-template.csv", MONTHLY_TEMPLATE)}>
                monthly template
              </button>
              .
            </p>
          </div>
        )}

        <div className="mt-5 border-t border-border pt-4">
          <p className="mb-2 text-sm font-medium">Download</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => downloadText(`promos-${stamp}.csv`, promosToCsv(dataset.promos))}>
              <FileSpreadsheet className="size-3.5" /> Promos (CSV)
            </Button>
            <Button variant="outline" size="sm" onClick={() => downloadText(`monthly-ggr-${stamp}.csv`, monthlyToCsv(dataset.monthly))}>
              <FileSpreadsheet className="size-3.5" /> Monthly GGR (CSV)
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                downloadText(
                  `promo-report-backup-${stamp}.json`,
                  JSON.stringify({ currency: dataset.currency, promos: dataset.promos, monthly: dataset.monthly }, null, 2),
                  "application/json",
                )
              }
            >
              <FileJson className="size-3.5" /> Full backup
            </Button>
          </div>
        </div>

        {editable && (
          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 border-t border-border pt-3 text-xs text-muted-foreground">
            <button
              className="hover:text-foreground hover:underline"
              onClick={async () => {
                if (await confirm({ title: "Load the example numbers?", description: "This replaces what's here now.", confirmLabel: "Load examples", destructive: true })) {
                  loadSample();
                  toast.success("Example numbers loaded");
                }
              }}
            >
              <Download className="mr-1 inline size-3" />
              Load example numbers
            </button>
            <button
              className="hover:text-bad-ink hover:underline"
              onClick={async () => {
                if (
                  await confirm({
                    title: "Delete everything?",
                    description: "All promos and monthly totals saved in this browser are removed. Download a backup first if you need one.",
                    confirmLabel: "Delete everything",
                    destructive: true,
                  })
                ) {
                  clearAll();
                  toast.success("Everything cleared");
                }
              }}
            >
              Delete everything
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function Seg({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: Array<[string, string]> }) {
  return (
    <div className="flex rounded-md border border-border p-0.5 text-xs">
      {options.map(([v, l]) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          className={cn("rounded px-2.5 py-1", value === v ? "bg-surface-raised font-medium text-foreground" : "text-muted-foreground hover:text-foreground")}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
