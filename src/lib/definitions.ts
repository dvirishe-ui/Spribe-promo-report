/**
 * Plain-language definitions of every number the report shows. The UI's
 * "How numbers are calculated" panel reads from here, and the formulas match
 * src/lib/metrics.ts — change both together.
 */

export interface Definition {
  term: string;
  meaning: string;
}

export const REPORTING_PERIODS: Definition[] = [
  {
    term: "Before / during / after",
    meaning:
      "During is the promo's own dates. Before is the same number of days right before it starts, after is the same number of days right after it ends (unless a different comparison length is set on the promo).",
  },
  {
    term: "Per day",
    meaning:
      "Every comparison uses GGR per day, so periods of different lengths compare fairly. With equal periods this is the same as comparing totals.",
  },
  {
    term: "Which month a promo belongs to",
    meaning: "The month it started in.",
  },
  {
    term: "Status",
    meaning:
      "Upcoming → Live → Measuring (ended, but the after period is still running) → Completed. Results are final only when a promo is Completed.",
  },
];

export const METRICS: Definition[] = [
  {
    term: "GGR change",
    meaning:
      "GGR per day during the promo compared with before. When the promo has a comparison group, the comparison group's change over the same days (the market trend) is removed, and the number is marked “adjusted”.",
  },
  {
    term: "Adjusted (incremental) vs not adjusted",
    meaning:
      "A higher GGR during a promo is not proof the promo caused it — the whole market may have moved. Only adjusted changes estimate what the promo itself added. Unadjusted changes are shown as before/during comparisons.",
  },
  {
    term: "Extra GGR",
    meaning:
      "GGR during the promo minus what the before run-rate would have produced over the same days (moved by the market trend when a comparison group exists).",
  },
  {
    term: "After vs before",
    meaning: "GGR per day after the promo compared with before — whether any change lasted once it ended.",
  },
  {
    term: "Unique participants",
    meaning: "Players who took part in the promo, counted once. Summed across promos, so a player in two promos counts twice.",
  },
  {
    term: "Promo cost",
    meaning: "Rewards paid out (prize pool, free bets, cashback).",
  },
  {
    term: "Net impact and ROI",
    meaning: "Net impact = extra GGR during + extra GGR after − promo cost. ROI = net impact ÷ promo cost.",
  },
  {
    term: "Totals across promos",
    meaning:
      "Changes are weighted by each promo's before GGR (Σ during ÷ Σ before), not an average of percentages, so a small promo can't swing the headline.",
  },
  {
    term: "Currencies",
    meaning:
      "Each promo keeps its own currency. For totals everything is converted to the display currency with the exchange rates in Settings. A promo without a rate is left out of money totals and marked.",
  },
  {
    term: "Retention",
    meaning: "Participants who played again in the after period ÷ participants.",
  },
  {
    term: "Observed vs estimated",
    meaning:
      "Observed = what the numbers show (GGR before vs during). Estimated = an adjusted figure that removes the market trend using a comparison group. Possible explanations on investigations are hypotheses, never proven causes.",
  },
  {
    term: "Time zone",
    meaning: "Promo dates are calendar days in the reporting time zone (UTC unless the data source says otherwise); daily numbers must be cut on the same boundaries.",
  },
  {
    term: "Sample size (n)",
    meaning: "How many promos a benchmark or ranking is based on. With fewer than five, treat comparisons as indicative.",
  },
  {
    term: "Mission completion",
    meaning:
      "Players who reached the last step ÷ players at the first step. The hardest step is the one that loses the biggest share of the players who reached the step before it.",
  },
];

export const RESPONSIBLE_GAMING =
  "More play is not automatically a success. When engagement (bets per participant) is far above normal, the report flags it as something to check with the operator's responsible-gaming team, not as a win. Recommendations never suggest targeting individual or at-risk players.";

export const KEY_FINDINGS_RULES =
  "Key findings are worked out from the numbers on this page with fixed rules (no AI). Each one says what it is based on, and a finding only appears when enough promos have the data behind it.";
