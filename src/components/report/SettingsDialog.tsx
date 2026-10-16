import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Cloud, Copy, Loader2, PencilLine, Settings, Sheet as SheetIcon } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useData } from "@/lib/store";
import { SOURCE_LABEL, type SourceConfig, type SourceKind } from "@/lib/sources";
import { currencySymbol } from "@/lib/format";
import { fxFactor, rateToEur } from "@/lib/fx";
import { cn } from "@/lib/utils";
import { Field, inputCls } from "./bits";

const CURRENCIES = ["EUR", "USD", "GBP", "BRL", "MXN", "INR", "NGN", "KES", "PEN", "COP", "CLP", "ARS", "ZAR"];

const EXAMPLE_JSON = `{
  "currency": "EUR",
  "promos": [{
    "id": "BO-48213",
    "name": "Aviator Weekend Rain",
    "type": "Regional Promotion",
    "operator": "Operator name",
    "aggregator": "Aggregator name",
    "market": "Brazil",
    "currency": "BRL",
    "games": ["Aviator"],
    "startDate": "2026-09-05",
    "endDate": "2026-09-07",
    "ggrBefore": 120000,
    "ggrDuring": 151000,
    "ggrAfter": 131000
  }],
  "monthly": [{ "month": "2026-09", "ggr": 43900000 }]
}`;

const OPTIONS: Array<{ kind: SourceKind; icon: typeof Cloud; text: string }> = [
  { kind: "manual", icon: PencilLine, text: "Type, paste or import numbers on this site (fallback)." },
  { kind: "sheet", icon: SheetIcon, text: "The team fills in one Google Sheet; the site reads it." },
  { kind: "api", icon: Cloud, text: "Numbers come straight from the Back Office, automatically — once the BO team provides the endpoint." },
];

