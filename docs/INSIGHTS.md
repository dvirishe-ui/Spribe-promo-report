# Automatic promo insights

The **Insights** section of every promo report turns the report's numbers into a few ranked,
plain-language findings. It sits right under the result summary, uses the same data as the rest
of the report, and involves no AI: every number is calculated, and every insight can show the
calculation behind it ("Why? · Show calculation").

## Pipeline

```
report data (PromoMetrics)
  → facts.ts    calculated metrics + normalization (per day for flows)
  → market.ts   market context: which sources cover exactly these dates, and why not
  → rules.ts    rule engine → structured insights { type, severity, title, message,
                interpretation, facts, why, calc, source }
  → index.ts    data-quality checks, ranking, top N, automatic summary
```

Code: `src/lib/promo-insights/`. UI: `src/components/report/PromoInsights.tsx`.
Tests: `src/lib/promo-insights/engine.test.ts` (`npm test`).

An AI layer could later re-word or re-order the structured insights, but must never change the
calculated values.

## Normalization

- **Flows** (GGR, wager, number of bets) are compared **per day**: `total ÷ days in the window`.
  With equal windows (the default) that equals comparing totals; with unequal windows the
  calculation shows both the raw total and the per-day value. Raw totals of unequal windows are
  never compared.
- **Active players** are unique counts and don't add up per day, so they're only compared when
  every window has the same length.
- **Ratios** are taken within each window from window totals: average bet = wager ÷ bets,
  hold = GGR ÷ wager, bets per player = bets ÷ active players.

## Rules

| Type | What it looks for | Severity |
| --- | --- | --- |
| Market-relative | Promo change vs market change for the same metric and dates. Relative performance = promo change − market change, in **percentage points**. Wager / bets / players vs one source are combined into one insight. | Promo up & ahead → positive; down but ahead → mixed; up but behind → mixed; down & behind → negative; within the tolerance → info |
| Activity index | A provider index (e.g. Blask Index = search demand) vs operator GGR. Never called "market GGR"; marked *Indicative*. | as above |
| Cross-metric | Bets ↑ wager ↓ (avg bet proves it) and the reverse; what drove wager (bets vs stake — exact, since wager = bets × avg bet); wager ↑ GGR ↓ and the reverse (hold before → during); players vs bets per player | mixed, or positive/negative when both move together |
| Movement | GGR (and wager when no other rule covered it), with "not adjusted for the market" when no market data exists | ≥ threshold up/down; otherwise "about flat" (info) |
| Pattern | Before → during → after: temporary uplift, uplift persisted, dip below baseline, declined then recovered, stayed below; active players after vs before | wording never claims causation |
| Participation | participants ÷ active players (and ÷ eligible); vs the previous comparable promo (same operator & type, else same market & type) in pp | never called high/low without a comparison |
| Contribution | participants' share of wager / bets / GGR vs their share of players | info |
| Games | strongest vs weakest game growth; a game gaining players but losing wager per player; gaining bets but losing average stake; else the biggest GGR contributor | info / mixed |

Possible explanations are labelled as possibilities. Example: falling participation names the
mission funnel's largest drop when that data exists; otherwise it says the report can't tell why.

## Data checks

Shown with every report, never hidden. Covered: before, during or after missing; zero or negative
baseline (no division by zero); partial daily series; unequal windows; wager, bets, players or
participants not reported; small samples; promo still live or after window still running;
missing exchange rate; reported (not calculated) participation rate; market data missing, or for
dates that don't match the promo. Promo-hour differences between windows can't be detected from
the current data model.

## Configuration

`src/lib/promo-insights/config.ts`, with a comment on each setting. These are working defaults,
**not** official SPRIBE thresholds:

| Setting | Default | Controls |
| --- | --- | --- |
| `meaningfulChangeThreshold` | 3% | smallest change treated as a real movement |
| `baselineTolerance` | ±3% | "back to baseline" after the promo |
| `marketComparisonTolerancePp` | 2 pp | "in line with the market" |
| `marketPeriodToleranceDays` | 0 | how far market dates may be from the promo's windows |
| `minimumSampleSize` | 100 | small-sample warning (players, participants) |
| `outlierThresholdPp` | 15 pp | gap between best and worst game to call it out |
| `disproportionRatio` | 1.5× | participants' share of wager vs share of players |
| `participationChangeThresholdPp` | 1 pp | participation better/worse vs the previous promo |
| `maxInsights` | 6 | shown before "View all insights" |

## Market data and Blask

- No Blask integration, API key, proxy or stored Blask data existed in this project. Blask has an
  API for customers but no public endpoint, so the site doesn't call it and doesn't scrape it.
- Blask's index measures **search demand**, not GGR. Enter it as *Activity index*.
- Two ways in:
  1. **Back Office / proxy** — include `marketTrends` in the data (see `BACKOFFICE_API.md`).
     Shown as "delivered by the data source".
  2. **Manual** — Insights → Market context → Add. Saved in that browser, shown as
     "entered manually".
- The promo's own comparison group (`controlGgrBefore/During`) is also used as context, labelled
  "Comparison group".
- Demo data includes fictional market entries, labelled "Demo … — fictional".

## Adding a rule

Write a function `(ctx, covered) => PromoInsight[]` in `rules.ts`, add it to `RULES`, give it a
`why` and `calc` so it can explain itself, and add a scenario to `engine.test.ts`.
