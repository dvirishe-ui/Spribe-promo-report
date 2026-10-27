# SPRIBE Promo Performance Report

An internal dashboard that answers **"did the promo move GGR?"** — for every promotion and
across all of them — and is built to switch from hand-typed numbers to the backoffice
without changing anything else.

## What it shows

Navigation: **Overview · Explore · Calendar**, with filters as a compact bar under the page title (period, search, multi-select market / operator / aggregator / type / game; secondary filters fold into "More" on narrower screens). One platform, three depths — see [`docs/PLATFORM_PLAN.md`](docs/PLATFORM_PLAN.md) for the full plan,
what changed and what still depends on Back Office data.

| Section | For | What's there |
| --- | --- | --- |
| **Overview** (`/`) | CCO, everyone | Laid out like the team's promo sheet. **Filters**: month / dates, region, market, operator, promotion (aggregator, type, game under "More"). **Summary** row: promotions, contribution, GGR before / during / after, during vs before, after vs before, GGR vs previous month, GGR impact. **Metrics comparison**: pick metrics as chips (Total Wager, Total Win, GGR, Number of Bets, Avg Bet, Overall Active Players, RTP) and see them Before / During / After — one chart per unit; choose a promotion in the filters to see just that one. **Promotion details**: the full results table with totals. |
| **Explore** (`/explore`) | AM, EM | One page with tabs. **Promotions**: one report card per promotion in view — contribution, participants and Promo ROI on top, then a table (Total Wager, Total Win, GGR, Number of Bets, Avg Bet, Active Players, RTP — Before / During / After with the change vs before); sort, tick to compare, CSV. Works for one month or all time. **Compare**, **Rankings**, **Missions**, **Library** (reuse a setup) and **Insights**. `/promotions` and `/insights` redirect here. |
| **Promo report** (`/promo/:id`) | Everyone → EM | Opened from any list, chart or insight. Add to compare. Result first (outcome in words, big numbers, GGR per day, next steps), then **Insights** — automatic, ranked findings with the calculation behind each, market context and data checks (see [`docs/INSIGHTS.md`](docs/INSIGHTS.md)) — then tabs: Overview (every metric Before / During / After) · Players (eligible → took part → completed → came back) · Missions (completion by day → click a day → evidence, possible explanations, next step) or Rankings · Financials (turnover, margin, cost, history vs same type). Engagement report, copy summary, CSV, print. Deep links: `?tab=missions&day=6`. |
| **Compare** (any page) | Everyone | Tick promos in any list, chart or report — the selection stays while you move around. A bar at the bottom shows them as chips; **Compare** opens a drawer: caveats behind an info icon (material ones shown inline), key differences, indexed daily GGR trend lines (median first for 7+), per-day before/during/after, small bar charts for GGR change, after vs before, part. rate, wager, contribution and ROI, and an expandable table of all numbers. Same view in Explore → Compare. |
| **Calendar** (`/calendar`) | Everyone | Active, completed and upcoming promos: the Promo Calendar's network campaigns plus every operator promo, in Month / Week / List views coloured by promo type. Past entries show their result; clicking one opens how it went (per operator for campaigns), similar previous promos with the typical result for that mechanic, and the campaign setup. Same-operator overlaps are marked, not flagged as problems. |
| **Ask** (header, Ctrl/⌘ K) | Everyone | Plain-language questions about the promos — "How much GGR did X make vs Y?", "Which operator grew GGR the most?", "Total contribution in September", "How did SPRIBE Adventure do?". Compares, ranks, totals, counts and looks up any report metric by promo, operator, market, type, game, aggregator or month. Rule-based and runs in the browser (`src/lib/ask.ts`): no AI service, no API cost, never invents numbers. |
| Secondary menu | Admin | **Data** (source, freshness, BO status, completeness, duplicates, manual entry, import/export, settings), **How numbers are calculated**, **View as** (operator access preview). |

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
src/lib/insights.ts     portfolio insight & alert rules (metric, threshold, evidence link, next step)
src/lib/promo-insights/ automatic insights for one promo report — config, per-day normalization,
                        market context, rule engine, ranking, summary (docs/INSIGHTS.md)
src/lib/explain.ts      mission-day investigation: possible explanations with their evidence
src/lib/verdict.ts      plain-language outcome per promo
src/lib/reports.ts      executive summary, engagement report
src/lib/quality.ts      duplicate detection, freshness
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
npm test         # insight engine scenarios (vitest)
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
