# SPRIBE Promo Performance Report

An internal dashboard that answers **"did the promo move GGR?"** — for every promotion and
across all of them — and is built to switch from hand-typed numbers to the backoffice
without changing anything else.

## What it shows

**Reports** (`/`), built to be understood in 30 seconds. It opens with **how the promos went** —
one sentence for the period ("In September 2026, 3 promos ran") and clickable counts such as
"2 raised GGR and paid back · 1 didn't pay back its cost" that filter the list.
- Month arrows or *All*, and a collapsible filter sidebar (market, aggregator, operator, promotion
  type, game, search).
- Four KPIs: **promotions**, **GGR change**, **unique participants**, **total promo cost**.
- **Key findings**: up to three rule-based observations, each with the evidence it's based on and
  a one-click drill-down (no AI, nothing without supporting data).
- The GGR before / during / after chart, *Results by* market / aggregator / operator / type, and
  the monthly trend.
- The promo list with status (Upcoming / Live / Measuring / Complete), operator, dates and the GGR
  change — marked **adj.** when adjusted for the market trend, **raw** when it isn't.
- **Share**: copy a text summary, or download the current view's results as CSV.

**Promo report** (`/promo/:id`) answers "how did it go?" first: the outcome in plain words
("GGR went up 24.7% during the promo", "…but it didn't pay back its cost", "Early read…"), three big
numbers (GGR change, return on rewards, players), a before → during → after picture of GGR per
day, and rule-based suggested next steps. Outcome wording never overclaims: only a change adjusted
for the market trend is called "it worked". The rules are in `src/lib/verdict.ts`.

**Partner view** (`/share/:id`): the same result on one clean page with no app menus or editing —
for screen-sharing, sending as a PDF, or opening with a partner.

Below the result, **Details** tabs appear only when the promo has the data for them:
- **Overview** — key results, whether the change is incremental or just a before/during
  comparison, before/during/after with daily GGR, a plain summary, and how it compares with past
  promos of the same type.
- **Players** — participants, new players, participation, retention, engagement.
- **Missions** (mission-style promos) — completion rate, progression per step, hardest step and
  drop-offs. **Rankings** (leaderboards / tournaments) — winners and prize distribution by rank band.
- **Financials** — GGR, turnover and margin per period, promo cost, extra GGR, net impact, return
  on cost, market trend and month context.

**Data** (`/data`): where the numbers come from — current source, freshness, Back Office state —
with manual entry, Excel/CSV import and exports as the fallback. **Settings** (gear) holds the
currency, exchange rates and the source:

| Source | How | Status |
| --- | --- | --- |
| Back Office | One `GET` endpoint returning JSON — fully automatic | Planned: needs the BO endpoint ([`docs/BACKOFFICE_API.md`](docs/BACKOFFICE_API.md)) |
| Google Sheet / CSV | Site reads a shared sheet on every load | Available |
| Manual entry | Typed / pasted / imported on the site, saved in the browser | Available (fallback) |

The site ships with **fictional demo data**, labelled as such everywhere, until you clear it.

## Analytics rules the report follows

- **Higher GGR is not proof of success.** Every change is labelled: *adj.* (market trend removed
  with a comparison group — an incremental estimate) or *raw* (before vs during only).
- **Comparable periods.** Before and after use the same number of days as the promo (or a set
  length), and all comparisons are per day.
- **Not final until measured.** Promos that are live or still in their after period are marked,
  and cost conclusions wait until they're complete.
- **Currencies.** Each promo keeps its own currency; totals use one display currency with the
  exchange rates in Settings. A promo without a rate is left out of money totals and flagged —
  never added unconverted.
- **Evidence-based findings.** Key findings come from fixed rules with minimum data requirements
  and show what they're based on.
- **Privacy.** Aggregate counts only, never individual players. Access control belongs in front of
  the site and the BO endpoint (SSO / VPN) — see the API doc.

Every definition is in the app under **How numbers are calculated** (footer and Key findings).

## Architecture

The data layer is separate from the UI, so the Back Office can replace manual data without
touching any page:

```
src/lib/types.ts        data model (optional blocks for players, turnover, comparison group, missions, rankings)
src/lib/normalize.ts    any input (BO JSON, CSV, Excel paste) → the model; tolerant field matching
src/lib/sources.ts      sources: manual / Google Sheet / Back Office
src/lib/fx.ts           currency conversion (one defined method)
src/lib/metrics.ts      every calculation, statuses and aggregation
src/lib/definitions.ts  plain-language definitions shown in the app
src/lib/findings.ts     rule-based key findings
src/lib/export.ts       results export (CSV)
src/lib/store.tsx       data provider: persistence, sync status, edits
src/routes/, src/components/   UI only — reads computed metrics, never raw math
```

## Stack

Vite + React 19 + TypeScript, TanStack Router (hash routes — works on any static host),
Tailwind CSS v4, Radix UI. Charts are hand-built SVG (`src/components/charts`) with hover
tooltips, light/dark themes and a colorblind-checked palette. Same design system as the
SPRIBE Partner Promo Hub.

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
