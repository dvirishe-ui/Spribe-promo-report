/**
 * The data model for the promo report.
 *
 * Every number the site shows is derived from these two record types, whether
 * they were typed in by hand, imported from a CSV/Excel paste, or pulled from
 * the backoffice API. See `src/lib/normalize.ts` for how raw input is coerced
 * into this shape and `docs/BACKOFFICE_API.md` for the wire contract.
 */

export interface DailyPoint {
  /** YYYY-MM-DD */
  date: string;
  ggr: number;
}

export interface MissionStep {
  name: string;
  /** Participants who reached / completed this step */
  reached: number;
}

/**
 * One day of a daily-missions promo (aggregate). Lets the report show
 * completion per day, completion time and where players dropped off.
 */
export interface MissionDay {
  /** 1-based day of the promo */
  day: number;
  game: string;
  /** What players had to do, as shown to them */
  requirement: string;
  /** Participants who had this day's mission open (started it) */
  started: number;
  /** Participants who completed it */
  completed: number;
  /** Median minutes from starting to completing the mission, if tracked */
  medianMinutes?: number | null;
}

/**
 * Per-game numbers for multi-game promos. GGR during is the minimum; the
 * before-window and activity figures are optional and, when present, let the
 * insights compare games with each other (same windows as the promo).
 */
export interface GameShare {
  game: string;
  ggrDuring: number;
  ggrBefore?: number | null;
  wagerBefore?: number | null;
  wagerDuring?: number | null;
  betsBefore?: number | null;
  betsDuring?: number | null;
  playersBefore?: number | null;
  playersDuring?: number | null;
}

export interface RankBand {
  /** e.g. "1st", "2nd–3rd", "4th–10th" */
  band: string;
  winners: number;
  /** Total prize paid to this band, in the promo's currency */
  prize: number;
}

export interface PromoRecord {
  id: string;
  name: string;
  /** One of the Promo Calendar types (Network Tournament, Missions, …); free text is allowed too */
  type: string;
  operator: string;
  /** Aggregator / platform the operator gets SPRIBE games through; "Direct" when integrated directly */
  aggregator: string;
  games: string[];
  market: string;
  /** ISO 4217 code the GGR numbers of this promo are in (usually the operator's currency) */
  currency: string;
  /** YYYY-MM-DD, inclusive */
  startDate: string;
  /** YYYY-MM-DD, inclusive */
  endDate: string;
  /**
   * Length in days of the "before" and "after" comparison windows. Leave empty
   * to use the promo's own length (the usual choice: 7-day promo → 7 days
   * before vs 7 days during vs 7 days after).
   */
  windowDays: number | null;

  /** GGR in the window before the promo started */
  ggrBefore: number | null;
  /** GGR while the promo was live */
  ggrDuring: number | null;
  /** GGR in the window after the promo ended */
  ggrAfter: number | null;

  /** Promo contribution: prize fund / rewards paid for the promo. Used for net impact and Promo ROI (x) */
  prizePool: number | null;

  /** Optional unique active players per window (everyone playing, not only promo participants) */
  playersBefore: number | null;
  playersDuring: number | null;
  playersAfter: number | null;

  /*
   * Everything below is optional. The report only shows a section (and a tab)
   * when its numbers are present. All player figures are aggregate counts —
   * the report never stores or shows individual players.
   */

  /** Players who could take part (eligible audience) */
  eligiblePlayers?: number | null;
  /** Unique players who took part in the promo (opted in / qualified) */
  participants?: number | null;
  /** Participants who had not played these games before */
  newParticipants?: number | null;
  /** Participants who played again in the after window */
  retainedParticipants?: number | null;
  /** Bets placed by participants during the promo (engagement) */
  betsDuring?: number | null;
  /** Amount wagered by participants during the promo — their share of total wager */
  participantWagerDuring?: number | null;
  /** GGR from participants during the promo — their share of total GGR */
  participantGgrDuring?: number | null;

  /** Number of bets placed (all players) in the before / during / after windows — gives Avg Bet with turnover */
  totalBetsBefore?: number | null;
  totalBetsDuring?: number | null;
  totalBetsAfter?: number | null;

  /** Amount wagered (turnover) in the same before / during / after windows. turnoverDuring = "Total Wager" */
  turnoverBefore?: number | null;
  turnoverDuring?: number | null;
  turnoverAfter?: number | null;

