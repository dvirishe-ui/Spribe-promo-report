# SPRIBE Promo Performance Report

An internal dashboard that answers **"did the promo move GGR?"** — for every promotion and
across all of them — and is built to switch from hand-typed numbers to the backoffice
without changing anything else.

## What it shows

**Reports** (`/`): pick a month with the arrows, or switch to *All*.
- Four numbers: how many promos ran, GGR during vs before, GGR after vs before, and the month's
  total GGR vs the previous month.
- One chart of GGR before / during / after for each promo, and one of total GGR by month.
- The list of promos. Click one to open its report in a side panel, the same way the
  Promo Calendar opens a promotion.

**Promo report** (side panel, or `/promo/:id` full page): before / during / after with the
change, GGR per day (when daily data exists), a few plain sentences on what happened, notes,
and **Copy summary** / **Print**.

**Enter numbers** (`/data`):
- A simple table: click any GGR number to change it (`120k` and `€120,000` both work).
- **Add promo** opens a short form. Prize pool, players and notes are under "More details".
- A Monthly GGR tab for each month's total.
- **Import / export**: paste rows from Excel or Google Sheets, upload a CSV, download CSV or a
  backup.
- **Settings** (gear): currency, and where the numbers come from:

| Source | How | Who can edit |
| --- | --- | --- |
| Manual entry | Typed / pasted on the site, saved in the browser | You, in this browser |
| Google Sheet / CSV | Site reads a shared sheet on every load | Anyone with access to the sheet |
| Backoffice API | One `GET` endpoint returning JSON, fully automatic | The backoffice |

The backoffice contract is in [`docs/BACKOFFICE_API.md`](docs/BACKOFFICE_API.md). A demo
payload is served at `/demo-backoffice.json` to try API mode end-to-end.

The site opens in a light theme (dark is one click away in the header) and ships with clearly
labelled **example numbers** until you clear them.

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
src/routes/            reports, promo report, enter numbers
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
