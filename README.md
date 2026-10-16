# SPRIBE Promo Performance Report

An internal dashboard that answers **"did the promo move GGR?"** — for every promotion and
across all of them — and is built to switch from hand-typed numbers to the backoffice
without changing anything else.

## What it shows

One platform, three depths — see [`docs/PLATFORM_PLAN.md`](docs/PLATFORM_PLAN.md) for the full plan,
what changed and what still depends on Back Office data.

| Section | For | What's there |
| --- | --- | --- |
| **Overview** (`/`) | CEO, everyone | How the period's promos went in one sentence; four numbers (promotions, GGR vs baseline, players who took part, reward cost); **What you need to know** (top 3 insights with metric, threshold, evidence link and next step); GGR trend; top and bottom; market/operator breakdown; recent promotions. Month, custom dates or all time; collapsible filters. |
| **Promotions** (`/promotions`) | Everyone | Every promo in the period, before/during/after chart, outcome counts, grouping, sorting, CSV. |
| **Promo report** (`/promo/:id`) | Everyone → EM | Result first (outcome in words, big numbers, GGR per day, next steps), key findings, then tabs: Overview · Players (eligible → took part → completed → came back) · Missions (completion by day → click a day → evidence, possible explanations, next step) or Rankings · Financials (turnover, margin, cost, history vs same type). Partner view, engagement report, CSV, print. Deep links: `?tab=missions&day=6`. |
| **Operators** (`/operators`) | AM | Operator list; profiles with history, types used, strongest/weakest, benchmarks with sample sizes, upcoming promos, open follow-ups; **Prepare for operator meeting** (internal or shareable brief, copy/download); partner-safe operator report. |
| **Insights** (`/insights`) | EM | All insights; Compare (2–4 promos, with comparability warnings); Winners & losers (rank by growth, participation, completion, retention or cost efficiency); Mission analysis (low completion, drop-offs, unusually quick, time distribution, by game/market); Library (search by game, market, operator, type, length, mechanic, result; reuse a setup). |
| **Calendar** (`/calendar`) | Everyone | The Promo Calendar's network campaigns plus every operator promo, in Month / Week / List views coloured by promo type. Past entries show their result; clicking one opens how it went (per operator for campaigns), similar previous promos with the typical result for that mechanic, and the campaign setup. Same-operator overlaps are marked, not flagged as problems. |
| Secondary menu | Admin | **Data** (source, freshness, BO status, completeness, duplicates, manual entry, import/export, settings), **How numbers are calculated**, **View as** (operator access preview). **Actions** button: follow-ups with owner, status, due date, linked promo and notes. |

The site ships with **fictional demo data**, labelled everywhere, until you clear it.

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
src/lib/insights.ts     insight & alert rules (metric, threshold, evidence link, next step)
src/lib/explain.ts      mission-day investigation: possible explanations with their evidence
src/lib/verdict.ts      plain-language outcome per promo
src/lib/operators.ts    operator summaries and benchmarks (with sample sizes)
src/lib/reports.ts      executive summary, operator brief (internal / shareable), engagement report
src/lib/quality.ts      duplicate detection, freshness
src/lib/actions.tsx     follow-up action tracker (browser storage)
src/lib/view.tsx        shared filters and period across pages
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
