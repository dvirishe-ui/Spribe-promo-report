import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCircle2,
  Cloud,
  Copy,
  Database,
  KeyRound,
  Loader2,
  PencilLine,
  PlugZap,
  ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field, inputCls } from "@/components/report/bits";
import { useData } from "@/lib/store";
import { SOURCE_LABEL, type SourceConfig, type SourceKind } from "@/lib/sources";
import { cn } from "@/lib/utils";

const SAMPLE_PAYLOAD = `{
  "currency": "EUR",
  "generatedAt": "2026-10-16T06:00:00Z",
  "promos": [
    {
      "id": "BO-48213",
      "name": "Aviator Weekend Rain",
      "type": "Rain",
      "operator": "Operator name",
      "games": ["Aviator"],
      "market": "Brazil",
      "startDate": "2026-09-05",
      "endDate": "2026-09-07",
      "windowDays": null,
      "ggrBefore": 120000,
      "ggrDuring": 151000,
      "ggrAfter": 131000,
      "prizePool": 15000,
      "playersBefore": 8200,
      "playersDuring": 9900,
      "playersAfter": 8700,
      "notes": "",
      "daily": [
        { "date": "2026-09-02", "ggr": 39800 },
        { "date": "2026-09-03", "ggr": 40100 }
      ]
    }
  ],
  "monthly": [
    { "month": "2026-08", "ggr": 41200000 },
    { "month": "2026-09", "ggr": 43900000 }
  ]
}`;

const FIELDS: Array<[string, string, string]> = [
  ["id", "string", "Stable promo ID from the backoffice (used to match updates)"],
  ["name", "string", "Promo name"],
  ["type", "string", "Tournament, Rain, Cashback, Free bets, Missions…"],
  ["operator", "string", "Operator / brand"],
  ["games", "string[]", "Games in the promo"],
  ["market", "string", "Country or region"],
  ["startDate / endDate", "YYYY-MM-DD", "Inclusive promo dates"],
  ["windowDays", "number | null", "Before/after window length; null = same as the promo"],
  ["ggrBefore / ggrDuring / ggrAfter", "number | null", "GGR totals per window (null while not available)"],
  ["prizePool", "number | null", "Promo cost — for net impact and ROI"],
  ["playersBefore / During / After", "number | null", "Optional unique active players"],
  ["daily", "{date, ggr}[]", "Optional daily GGR; fills any missing window totals and draws the timeline"],
  ["monthly[].month / ggr", "YYYY-MM / number", "Total GGR per month, for month-over-month"],
];

