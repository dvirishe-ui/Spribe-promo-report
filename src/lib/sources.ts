import { parseDelimited, rowsToObjects } from "./csv";
import { normalizeDataset, normalizeMonthly, normalizePromos, parseFieldMap } from "./normalize";
import type { Dataset } from "./types";

/**
 * Where the report's numbers come from.
 *
 *  - manual: typed in / imported on the Data page, saved in this browser.
 *  - sheet:  a Google Sheet (or any CSV URL) the team edits together.
 *  - api:    the backoffice. One GET returning JSON — see docs/BACKOFFICE_API.md.
 *
 * Defaults can be baked in at build time with VITE_* env vars so the deployed
 * site points at the backoffice without anyone touching settings.
 */

export type SourceKind = "manual" | "sheet" | "api";

export interface SourceConfig {
  kind: SourceKind;
  sheetPromosUrl: string;
  sheetMonthlyUrl: string;
  apiUrl: string;
  apiAuthHeader: string;
  apiToken: string;
  /** Auto-refresh for sheet/api sources; 0 = only on load and on demand */
  refreshMinutes: number;
  /** JSON object renaming backoffice fields to ours, e.g. {"ggr_pre":"ggrBefore"} */
  fieldMap: string;
}

const env = import.meta.env;

function envKind(): SourceKind {
  const k = String(env.VITE_DATA_SOURCE ?? "").toLowerCase();
  return k === "api" || k === "sheet" ? k : "manual";
}

export const DEFAULT_CONFIG: SourceConfig = {
  kind: envKind(),
  sheetPromosUrl: env.VITE_SHEET_PROMOS_URL ?? "",
  sheetMonthlyUrl: env.VITE_SHEET_MONTHLY_URL ?? "",
  apiUrl: env.VITE_BACKOFFICE_URL ?? "",
  apiAuthHeader: env.VITE_BACKOFFICE_AUTH_HEADER ?? "Authorization",
  apiToken: "",
  refreshMinutes: Number(env.VITE_REFRESH_MINUTES ?? 0) || 0,
  fieldMap: env.VITE_FIELD_MAP ?? "",
};

export const SOURCE_LABEL: Record<SourceKind, string> = {
  manual: "Manual entry",
  sheet: "Google Sheet / CSV",
  api: "Back Office",
};

/**
 * Turns a normal Google Sheets link into its CSV export link, so people can
 * paste the URL straight from the address bar. The sheet must be shared as
 * "Anyone with the link can view" or published to the web.
 */
export function toCsvUrl(url: string): string {
  const u = url.trim();
  const m = u.match(/docs\.google\.com\/spreadsheets\/d\/([\w-]+)/);
  if (!m || /output=csv|format=csv/.test(u)) return u;
  const gid = u.match(/[#&?]gid=(\d+)/)?.[1] ?? "0";
  return `https://docs.google.com/spreadsheets/d/${m[1]}/export?format=csv&gid=${gid}`;
}

async function fetchText(url: string, init?: RequestInit): Promise<string> {
  let res: Response;
  try {
    res = await fetch(url, { ...init, cache: "no-store" });
  } catch {
    throw new Error(
      `Could not reach ${new URL(url, location.href).host}. Check the URL, your network/VPN, and that the server allows CORS from this site.`,
    );
  }
  if (!res.ok) throw new Error(`${res.status} ${res.statusText || "error"} from ${url}`);
  return res.text();
}

export interface FetchResult {
  dataset: Dataset;
  warnings: string[];
}

export async function fetchRemote(config: SourceConfig, currency: string): Promise<FetchResult> {
  const fieldMap = parseFieldMap(config.fieldMap);

  if (config.kind === "sheet") {
    if (!config.sheetPromosUrl.trim()) throw new Error("Add the link to the promos tab in Settings.");
    const promoText = await fetchText(toCsvUrl(config.sheetPromosUrl));
    if (/^\s*<(!doctype|html)/i.test(promoText)) {
      throw new Error('The sheet link returned a web page, not CSV. Share the sheet as "Anyone with the link can view".');
    }
    const promos = normalizePromos(rowsToObjects(parseDelimited(promoText)), fieldMap);
    let monthly = { records: [] as Dataset["monthly"], warnings: [] as string[] };
    if (config.sheetMonthlyUrl.trim()) {
      const monthText = await fetchText(toCsvUrl(config.sheetMonthlyUrl));
      monthly = normalizeMonthly(rowsToObjects(parseDelimited(monthText)), fieldMap);
    }
    return {
      dataset: { promos: promos.records, monthly: monthly.records, currency, generatedAt: new Date().toISOString() },
      warnings: [...promos.warnings, ...monthly.warnings],
    };
  }

  if (config.kind === "api") {
    if (!config.apiUrl.trim()) throw new Error("Add the backoffice address in Settings.");
    const headers: Record<string, string> = { Accept: "application/json" };
    if (config.apiToken.trim()) {
      const header = config.apiAuthHeader.trim() || "Authorization";
      const token = config.apiToken.trim();
      headers[header] = header.toLowerCase() === "authorization" && !/\s/.test(token) ? `Bearer ${token}` : token;
    }
    const text = await fetchText(config.apiUrl.trim(), { headers });
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      throw new Error("The backoffice responded, but not with JSON.");
    }
    const { dataset, warnings } = normalizeDataset(json, fieldMap);
    return { dataset, warnings };
  }

  throw new Error("Manual mode has no remote source.");
}
