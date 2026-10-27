/**
 * Tuning for the automatic promo insights. Every threshold the rules use lives
 * here — nothing is hard-coded in the rules themselves.
 *
 * These are working defaults chosen so the insights stay quiet about noise.
 * They are NOT official SPRIBE business thresholds; change them when the team
 * agrees on its own.
 */
export interface InsightConfig {
  /**
   * Smallest change (fraction, 0.03 = 3%) treated as a real movement. Smaller
   * changes are described as "about flat" and never coloured good or bad.
   */
  meaningfulChangeThreshold: number;
  /**
   * How close (fraction) the after window must be to the before window to count
   * as "back to baseline", e.g. 0.03 = within ±3%.
   */
  baselineTolerance: number;
  /**
   * Gap between promo change and market change, in percentage points, below
   * which the promo is said to have moved "in line with the market".
   */
  marketComparisonTolerancePp: number;
  /**
   * Market periods may start/end this many days away from the promo's windows
   * and still be compared (0 = dates must match exactly).
   */
  marketPeriodToleranceDays: number;
  /** Below this many active players (or participants) in a window, the numbers are flagged as a small sample. */
  minimumSampleSize: number;
  /**
   * A game is an outlier when its change differs from the next game's by at
   * least this many percentage points.
   */
  outlierThresholdPp: number;
  /**
   * Participants are "disproportionate" when their share of wager / bets / GGR
   * is at least this many times their share of players (or at most 1 / this).
   */
  disproportionRatio: number;
  /** Participation-rate change vs a comparable earlier promo, in percentage points, worth calling out as better/worse. */
  participationChangeThresholdPp: number;
  /** How many insights to show before "View all insights". */
  maxInsights: number;
}

export const DEFAULT_INSIGHT_CONFIG: InsightConfig = {
  meaningfulChangeThreshold: 0.03,
  baselineTolerance: 0.03,
  marketComparisonTolerancePp: 2,
  marketPeriodToleranceDays: 0,
  minimumSampleSize: 100,
  outlierThresholdPp: 15,
  disproportionRatio: 1.5,
  participationChangeThresholdPp: 1,
  maxInsights: 6,
};
