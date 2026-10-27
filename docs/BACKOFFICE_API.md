# Backoffice API contract

The promo report needs **one read-only endpoint** that returns JSON. Once it exists,
set the URL in the site's **Settings** (Enter numbers → gear icon) (or bake it in with `VITE_BACKOFFICE_URL`)
and every chart, KPI and per-promo report fills itself.

```
GET https://<backoffice>/api/promo-report
Accept: application/json
Authorization: Bearer <token>        # optional — see "Auth" below
```

## Response

```jsonc
{
  "currency": "EUR",                    // ISO 4217 — the currency the report is shown in
  "timeZone": "UTC",                    // dates are calendar days in this zone; cut daily numbers on the same boundaries
  "fxRates": { "BRL": 0.16 },           // optional: value of 1 unit in EUR; overrides the site's example rates
  "generatedAt": "2026-10-16T06:00:00Z",
  "promos": [
    {
      "id": "BO-48213",                 // stable ID — used to match updates
      "name": "Aviator Weekend Rain",
      "type": "Regional Promotion",     // Promo Calendar types: Network Tournament | Cross-Game Challenge | Missions |
                                        // Leaderboard | Collection Campaign | Regional Promotion | Seasonal Promotion | New Game Launch
      "operator": "Operator name",
      "aggregator": "Aggregator name",  // or "Direct"
      "games": ["Aviator"],
      "market": "Brazil",
      "currency": "BRL",                // currency of this promo's GGR numbers; converted to the report currency
      "startDate": "2026-09-05",        // inclusive
      "endDate": "2026-09-07",          // inclusive
      "windowDays": null,               // before/after window length; null = same length as the promo

      "ggrBefore": 120000,              // GGR in the windowDays before startDate
      "ggrDuring": 151000,              // GGR from startDate to endDate
      "ggrAfter": 131000,               // GGR in the windowDays after endDate (null until that window has passed)
      "prizePool": 15000,               // Promo Contribution (prize fund / rewards paid), for net impact and Promo ROI (x)

      "playersBefore": 8200,            // optional unique active players per window
      "playersDuring": 9900,
      "playersAfter": 8700,

      // ---- everything below is optional; the report shows a section only when it's present ----
      "eligiblePlayers": 6500,          // players who could take part
      "participants": 2100,             // unique players who took part
      "newParticipants": 420,           // of which first-time players
      "retainedParticipants": 1150,     // participants who played again in the after window
      "betsDuring": 61000,              // bets by participants during the promo
      "participantWagerDuring": 1650000, // amount wagered by participants during the promo (their share of wager)
      "participantGgrDuring": 52000,     // GGR from participants during the promo
      "turnoverBefore": 3400000,        // amount wagered, same windows as GGR
      "turnoverDuring": 4450000,         // Total Wager; with ggrDuring gives RTP
      "totalBetsBefore": 1410000,         // number of bets per window (all players) — Number of Bets, Avg Bet
      "totalBetsDuring": 1890000,
      "totalBetsAfter": 1530000,
      "turnoverAfter": 3700000,
      "controlGgrBefore": 380000,       // comparison group (no promo), same before/during windows
      "controlGgrDuring": 392000,
      "controlLabel": "Same games at comparable operators without the promo",
      "missions": [                     // mission promos: players reaching each step, in order
        { "name": "Opted in", "reached": 2100 },
        { "name": "Place 20 bets", "reached": 1400 },
        { "name": "All missions done", "reached": 520 }
      ],
      "missionDays": [                  // daily-missions promos: one entry per day (enables completion-by-day + investigation)
        { "day": 1, "game": "Mines", "requirement": "Place 10 bets on Mines", "started": 2100, "completed": 1700, "medianMinutes": 31 },
        { "day": 2, "game": "Hilo",  "requirement": "Hit a ×50 win on Hilo",  "started": 1950, "completed": 780,  "medianMinutes": 152 }
      ],
      "gameGgr": [                      // multi-game promos: GGR during the promo per game; the rest is optional
        { "game": "Mines", "ggrDuring": 98000, "ggrBefore": 81000,       // same windows as the promo
          "wagerBefore": 2300000, "wagerDuring": 2900000, "betsBefore": 960000, "betsDuring": 1310000,
          "playersBefore": 5100, "playersDuring": 6200 },
        { "game": "Hilo", "ggrDuring": 53000 }
      ],
      "leaderboard": [                  // leaderboards / tournaments: aggregate per rank band
        { "band": "1st", "winners": 1, "prize": 3000 },
        { "band": "2nd–10th", "winners": 9, "prize": 6000 }
      ],

      "calendarId": "spribe-adventure-2026", // optional: the Promo Calendar network campaign this is the operator's part of
      "notes": "",
      "daily": [                        // optional — see below
        { "date": "2026-09-02", "ggr": 39800 }
      ]
    }
  ],
  "monthly": [                          // total GGR per month, for month-over-month
    { "month": "2026-08", "ggr": 41200000 },
    { "month": "2026-09", "ggr": 43900000 }
  ],
  "marketTrends": [                     // optional market context for the automatic insights — see below
    {
      "market": "Brazil",
      "from": "2026-09-05", "to": "2026-09-07",                 // = the promo's during window
      "baselineFrom": "2026-09-02", "baselineTo": "2026-09-04", // = the promo's before window
      "provider": "Blask",
      "changes": { "activity": 0.084 },                           // fractions; "8.4%" strings also work
      "activityLabel": "Blask Index (search demand)",
      "retrievedAt": "2026-09-10T06:00:00Z"
    }
  ]
}
```

