# SPRIBE Promo Intelligence — platform plan

> Simple enough for a CEO to understand in 30 seconds, powerful enough for an
> Engagement Manager to investigate for 30 minutes.

One experience, three depths: **Overview** (level 1) → **Promotions / Insights /
Calendar** (level 2) → **promo report tabs, investigations, tables and
exports** (level 3). No separate dashboards per role.

## Analysis of the site before this upgrade

| | |
| --- | --- |
| **Kept** | SPRIBE design system and orange accent; light/dark; before/during/after method on per-day GGR; adjusted vs raw labelling; plain-language outcomes (`verdict.ts`); filters (market, aggregator, operator, type, game); promo report tabs; partner view; the data layer (manual entry, CSV/Excel import, Back Office contract, currency conversion, demo-data labelling). |
| **Changed** | Navigation → Overview · Promotions · Insights · Calendar, with Data/BO/definitions/access in a secondary menu. The homepage became a 30-second Overview; the full list, grouping and before/during/after chart moved to Promotions. Key findings became an insight system (metric, threshold, evidence link, next step). Filters and period are shared across pages, with a date-range option. Status "Complete" → "Completed". |
| **Added** | Insights (all insights, compare with comparability flags, winners & losers by chosen metric, mission analysis, searchable library with "reuse setup"); calendar with same-operator overlap markers; action tracker; one-click mission investigation; executive and engagement exports; data completeness, duplicate detection and time-zone notes; operator-scoped "view as" access preview; responsible-gaming rule. |
| **Removed** | The Operators section (operator profiles, meeting brief, shareable operator report) — removed on request; an operator's promos are one filter away in Promotions. Nothing else that worked. The homepage no longer carries the full list, the grouped chart or the market-results card at full size — they live one click away. |

## What depends on data not available yet

Built and demonstrated with **fictional demo data**; real numbers need the Back Office:

| Feature | Needs from the BO |
| --- | --- |
| Players tab: eligible, participation, new vs returning, retention | `eligiblePlayers`, `participants`, `newParticipants`, `retainedParticipants`, `playersBefore/During/After` |
| Missions: completion by day, completion time, drop-off, investigation | `missionDays[]` (day, game, requirement, started, completed, medianMinutes) and/or `missions[]` steps |
| Game contribution | `gameGgr[]` |
| Rankings tab | `leaderboard[]` rank bands |
| Financials: turnover, margin | `turnoverBefore/During/After` |
| Incremental ("adjusted") results | `controlGgrBefore/During` for a comparison group — **the most important gap**: without it every result stays a before/during comparison |
| Live monitoring, automated alerts | A scheduled feed (the site already refetches on load / every 15–60 min) |
| Permission-based access | BO/SSO identity with the operators a user may see; the site's "view as" is only a preview |
| Shared action tracker | A small backend; actions live in the browser today |

Availability of each field must be verified with the BO team before relying on it.

## Phases

**Phase 1 — core (done):** Overview, executive insights, improved promo reports,
navigation and shared filters, BO-ready data model.

**Phase 2 — advanced analytics (done, on demo data):** comparison with comparability
flags, mission funnels and day-by-day drop-off, mission analysis, historical library.

**Phase 3 — intelligence & automation (partly done):** rule-based insights & alerts,
evidence-based next steps, lightweight action tracker, report exports. **Waiting on
access:** BO integration, live monitoring, server-side permissions, shared actions,
PDF generation beyond print-to-PDF.

## Responsible analytics rules (enforced in code)

- Missing data is shown as missing (`quality.missing`), never estimated.
- GGR changes are "raw" (observed) unless a comparison group makes them "adj." (estimated
  incremental). Outcomes only say "it worked" for adjusted results (`verdict.ts`).
- Comparisons are per day over equal-length windows; aggregates are baseline-weighted.
- Currencies are converted with one defined method; promos without a rate are excluded and flagged.
- Insights need minimum sample sizes and state their threshold; benchmarks and rankings show n.
- Possible explanations in investigations are labelled hypotheses, never causes.
- Aggregate player data only; engagement far above normal is flagged as a responsible-gaming check.
- The partner view of a promo contains only that promo's own data.
