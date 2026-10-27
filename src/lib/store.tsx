import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { computeAll, type PromoMetrics } from "./metrics";
import { toDisplayCurrency } from "./fx";
import { newId } from "./normalize";
import { sampleDataset } from "./sampleData";
import { DEFAULT_CONFIG, fetchRemote, type SourceConfig } from "./sources";
import type { Dataset, MarketTrend, MonthlyRecord, PromoRecord } from "./types";

const DATA_KEY = "spribe-report-data-v1";
const CONFIG_KEY = "spribe-report-source-v1";
const REMOTE_CACHE_KEY = "spribe-report-remote-cache-v1";
const ACCESS_KEY = "spribe-report-access-v1";
/** Market trends typed in on the site — kept apart from the promo data so a Back Office refresh never overwrites them */
const MARKET_KEY = "spribe-report-market-v1";

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage full or blocked — the in-memory state still works for this visit
  }
}

function loadManual(): Dataset {
  const stored = read<Dataset>(DATA_KEY);
  if (stored && Array.isArray(stored.promos) && Array.isArray(stored.monthly)) {
    // Untouched example data from an older version: swap in the current examples.
    if (stored.isSample && stored.promos.every((p) => p.id.startsWith("sample-"))) return sampleDataset();
    return {
      ...stored,
      currency: stored.currency || "EUR",
      // Fill fields added after the data was saved.
      promos: stored.promos.map((p) => ({ ...p, aggregator: p.aggregator ?? "", currency: p.currency ?? "" })),
    };
  }
  return sampleDataset();
}

function loadConfig(): SourceConfig {
  return { ...DEFAULT_CONFIG, ...(read<Partial<SourceConfig>>(CONFIG_KEY) ?? {}) };
}

export type SyncStatus = "idle" | "loading" | "ready" | "error";
export type ImportMode = "merge" | "replace";

interface DataContextValue {
  /** The data as stored/entered — each promo in its own currency. */
  dataset: Dataset;
  /** Report metrics, with every promo converted into the display currency — limited to the access scope. */
  metrics: PromoMetrics[];
  /**
   * Operator the current viewer is limited to, or null for internal (all operators).
   * Preview of permission-based access: real enforcement must happen where the data
   * is served (the Back Office endpoint), not only in the browser.
   */
  accessOperator: string | null;
  setAccessOperator: (op: string | null) => void;
  /** Every operator in the data, regardless of scope (for the access picker) */
  allOperators: string[];
  /** true while any of the built-in sample promos are still loaded */
  hasSample: boolean;
  config: SourceConfig;
  setConfig: (c: SourceConfig) => void;
  status: SyncStatus;
  error: string | null;
  warnings: string[];
  lastSynced: string | null;
  refresh: () => Promise<void>;
  /** Only the manual source can be edited from the site; remote sources are read-only mirrors. */
  editable: boolean;
  /** Market trends: those delivered with the data plus those typed in on this site (origin "manual") */
  marketTrends: MarketTrend[];
  saveMarketTrend: (t: MarketTrend) => void;
  deleteMarketTrend: (id: string) => void;

  savePromo: (p: PromoRecord) => void;
  deletePromo: (id: string) => void;
  duplicatePromo: (id: string) => string | null;
  importPromos: (list: PromoRecord[], mode: ImportMode) => void;
  saveMonthly: (m: MonthlyRecord, previousMonth?: string) => void;
  deleteMonthly: (month: string) => void;
  importMonthly: (list: MonthlyRecord[], mode: ImportMode) => void;
  setCurrency: (c: string) => void;
  setFxRate: (currency: string, eurValue: number | null) => void;
  loadSample: () => void;
  removeSample: () => void;
  clearAll: () => void;
  copyRemoteToManual: () => void;
}