### Market trends (for automatic insights)

The promo report compares each promo with how its market moved over the same dates. The site
does **not** call Blask (or any market-data provider) itself: no Blask API access is configured,
and provider credentials must never sit in a browser. If SPRIBE has Blask API access, the Back
Office (or a small proxy) can fetch the figures server-side and include them as `marketTrends`.
Until then, people can type figures into the report (Insights → Market context → Add); those are
saved in that browser and always labelled "entered manually".

- `changes` keys: `ggr`, `wager`, `bets`, `players` (only when the provider measures exactly that)
  and `activity` (an index such as the Blask Index, which measures search demand, **not** GGR).
  Activity is never shown as market GGR; it's compared with operator GGR only as an "indicative"
  direction check.
- A bare number is a fraction (`0.084` = +8.4%). Use a string with `%` for percentages.
- Each change is for `from`–`to` vs `baselineFrom`–`baselineTo`, per day if the lengths differ.
  An entry is only used when both periods match the promo's during and before windows; otherwise
  the report says the comparison is unavailable and why.

A working example payload is served by the site itself at `/demo-backoffice.json`
(sample numbers only) — point Settings at it to see API mode working.

### Two ways to send GGR

1. **Pre-summed windows** — fill `ggrBefore`, `ggrDuring`, `ggrAfter`. Simplest.
2. **Daily series** — send `daily` covering `startDate − windowDays` to `endDate + windowDays`
   and leave the window totals `null`. The site sums the windows itself and also draws a
   day-by-day timeline on the promo report. You can send both; typed totals win.

For a promo that is still live, send what you have: partial `daily` data is shown as
"so far", and `ggrAfter: null` shows "not in yet".

### Flexibility

- **Field names** don't have to match. The site matches loosely (`ggr_before`, `GGR Before`,
  `ggrBefore` all work) and Settings has a *field names map* for anything else, e.g.
  `{"ggr_pre_period": "ggrBefore", "brand_name": "operator"}`.
- **Wrappers**: `{ "data": { "promos": [...], "monthly": [...] } }` or a bare array of promos also work.
- **Numbers** can be numbers or strings (`"120,000.00"`, `"1.234,50"`). **Dates** as `YYYY-MM-DD`, ISO
  timestamps, or `DD/MM/YYYY`.
- `promotions` / `campaigns` are accepted as aliases for `promos`; `months` for `monthly`.

## How the report uses it

