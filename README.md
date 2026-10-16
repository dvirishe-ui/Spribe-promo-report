# SPRIBE Promo Performance Report

An internal dashboard that answers **"did the promo move GGR?"** — for every promotion and
across all of them — and is built to switch from hand-typed numbers to the backoffice
without changing anything else.

## What it shows

**Dashboard** (`/`)
- KPIs: number of promos (vs previous period), GGR during promos, **during vs before**,
  **after vs before**, extra GGR generated (and net of prizes), **total GGR vs previous month**.
- *Before → During → After* curve: every promo indexed to its own pre-promo run-rate (=100),
  with the baseline-weighted average on top.
- Total GGR by month and number of promos by month (click a month to focus on it).
- Uplift per promo (during vs before as bars, after vs before as dots).
- Before / During / After GGR grouped by type, game, operator or market.
- Prize pool vs extra GGR (ROI map, break-even line).
- Month-over-month impact table and a sortable table of every promo.
- Filters by period, operator, type, game and market. Every chart has a table view.

**Promo report** (`/promo/:id`) — one page per promo: before/during/after totals and per-day,
uplift, halo, retained lift, net impact, ROI, month vs previous month, active players, a daily
GGR timeline (when daily data exists), plain-language "what happened" bullets, **Copy summary**
(for Slack/email) and **Print / PDF**.

**Data** (`/data`) — where the numbers go in:
- Spreadsheet-style grid: type straight into cells (accepts `€120,000`, `120k`, `1.234,50`).
- Full form per promo with a live preview of the results.
- Monthly GGR totals.
- Paste rows from Excel / Google Sheets, or upload CSV; export CSV and a full JSON backup.

**Connect** (`/connect`) — choose where data comes from:

| Source | How | Who can edit |
| --- | --- | --- |
| Manual entry | Typed / pasted on the Data page, saved in the browser (localStorage) | You, in this browser |
| Google Sheet / CSV | Site reads a shared sheet on every load | Anyone with access to the sheet |
| Backoffice API | One `GET` endpoint returning JSON — fully automatic | The backoffice |

The backoffice contract is in [`docs/BACKOFFICE_API.md`](docs/BACKOFFICE_API.md). A demo
payload is served at `/demo-backoffice.json` to try API mode end-to-end.

> The site ships with clearly-labelled **sample numbers** so the charts have something to
> draw. Remove them with one click (banner at the top) or on Data → Import & export.

## How the numbers are calculated

Every comparison is made on **GGR per day**, so a 3-day promo can be compared with a 7-day
baseline fairly. By default the before and after windows are the same length as the promo.
Aggregates are **baseline-weighted** (Σ during / Σ before), not an average of percentages, so
one tiny promo can't skew the headline. All formulas live in `src/lib/metrics.ts` and are
listed in the API doc.

## Stack

Vite + React 19 + TypeScript, TanStack Router (hash routes — works on any static host),
Tailwind CSS v4, Radix UI. Charts are hand-built SVG (`src/components/charts`) with hover
tooltips, light/dark themes and a colorblind-checked palette. Same design system as the
SPRIBE Partner Promo Hub.

```
src/lib/types.ts       data model
src/lib/metrics.ts     all report math
src/lib/normalize.ts   turns CSV / pasted / API input into the model (loose field matching)
src/lib/sources.ts     manual / Google Sheet / backoffice API
src/lib/store.tsx      data provider (persistence, sync, edits)
src/routes/            dashboard, promo report, data, connect
```

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check + production build into dist/
npm run lint
```

## Deploy

`dist/` is a static site (relative paths + hash routing), so it runs from any static host or
subfolder. A GitHub Pages workflow is included (`.github/workflows/deploy.yml`): enable
**Settings → Pages → Source: GitHub Actions**, merge to `main`, and it publishes. To point the
deployed site at the backoffice or a sheet by default, set the `VITE_*` repository variables
listed in `.env.example`.

The Pages URL is public unless the repo's Pages visibility is restricted. Manual-entry numbers never
leave the viewer's browser, but anything served by a connected source is visible to whoever can
open the site — put the endpoint behind VPN/SSO if the numbers are sensitive.