const DataContext = createContext<DataContextValue | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const [config, setConfigState] = useState<SourceConfig>(loadConfig);
  const [manual, setManual] = useState<Dataset>(loadManual);
  const [remote, setRemote] = useState<Dataset | null>(() => read<Dataset>(REMOTE_CACHE_KEY));
  const [status, setStatus] = useState<SyncStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [lastSynced, setLastSynced] = useState<string | null>(() => remote?.generatedAt ?? null);
  const requestId = useRef(0);

  const isRemote = config.kind !== "manual";

  const updateManual = useCallback((fn: (d: Dataset) => Dataset) => {
    setManual((prev) => {
      const next = { ...fn(prev), updatedAt: new Date().toISOString() };
      write(DATA_KEY, next);
      return next;
    });
  }, []);

  const setConfig = useCallback((c: SourceConfig) => {
    setConfigState(c);
    write(CONFIG_KEY, c);
  }, []);

  const refresh = useCallback(async () => {
    if (config.kind === "manual") {
      setStatus("ready");
      setError(null);
      setWarnings([]);
      return;
    }
    const id = ++requestId.current;
    setStatus("loading");
    try {
      const { dataset, warnings } = await fetchRemote(config, manual.currency);
      if (id !== requestId.current) return;
      setRemote(dataset);
      write(REMOTE_CACHE_KEY, dataset);
      setWarnings(warnings);
      setError(null);
      setStatus("ready");
      setLastSynced(new Date().toISOString());
    } catch (e) {
      if (id !== requestId.current) return;
      setError(e instanceof Error ? e.message : String(e));
      setStatus("error");
    }
    // manual.currency is intentionally not a dependency: changing display currency shouldn't refetch.
  }, [config]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!isRemote || !config.refreshMinutes) return;
    const t = setInterval(() => void refresh(), config.refreshMinutes * 60_000);
    return () => clearInterval(t);
  }, [isRemote, config.refreshMinutes, refresh]);

  const dataset: Dataset = useMemo(() => {
    if (!isRemote) return manual;
    return remote
      ? { ...remote, currency: remote.currency || manual.currency, fxRates: { ...manual.fxRates, ...remote.fxRates } }
      : { promos: [], monthly: [], currency: manual.currency };
  }, [isRemote, manual, remote]);

  const [manualTrends, setManualTrends] = useState<MarketTrend[]>(() => (read<MarketTrend[]>(MARKET_KEY) ?? []).filter((t) => t && t.id && t.market));
  const updateTrends = (fn: (list: MarketTrend[]) => MarketTrend[]) =>
    setManualTrends((prev) => {
      const next = fn(prev);
      write(MARKET_KEY, next);
      return next;
    });
  const marketTrends = useMemo(() => [...(dataset.marketTrends ?? []), ...manualTrends], [dataset.marketTrends, manualTrends]);

  const [accessOperator, setAccess] = useState<string | null>(() => read<string>(ACCESS_KEY));
  const allMetrics = useMemo(() => computeAll(toDisplayCurrency(dataset)), [dataset]);
  const metrics = useMemo(
    () => (accessOperator ? allMetrics.filter((m) => m.promo.operator === accessOperator) : allMetrics),
    [allMetrics, accessOperator],
  );
  const allOperators = useMemo(() => [...new Set(dataset.promos.map((p) => p.operator).filter(Boolean))].sort(), [dataset.promos]);
  const hasSample = dataset.promos.some((p) => p.id.startsWith("sample-"));

  const value: DataContextValue = {
    dataset,
    metrics,
    accessOperator,
    setAccessOperator: (op) => {
      setAccess(op);
      write(ACCESS_KEY, op);
    },
    allOperators,
    hasSample,
    config,
    setConfig,
    status,
    error,
    warnings,
    lastSynced,
    refresh,
    editable: !isRemote,
    marketTrends,
    saveMarketTrend: (t) => updateTrends((list) => [...list.filter((x) => x.id !== t.id), { ...t, origin: "manual" }]),
    deleteMarketTrend: (id) => updateTrends((list) => list.filter((x) => x.id !== id)),

    savePromo: (p) =>
      updateManual((d) => {
        const exists = d.promos.some((x) => x.id === p.id);
        return { ...d, promos: exists ? d.promos.map((x) => (x.id === p.id ? p : x)) : [...d.promos, p] };
      }),
    deletePromo: (id) => updateManual((d) => ({ ...d, promos: d.promos.filter((p) => p.id !== id) })),
    duplicatePromo: (id) => {
      const src = manual.promos.find((p) => p.id === id);
      if (!src) return null;
      const copy: PromoRecord = { ...src, id: newId(), name: `${src.name} (copy)` };
      updateManual((d) => {
        const i = d.promos.findIndex((p) => p.id === id);
        const promos = [...d.promos];
        promos.splice(i + 1, 0, copy);
        return { ...d, promos };
      });
      return copy.id;
    },
    importPromos: (list, mode) =>
      updateManual((d) => {
        if (mode === "replace") return { ...d, promos: list };
        const byId = new Map(d.promos.map((p) => [p.id, p]));
        for (const p of list) byId.set(p.id, p);
        return { ...d, promos: [...byId.values()] };
      }),
    saveMonthly: (m, previousMonth) =>
      updateManual((d) => {
        const rest = d.monthly.filter((x) => x.month !== m.month && x.month !== previousMonth);
        return { ...d, monthly: [...rest, m].sort((a, b) => a.month.localeCompare(b.month)) };
      }),
    deleteMonthly: (month) => updateManual((d) => ({ ...d, monthly: d.monthly.filter((m) => m.month !== month) })),
    importMonthly: (list, mode) =>
      updateManual((d) => {
        const map = new Map((mode === "replace" ? [] : d.monthly).map((m) => [m.month, m]));
        for (const m of list) map.set(m.month, m);
        return { ...d, monthly: [...map.values()].sort((a, b) => a.month.localeCompare(b.month)) };
      }),
    setCurrency: (c) => updateManual((d) => ({ ...d, currency: c })),
    setFxRate: (c, v) =>
      updateManual((d) => {
        const fxRates = { ...(d.fxRates ?? {}) };
        if (v == null || !(v > 0)) delete fxRates[c];
        else fxRates[c] = v;
        return { ...d, fxRates };
      }),
    loadSample: () => updateManual((d) => ({ ...sampleDataset(), currency: d.currency, fxRates: d.fxRates })),
    removeSample: () =>
      updateManual((d) => {
        // Drop sample months only where the number is still the untouched sample value.
        const sample = new Map(sampleDataset().monthly.map((m) => [m.month, m.ggr]));
        const monthly = d.monthly.filter((m) => sample.get(m.month) !== m.ggr);
        return {
          ...d,
          isSample: false,
          promos: d.promos.filter((p) => !p.id.startsWith("sample-")),
          monthly,
          marketTrends: d.marketTrends?.filter((t) => t.origin !== "sample"),
        };
      }),
    clearAll: () => updateManual((d) => ({ promos: [], monthly: [], currency: d.currency, isSample: false })),
    copyRemoteToManual: () => {
      if (!remote) return;
      updateManual(() => ({ ...remote, isSample: false }));
    },
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used within DataProvider");
  return ctx;
}