All comparisons are made on **GGR per day**, so windows of different lengths compare fairly
(with the default equal windows that's identical to comparing totals).

| Metric | Formula |
| --- | --- |
| During vs before (raw) | `(ggrDuring / promoDays) / (ggrBefore / windowDays) − 1` |
| Market trend | `(controlGgrDuring / promoDays) / (controlGgrBefore / windowDays) − 1` |
| GGR change, adjusted | `(1 + raw) / (1 + market trend) − 1` — shown as "adj."; without a comparison group the raw change is shown as "raw" |
| After vs before | `(ggrAfter / windowDays) / (ggrBefore / windowDays) − 1` |
| Extra GGR (during) | `(perDayDuring − perDayBefore × (1 + market trend)) × promoDays` (trend = 0 without a comparison group) |
| Halo (after) | `(perDayAfter − perDayBefore) × windowDays` |
| Net impact | `extra + halo − prizePool` |
| ROI | `netImpact / prizePool` |
| Participation | `participants / playersDuring` |
| Retention | `retainedParticipants / participants` |
| Mission completion | `last step reached / first step reached`; hardest step = largest drop from the step before |
| GGR margin | `GGR / turnover` per window |
| Uplift retained | `(perDayAfter − perDayBefore) / (perDayDuring − perDayBefore)` |
| GGR vs previous month | `monthly[m].ggr / monthly[m−1].ggr − 1` |
| Aggregate uplift | baseline-weighted: `Σ during / Σ before` over promos with data (not an average of %) |

## Requirements

- **CORS**: the endpoint must send `Access-Control-Allow-Origin` for the site's origin
  (and allow the auth header if one is used).
- **Auth**: a token typed in Settings lives in that browser's localStorage only.
  For a team-wide deployment prefer an endpoint behind VPN/SSO, or a tiny proxy that adds the
  token server-side, so no secret reaches the browser. Never bake a token into `VITE_*` vars —
  they end up in the public JS bundle.
- **Freshness**: the site refetches on load, on the refresh button, and optionally every
  5/15/60 minutes (`VITE_REFRESH_MINUTES`). A daily-updated endpoint is plenty.

## Status and reporting periods

`upcoming` → `live` → `measuring` (ended, after window still running) → `complete`.
Results are final only when a promo is `complete`; cost conclusions and key findings about
cost wait for it. A promo belongs to the month it starts in.

## Privacy and access

- **Aggregate data only.** Send totals and counts per promo (and per mission step / rank band).
  Never player IDs, usernames or any per-player rows — the report has no place to show them.
- **Access control lives in front of the data.** The site is static; it can't enforce roles by
  itself. Serve both the site and this endpoint behind company login (SSO / VPN), and let the
  endpoint return only the operators and markets the signed-in user may see.
- **No secrets in the browser bundle.** Don't put tokens in `VITE_*` variables. Prefer SSO
  cookies or a small proxy that adds credentials server-side.

## Data quality the site checks

- **Completeness** per promo (what each promo type needs) — shown on the Data page and in
  insights; missing numbers are left out, never estimated.
- **Duplicates** — same operator, name and dates. Imports skip them with a warning; existing
  ones are flagged. Send a stable `id` so updates replace rather than duplicate.
- **Freshness** — `generatedAt` and the last successful sync are shown in the header; a failed
  sync keeps the last loaded numbers and raises a data insight.
- **Time zone** — `timeZone` (default UTC). Promo dates and daily rows must use the same days.

## Permissions

The endpoint should return only the operators the signed-in user may see (SPRIBE internal:
all; an AM: their portfolio; an operator login: their own). The site's "View as" menu only
previews this — it is not a security boundary.

## Promo Calendar campaigns

Network campaigns (World Cup Kickoff, SPRIBE Adventure, …) are SPRIBE-run and
span many operators. They are copied from the Promo Calendar site into
`src/lib/campaigns.ts`. Each operator's results for a campaign are a normal
promo record with `calendarId` set to the campaign's id. The calendar then
shows one entry for the campaign with the combined result and a row per
operator. Once both sites read from the Back Office, the campaign list should
come from the same feed, for example a `campaigns` array next to `promos`.

## Report columns

The Promotions results table and its CSV use these columns, in this order.
Spreadsheet imports accept the same headers (plus start and end dates, which
are required).

| Column | Source / formula |
| --- | --- |
| Promotion, Aggregator, Operator, Type | `name`, `aggregator`, `operator`, `type` |
| Promo Contribution | `prizePool` (header aliases: "Promo Contribution", "Contribution") |
| GGR Before / During / After | `ggrBefore`, `ggrDuring`, `ggrAfter` |
| During vs Before, After vs Before | Calculated: GGR per day vs per day before (observed) |
| Total Wager | `turnoverDuring` (aliases: "Total Wager", "Wager") |
| Part. Rate | Calculated: `participants ÷ playersDuring`; otherwise `reportedParticipationRate` (alias "Part. Rate"), marked * |
| RTP | Calculated: `(turnoverDuring − ggrDuring) ÷ turnoverDuring`; otherwise `reportedRtp` (alias "RTP"), marked * |
| Promo ROI (x) | Calculated: extra GGR (during + after vs the before run-rate) ÷ Promo Contribution |

Rates can be sent as `0.965`, `96.5` or `"96.5%"`.