export function SettingsDialog() {
  const { config, setConfig, status, error, dataset, setCurrency, setFxRate, editable } = useData();
  const used = [...new Set(dataset.promos.map((p) => p.currency).filter((c) => c && c !== dataset.currency))].sort();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<SourceConfig>(config);
  useEffect(() => {
    if (open) setDraft(config);
  }, [open, config]);
  const set = <K extends keyof SourceConfig>(k: K, v: SourceConfig[K]) => setDraft((d) => ({ ...d, [k]: v }));
  const dirty = JSON.stringify(draft) !== JSON.stringify(config);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon" aria-label="Settings" title="Settings">
          <Settings className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>Where the numbers come from, and the currency they're shown in.</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <Field label="Currency">
            <Select value={dataset.currency} onValueChange={setCurrency} disabled={!editable}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[...new Set([dataset.currency, ...CURRENCIES])].map((c) => (
                  <SelectItem key={c} value={c}>
                    {c} ({currencySymbol(c)})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          {used.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground">Exchange rates</p>
              <p className="mb-2 text-[11px] text-muted-foreground">
                Promos entered in other currencies are converted to {dataset.currency} with these. They start as rough
                example rates — check them before sharing numbers.
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {used.map((c) => (
                  <RateInput key={c} code={c} display={dataset.currency} rates={dataset.fxRates ?? {}} onChange={setFxRate} disabled={!editable} />
                ))}
              </div>
            </div>
          )}

          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">Numbers come from</p>
            <div className="space-y-2">
              {OPTIONS.map((o) => (
                <button
                  key={o.kind}
                  onClick={() => set("kind", o.kind)}
                  className={cn(
                    "flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors",
                    draft.kind === o.kind ? "border-primary bg-primary/5" : "border-border hover:bg-surface-raised",
                  )}
                >
                  <o.icon className={cn("mt-0.5 size-4", draft.kind === o.kind ? "text-primary" : "text-muted-foreground")} />
                  <span>
                    <span className="block text-sm font-medium">{SOURCE_LABEL[o.kind]}</span>
                    <span className="block text-xs text-muted-foreground">{o.text}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>

          {draft.kind === "sheet" && (
            <div className="space-y-3">
              <Field label="Link to the promos tab" hint='Share the sheet as "Anyone with the link can view". Use the template from Import / export for the columns.'>
                <input className={inputCls} value={draft.sheetPromosUrl} onChange={(e) => set("sheetPromosUrl", e.target.value)} placeholder="https://docs.google.com/spreadsheets/d/…" />
              </Field>
              <Field label="Link to the monthly GGR tab (optional)">
                <input className={inputCls} value={draft.sheetMonthlyUrl} onChange={(e) => set("sheetMonthlyUrl", e.target.value)} placeholder="https://docs.google.com/spreadsheets/d/…#gid=…" />
              </Field>
            </div>
          )}

          {draft.kind === "api" && (
            <div className="space-y-3">
              <Field
                label="Back Office address"
                hint="Your developers set this up — the format they need is below. Keep it behind company login (SSO/VPN) and have it return aggregate numbers only."
              >
                <input className={inputCls} value={draft.apiUrl} onChange={(e) => set("apiUrl", e.target.value)} placeholder="https://backoffice…/api/promo-report" />
              </Field>
              <details className="rounded-lg border border-border p-3 text-xs">
                <summary className="cursor-pointer font-medium">For developers</summary>
                <p className="mt-2 text-muted-foreground">
                  One GET request returning this JSON. Full spec: <code>docs/BACKOFFICE_API.md</code> in the repo.
                </p>
                <div className="relative mt-2">
                  <button
                    onClick={() => navigator.clipboard.writeText(EXAMPLE_JSON).then(() => toast.success("Copied"), () => toast.error("Couldn't copy"))}
                    className="absolute right-2 top-2 flex items-center gap-1 rounded border border-border bg-surface px-1.5 py-0.5 text-[11px] text-muted-foreground hover:text-foreground"
                  >
                    <Copy className="size-3" /> Copy
                  </button>
                  <pre className="overflow-auto rounded-md bg-surface-raised p-2.5 font-mono text-[11px] leading-relaxed">{EXAMPLE_JSON}</pre>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <Field label="Auth header">
                    <input className={inputCls} value={draft.apiAuthHeader} onChange={(e) => set("apiAuthHeader", e.target.value)} />
                  </Field>
                  <Field label="Token (saved in this browser only)">
                    <input className={inputCls} type="password" autoComplete="off" value={draft.apiToken} onChange={(e) => set("apiToken", e.target.value)} />
                  </Field>
                  <Field label="Field names map (JSON)" className="sm:col-span-2">
                    <input className={cn(inputCls, "font-mono text-xs")} value={draft.fieldMap} onChange={(e) => set("fieldMap", e.target.value)} placeholder='{"ggr_pre": "ggrBefore"}' />
                  </Field>
                </div>
              </details>
            </div>
          )}

          {draft.kind !== "manual" && (
            <Field label="Check for new numbers">
              <Select value={String(draft.refreshMinutes)} onValueChange={(v) => set("refreshMinutes", Number(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">When the page opens</SelectItem>
                  <SelectItem value="15">Every 15 minutes</SelectItem>
                  <SelectItem value="60">Every hour</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          )}

          {config.kind !== "manual" && !dirty && (
            <p className={cn("flex items-start gap-2 text-sm", status === "error" ? "text-bad-ink" : "text-muted-foreground")}>
              {status === "loading" ? (
                <Loader2 className="mt-0.5 size-4 animate-spin" />
              ) : status === "error" ? (
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              ) : (
                <CheckCircle2 className="mt-0.5 size-4 text-good-ink" />
              )}
              {status === "error" ? error : status === "loading" ? "Connecting…" : `Connected — ${dataset.promos.length} promos loaded`}
            </p>
          )}

          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Close
            </Button>
            <Button
              disabled={!dirty}
              onClick={() => {
                setConfig(draft);
                toast.success(draft.kind === "manual" ? "Using numbers entered on the site" : "Saved — loading numbers");
              }}
            >
              Save
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** "1 BRL = [0.16] EUR" — stored as the value in EUR so any display currency works. */
function RateInput({
  code,
  display,
  rates,
  onChange,
  disabled,
}: {
  code: string;
  display: string;
  rates: Record<string, number>;
  onChange: (c: string, eur: number | null) => void;
  disabled?: boolean;
}) {
  const factor = fxFactor(code, display, rates);
  const [v, setV] = useState(factor == null ? "" : String(+factor.toPrecision(4)));
  useEffect(() => setV(factor == null ? "" : String(+factor.toPrecision(4))), [factor]);
  return (
    <label className="flex items-center gap-1.5 rounded-md border border-border bg-surface-raised px-2 py-1 text-xs">
      <span className="shrink-0 text-muted-foreground">1 {code} =</span>
      <input
        inputMode="decimal"
        className="w-full min-w-0 bg-transparent text-right tabular outline-none"
        value={v}
        disabled={disabled}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => {
          const n = Number(v.replace(",", "."));
          const displayInEur = rateToEur(display, rates);
          if (n > 0 && displayInEur) onChange(code, n * displayInEur);
        }}
      />
      <span className="shrink-0 text-muted-foreground">{display}</span>
    </label>
  );
}