export function ConnectPage() {
  const { config, setConfig, status, error, warnings, lastSynced, refresh, dataset } = useData();
  const [draft, setDraft] = useState<SourceConfig>(config);
  useEffect(() => setDraft(config), [config]);
  const set = <K extends keyof SourceConfig>(k: K, v: SourceConfig[K]) => setDraft((d) => ({ ...d, [k]: v }));

  let fieldMapError: string | null = null;
  if (draft.fieldMap.trim()) {
    try {
      const o = JSON.parse(draft.fieldMap);
      if (!o || typeof o !== "object" || Array.isArray(o)) fieldMapError = "Must be a JSON object";
    } catch {
      fieldMapError = "Not valid JSON yet";
    }
  }

  const dirty = JSON.stringify(draft) !== JSON.stringify(config);
  const apply = () => {
    if (fieldMapError) return toast.error("Fix the field map JSON first");
    setConfig(draft);
    toast.success(draft.kind === "manual" ? "Switched to manual entry" : "Saved — syncing now");
  };

  const copy = (t: string) => navigator.clipboard.writeText(t).then(() => toast.success("Copied"));

  const cards: Array<{ kind: SourceKind; icon: typeof Cloud; desc: string }> = [
    { kind: "manual", icon: PencilLine, desc: "Type or paste numbers on the Data page. Saved in this browser — export a backup to share." },
    { kind: "sheet", icon: Database, desc: "The team keeps one Google Sheet up to date; the site reads it on every load. Zero backend work." },
    { kind: "api", icon: Cloud, desc: "Fully automatic: the backoffice exposes one JSON endpoint and the report fills itself." },
  ];

  return (
    <main className="mx-auto max-w-[1100px] space-y-5 px-4 py-6 lg:px-8">
      <div>
        <p className="text-eyebrow">Connect</p>
        <h1 className="mt-1 text-3xl">Where the numbers come from</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Start by typing numbers in by hand, then switch to a shared sheet or the backoffice whenever you're ready — the
          charts and reports don't change.
        </p>
      </div>

      <section className="grid gap-3 md:grid-cols-3">
        {cards.map((c) => (
          <button
            key={c.kind}
            onClick={() => set("kind", c.kind)}
            className={cn(
              "panel relative p-4 text-left transition-all hover:border-primary/50",
              draft.kind === c.kind && "border-primary shadow-glow",
            )}
          >
            {config.kind === c.kind && (
              <span className="absolute right-3 top-3 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-medium text-primary">
                Active
              </span>
            )}
            <c.icon className="size-5 text-primary" />
            <p className="mt-2 font-display font-semibold">{SOURCE_LABEL[c.kind]}</p>
            <p className="mt-1 text-xs text-muted-foreground">{c.desc}</p>
          </button>
        ))}
      </section>

      <section className="panel space-y-4 p-5">
        {draft.kind === "manual" && (
          <p className="text-sm text-muted-foreground">
            Nothing to configure. You currently have {dataset.promos.length} promos and {dataset.monthly.length} monthly
            totals in this browser.
          </p>
        )}

        {draft.kind === "sheet" && (
          <>
            <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
              <li>
                Create a Google Sheet with a <strong>Promos</strong> tab (download the template from Data → Import &amp;
                export) and optionally a <strong>Monthly</strong> tab with <code>month, ggr</code>.
              </li>
              <li>
                Share → <strong>Anyone with the link can view</strong> (or File → Share → Publish to web → CSV).
              </li>
              <li>Paste each tab's link below — open the tab first so the link includes its <code>gid</code>.</li>
            </ol>
            <Field label="Promos tab link (Google Sheet or any CSV URL)">
              <input className={inputCls} value={draft.sheetPromosUrl} onChange={(e) => set("sheetPromosUrl", e.target.value)} placeholder="https://docs.google.com/spreadsheets/d/…/edit#gid=0" />
            </Field>
            <Field label="Monthly GGR tab link (optional)">
              <input className={inputCls} value={draft.sheetMonthlyUrl} onChange={(e) => set("sheetMonthlyUrl", e.target.value)} placeholder="https://docs.google.com/spreadsheets/d/…/edit#gid=123456" />
            </Field>
          </>
        )}

        {draft.kind === "api" && (
          <>
            <Field label="Backoffice endpoint (GET, returns JSON)" hint="One request returns promos + monthly totals. See the contract below.">
              <input className={inputCls} value={draft.apiUrl} onChange={(e) => set("apiUrl", e.target.value)} placeholder="https://backoffice.example.com/api/promo-report" />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Auth header">
                <input className={inputCls} value={draft.apiAuthHeader} onChange={(e) => set("apiAuthHeader", e.target.value)} placeholder="Authorization" />
              </Field>
              <Field label="Token (optional)" hint="A bare token on the Authorization header is sent as Bearer <token>.">
                <input className={inputCls} type="password" autoComplete="off" value={draft.apiToken} onChange={(e) => set("apiToken", e.target.value)} placeholder="••••••" />
              </Field>
            </div>
            <div className="flex gap-2 rounded-lg border border-accent/40 bg-accent/10 p-3 text-xs">
              <ShieldAlert className="size-4 shrink-0 text-accent" />
              <p>
                A token typed here is stored in this browser only. For a site the whole team opens, prefer an endpoint behind
                your VPN / SSO, or a small proxy that adds the token server-side, so no secret ever reaches the browser.
              </p>
            </div>
          </>
        )}

        {draft.kind !== "manual" && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Auto-refresh">
              <Select value={String(draft.refreshMinutes)} onValueChange={(v) => set("refreshMinutes", Number(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Only on load / refresh button</SelectItem>
                  <SelectItem value="5">Every 5 minutes</SelectItem>
                  <SelectItem value="15">Every 15 minutes</SelectItem>
                  <SelectItem value="60">Every hour</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field
              label="Field map (optional)"
              hint={fieldMapError ?? 'Rename fields that the source calls differently, e.g. {"ggr_pre": "ggrBefore", "brand_name": "operator"}'}
            >
              <input
                className={cn(inputCls, "font-mono text-xs", fieldMapError && "border-bad")}
                value={draft.fieldMap}
                onChange={(e) => set("fieldMap", e.target.value)}
                placeholder='{"their_field": "ggrBefore"}'
              />
            </Field>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
          <SyncStatus />
          <div className="flex gap-2">
            {config.kind !== "manual" && !dirty && (
              <Button variant="outline" onClick={() => void refresh()} disabled={status === "loading"}>
                {status === "loading" ? <Loader2 className="size-4 animate-spin" /> : <PlugZap className="size-4" />} Test again
              </Button>
            )}
            <Button onClick={apply} disabled={!dirty}>
              {draft.kind === "manual" ? "Use manual entry" : "Save & connect"}
            </Button>
          </div>
        </div>
        {config.kind !== "manual" && status === "ready" && warnings.length > 0 && (
          <ul className="max-h-32 list-disc space-y-0.5 overflow-auto pl-5 text-xs text-muted-foreground">
            {warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        )}
      </section>

      {/* Contract */}
      <section className="panel p-5">
        <h2 className="flex items-center gap-2 text-base">
          <KeyRound className="size-4 text-primary" /> Backoffice contract
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Hand this to the backoffice team. One <code>GET</code> endpoint returning this JSON is all the report needs; field
          names can differ (use the field map) and the windows can be pre-summed or left for the site to compute from a{" "}
          <code>daily</code> series. Full spec in <code>docs/BACKOFFICE_API.md</code> in the repo.
        </p>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="relative min-w-0">
            <button
              onClick={() => copy(SAMPLE_PAYLOAD)}
              className="absolute right-2 top-2 flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground"
            >
              <Copy className="size-3" /> Copy
            </button>
            <pre className="max-h-[440px] overflow-auto rounded-lg border border-border bg-background/60 p-3 font-mono text-[11.5px] leading-relaxed">
              {SAMPLE_PAYLOAD}
            </pre>
          </div>
          <div className="min-w-0 overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-left text-muted-foreground">
                <tr>
                  <th className="py-1.5 pr-2 font-medium">Field</th>
                  <th className="py-1.5 pr-2 font-medium">Type</th>
                  <th className="py-1.5 font-medium">Meaning</th>
                </tr>
              </thead>
              <tbody>
                {FIELDS.map(([f, t, d]) => (
                  <tr key={f} className="border-t border-border align-top">
                    <td className="py-1.5 pr-2 font-mono text-[11px]">{f}</td>
                    <td className="py-1.5 pr-2 text-muted-foreground">{t}</td>
                    <td className="py-1.5">{d}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <ul className="mt-4 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
              <li>
                Must allow CORS from wherever this site is hosted (<code>Access-Control-Allow-Origin</code>).
              </li>
              <li>
                Wrapped responses work too: <code>{"{ data: { promos, monthly } }"}</code> or a bare array of promos.
              </li>
              <li>
                Numbers can be numbers or strings (<code>"120,000.00"</code>); dates as <code>YYYY-MM-DD</code> or ISO.
              </li>
            </ul>
          </div>
        </div>
      </section>

      <section className="panel p-5 text-sm">
        <h2 className="text-base">Bake it into the deployed site</h2>
        <p className="mt-1 text-muted-foreground">
          Set these when building (e.g. as GitHub Actions variables) so everyone who opens the site lands on live data
          without touching this page:
        </p>
        <pre className="mt-3 overflow-auto rounded-lg border border-border bg-background/60 p-3 font-mono text-[11.5px]">
{`VITE_DATA_SOURCE=api            # manual | sheet | api
VITE_BACKOFFICE_URL=https://backoffice.example.com/api/promo-report
VITE_REFRESH_MINUTES=15
VITE_FIELD_MAP={"ggr_pre":"ggrBefore"}
# or, for a Google Sheet:
VITE_SHEET_PROMOS_URL=https://docs.google.com/spreadsheets/d/…/edit#gid=0
VITE_SHEET_MONTHLY_URL=https://docs.google.com/spreadsheets/d/…/edit#gid=1`}
        </pre>
      </section>
    </main>
  );

  function SyncStatus() {
    if (config.kind === "manual") return <p className="text-xs text-muted-foreground">Active source: manual entry</p>;
    if (status === "loading")
      return (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Connecting to {SOURCE_LABEL[config.kind]}…
        </p>
      );
    if (status === "error")
      return (
        <p className="flex max-w-xl items-start gap-2 text-sm text-bad-ink">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" /> {error}
        </p>
      );
    return (
      <p className="flex items-center gap-2 text-sm">
        <CheckCircle2 className="size-4 text-good-ink" />
        Connected · {dataset.promos.length} promos, {dataset.monthly.length} months
        {lastSynced && <span className="text-muted-foreground">· synced {new Date(lastSynced).toLocaleTimeString()}</span>}
      </p>
    );
  }
}