  /**
   * GGR of a comparison group over the same before / during windows — e.g. the
   * same games at comparable operators without the promo. Used to remove the
   * market trend so the change can be called incremental.
   */
  controlGgrBefore?: number | null;
  controlGgrDuring?: number | null;
  /** What the comparison group is, in words */
  controlLabel?: string;

  /** Mission promos: how many participants reached each step, in order */
  missions?: MissionStep[];
  /** Daily-missions promos: one entry per day */
  missionDays?: MissionDay[];
  /** GGR during the promo split by game */
  gameGgr?: GameShare[];
  /** Leaderboard / tournament promos: winners and prizes per rank band */
  leaderboard?: RankBand[];

  /**
   * Rates as reported by the Back Office (fractions, 0.965 = 96.5%). Only used
   * when the site can't calculate them itself: RTP needs total wager and GGR
   * during; participation rate needs participants and active players.
   */
  reportedRtp?: number | null;
  reportedParticipationRate?: number | null;

  /** Id of the Promo Calendar network campaign this promo belongs to (e.g. "spribe-adventure-2026") */
  calendarId?: string;

  /** Set by the report when no exchange rate exists for this promo's currency (never stored) */
  fxMissing?: boolean;

  notes: string;
  /**
   * Optional daily GGR series covering the before → after span. When the
   * backoffice sends it, the report page draws a daily timeline and any
   * missing window totals are computed from it.
   */
  daily?: DailyPoint[];
}

/** Market metrics a trend source can report. "activity" is an index (e.g. search demand), not money. */
export type MarketMetricKey = "ggr" | "wager" | "bets" | "players" | "activity";

/**
 * How a market moved over a promo's dates — the context for "did the promo
 * beat the market?". Each value is the change of the market over `from`–`to`
 * against `baselineFrom`–`baselineTo` (per day when the periods differ in
 * length), as a fraction: 0.084 = +8.4%. Only metrics the provider actually
 * reports are filled in.
 */
export interface MarketTrend {
  id: string;
  /** Same market names as promos use (e.g. "Brazil") */
  market: string;
  /** YYYY-MM-DD, inclusive — should be the promo's during window */
  from: string;
  to: string;
  /** YYYY-MM-DD, inclusive — should be the promo's before window */
  baselineFrom: string;
  baselineTo: string;
  changes: Partial<Record<MarketMetricKey, number>>;
  /** Who measured it, e.g. "Blask" */
  provider: string;
  /** What the activity figure is, in the provider's words, e.g. "Blask Index (search demand)" */
  activityLabel?: string;
  /**
   * How the numbers reached the report. "manual" = typed in on this site,
   * "api" = delivered by the data source (Back Office), "sample" = fictional demo.
   * Manual numbers are never presented as automatically retrieved.
   */
  origin: "manual" | "api" | "sample";
  /** ISO timestamp the entry was made / delivered */
  enteredAt?: string;
  note?: string;
}

export interface MonthlyRecord {
  /** YYYY-MM */
  month: string;
  /** Total GGR for the month (the scope you report on: all operators, a region, …) */
  ggr: number | null;
  notes: string;
}

export interface Dataset {
  promos: PromoRecord[];
  monthly: MonthlyRecord[];
  /** ISO 4217 code the whole report is shown in, e.g. EUR */
  currency: string;
  /** Value of 1 unit of each currency in EUR — overrides the built-in example rates */
  fxRates?: Record<string, number>;
  /** Market trends delivered with the data (e.g. Blask figures the Back Office fetched) */
  marketTrends?: MarketTrend[];
  /** true while the built-in sample numbers are loaded */
  isSample?: boolean;
  /** When the source produced this data (API / CSV), ISO timestamp */
  generatedAt?: string;
  /** Last manual edit, ISO timestamp */
  updatedAt?: string;
  /**
   * Time zone the dates are reported in. Promo dates are calendar days in this
   * zone; the Back Office should cut daily numbers on the same boundaries.
   */
  timeZone?: string;
}

/** The promotion types used in the SPRIBE Promo Calendar. */
export const PROMO_TYPES = [
  "Network Tournament",
  "Cross-Game Challenge",
  "Missions",
  "Leaderboard",
  "Collection Campaign",
  "Regional Promotion",
  "Seasonal Promotion",
  "New Game Launch",
] as const;

export const SPRIBE_GAMES = [
  "Aviator",
  "Mines",
  "Plinko",
  "Goal",
  "Dice",
  "Hilo",
  "Keno",
  "Mini Roulette",
  "Hotline",
  "Balloon",
  "Trader",
  "Pilot Chicken",
] as const;
