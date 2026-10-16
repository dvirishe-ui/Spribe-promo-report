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
  "currency": "EUR",                    // ISO 4217, used for display
  "generatedAt": "2026-10-16T06:00:00Z",
  "promos": [
    {
      "id": "BO-48213",                 // stable ID — used to match updates
      "name": "Aviator Weekend Rain",
      "type": "Rain",                   // Tournament | Rain | Cashback | Free bets | Missions | Leaderboard | …
      "operator": "Operator name",
      "games": ["Aviator"],
      "market": "Brazil",
      "startDate": "2026-09-05",        // inclusive
      "endDate": "2026-09-07",          // inclusive
      "windowDays": null,               // before/after window length; null = same length as the promo

      "ggrBefore": 120000,              // GGR in the windowDays before startDate
      "ggrDuring": 151000,              // GGR from startDate to endDate
      "ggrAfter": 131000,               // GGR in the windowDays after endDate (null until that window has passed)
      "prizePool": 15000,               // promo cost, for net impact / ROI

      "playersBefore": 8200,            // optional unique active players per window
      "playersDuring": 9900,
      "playersAfter": 8700,

      "notes": "",
      "daily": [                        // optional — see below
        { "date": "2026-09-02", "ggr": 39800 }
      ]
    }
  ],
  "monthly": [                          // total GGR per month, for month-over-month
    { "month": "2026-08", "ggr": 41200000 },
    { "month": "2026-09", "ggr": 43900000 }
  ]
}
```

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
| During vs before | `(ggrDuring / promoDays) / (ggrBefore / windowDays) − 1` |
| After vs before | `(ggrAfter / windowDays) / (ggrBefore / windowDays) − 1` |
| Extra GGR (during) | `(perDayDuring − perDayBefore) × promoDays` |
| Halo (after) | `(perDayAfter − perDayBefore) × windowDays` |
| Net impact | `extra + halo − prizePool` |
| ROI | `netImpact / prizePool` |
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
