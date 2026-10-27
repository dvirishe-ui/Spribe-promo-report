import type { MonthlyRecord, PromoRecord } from "./types";

/** Minimal RFC-4180 parser. Auto-detects tab (Excel/Sheets paste), semicolon (EU Excel) or comma. */
export function parseDelimited(text: string): string[][] {
  const clean = text.replace(/^﻿/, "");
  const firstLine = clean.split(/\r?\n/, 1)[0] ?? "";
  const counts = { "\t": 0, ";": 0, ",": 0 } as Record<string, number>;
  let inQ = false;
  for (const ch of firstLine) {
    if (ch === '"') inQ = !inQ;
    else if (!inQ && ch in counts) counts[ch]++;
  }
  const delim = counts["\t"] > 0 ? "\t" : counts[";"] > counts[","] ? ";" : ",";

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (quoted) {
      if (ch === '"') {
        if (clean[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += ch;
    } else if (ch === '"' && field === "") quoted = true;
    else if (ch === delim) {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && clean[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

/** First row = headers → array of objects keyed by header. */
export function rowsToObjects(rows: string[][]): Record<string, string>[] {
  if (rows.length < 2) return [];
  const [header, ...body] = rows;
  return body.map((r) => Object.fromEntries(header.map((h, i) => [h.trim(), r[i] ?? ""])));
}

function cell(v: unknown): string {
  if (v == null) return "";
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(header: string[], rows: unknown[][]): string {
  return [header, ...rows].map((r) => r.map(cell).join(",")).join("\n");
}

export const PROMO_COLUMNS = [
  "id",
  "name",
  "type",
  "operator",
  "aggregator",
  "games",
  "market",
  "currency",
  "start_date",
  "end_date",
  "window_days",
  "ggr_before",
  "ggr_during",
  "ggr_after",
  "prize_pool",
  "players_before",
  "players_during",
  "players_after",
  "participants",
  "new_participants",
  "retained_participants",
  "bets_during",
  "participant_wager_during",
  "participant_ggr_during",
  "turnover_before",
  "turnover_during",
  "turnover_after",
  "total_bets_before",
  "total_bets_during",
  "total_bets_after",
  "control_ggr_before",
  "control_ggr_during",
  "control_label",
  "eligible_players",
  "reported_rtp",
  "reported_participation_rate",
  "calendar_id",
  "notes",
];

export function promosToCsv(promos: PromoRecord[]): string {
  return toCsv(
    PROMO_COLUMNS,
    promos.map((p) => [
      p.id,
      p.name,
      p.type,
      p.operator,
      p.aggregator,
      p.games.join("|"),
      p.market,
      p.currency,
      p.startDate,
      p.endDate,
      p.windowDays,
      p.ggrBefore,
      p.ggrDuring,
      p.ggrAfter,
      p.prizePool,
      p.playersBefore,
      p.playersDuring,
      p.playersAfter,
      p.participants,
      p.newParticipants,
      p.retainedParticipants,
      p.betsDuring,
      p.participantWagerDuring,
      p.participantGgrDuring,
      p.turnoverBefore,
      p.turnoverDuring,
      p.turnoverAfter,
      p.totalBetsBefore,
      p.totalBetsDuring,
      p.totalBetsAfter,
      p.controlGgrBefore,
      p.controlGgrDuring,
      p.controlLabel,
      p.eligiblePlayers,
      p.reportedRtp,
      p.reportedParticipationRate,
      p.calendarId,
      p.notes,
    ]),
  );
}

export const MONTHLY_COLUMNS = ["month", "ggr", "notes"];

export function monthlyToCsv(monthly: MonthlyRecord[]): string {
  return toCsv(
    MONTHLY_COLUMNS,
    monthly.map((m) => [m.month, m.ggr, m.notes]),
  );
}

export const PROMO_TEMPLATE = toCsv(PROMO_COLUMNS, [
  [
    "",
    "Aviator Weekend Rain",
    "Regional Promotion",
    "Operator name",
    "Aggregator name",
    "Aviator",
    "Brazil",
    "BRL",
    "2026-09-05",
    "2026-09-07",
    "",
    "120000",
    "151000",
    "131000",
    "15000",
    "8200",
    "9900",
    "8700",
    "2100",
    "420",
    "1150",
    "61000",
    "1650000",
    "52000",
    "3400000",
    "4450000",
    "3700000",
    "1410000",
    "1890000",
    "1530000",
    "",
    "",
    "",
    "5400",
    "",
    "",
    "",
    "Example row — replace with your numbers",
  ],
]);

export const MONTHLY_TEMPLATE = toCsv(MONTHLY_COLUMNS, [
  ["2026-08", "41200000", ""],
  ["2026-09", "43900000", ""],
]);

export function downloadText(filename: string, text: string, mime = "text/csv") {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
