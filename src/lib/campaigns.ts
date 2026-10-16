import worldCupBanner from "@/assets/banner-worldcup-aviator.jpg";

/**
 * Network campaigns from the SPRIBE Promo Calendar (the partner-facing
 * calendar site). They're SPRIBE-run and span many operators, so they live
 * next to the per-operator promo records rather than inside them: an
 * operator's results for a campaign are ordinary promo records that point
 * back here with `calendarId`.
 *
 * Copied from the calendar's data (src/lib/promos.ts in spribe-calender).
 * When both sites read from the Back Office, this list comes from the same
 * feed instead of being duplicated.
 */
/** The full partner-facing Promo Calendar site. */
export const CALENDAR_SITE_URL = "https://claude.ai/artifact/3zCsmHp7DAx1HZrRmS7Mx3";

export interface CalendarCampaign {
  id: string;
  name: string;
  type: string;
  start: string;
  end: string;
  region: string;
  countries: string[];
  games: string[];
  /** As published on the calendar, e.g. "$15,000" or "TBD" */
  prizePool: string;
  funding: string;
  tagline?: string;
  summary: string;
  qualification: string;
  scoring: string;
  prizes: { place: string; prize: string }[];
  dailyMissions?: { day: number; games: string[]; tasks: string[] }[];
  /** Dates locked to an external event; game, prizes and operators still TBD */
  eventLinked?: boolean;
  banner?: string;
}

export const CALENDAR_CAMPAIGNS: CalendarCampaign[] = [
  {
    id: "world-cup-aviator-kickoff",
    name: "Aviator World Cup Kickoff",
    type: "Seasonal Promotion",
    start: "2026-06-15",
    end: "2026-06-28",
    region: "LATAM",
    countries: ["Mexico", "Brazil", "Argentina", "Colombia"],
    games: ["Aviator"],
    prizePool: "$6,000",
    funding: "Shared funding",
    summary:
      "Kickoff-week activation timed to the FIFA World Cup, rewarding Aviator players across LATAM with a dedicated prize pool during the tournament's opening matches.",
    qualification: "All real-money Aviator rounds placed during the promotion window qualify automatically.",
    scoring: "Highest single-round multiplier achieved during the window.",
    prizes: [
      { place: "1st", prize: "$2,000" },
      { place: "2nd – 5th", prize: "$500 each" },
      { place: "6th – 50th", prize: "$80 each" },
    ],
    banner: worldCupBanner,
  },
  {
    id: "spribe-adventure-2026",
    name: "SPRIBE Adventure",
    type: "Cross-Game Challenge",
    start: "2026-09-21",
    end: "2026-09-27",
    region: "Global",
    countries: ["Global"],
    games: ["Aviator", "Mines", "Goal", "Plinko", "Pilot Chicken", "Keno", "Trader"],
    prizePool: "$15,000",
    funding: "Shared funding",
    tagline: "One Adventure. Multiple Games. Bigger Rewards",
    summary:
      "7 days of daily cross-game challenges — Aviator is the anchor game every day, paired with 3 rotating SPRIBE titles and a progressive daily prize pool.",
    qualification: "Complete all 4 of the day's tasks across that day's featured games to qualify for that Daily Mission's reward pool.",
    scoring: "First 50 players to complete all 4 daily tasks share that day's reward pool.",
    prizes: [
      { place: "Day 1", prize: "$25 × 50 winners ($1,250)" },
      { place: "Day 2", prize: "$30 × 50 winners ($1,500)" },
      { place: "Day 3", prize: "$35 × 50 winners ($1,750)" },
      { place: "Day 4", prize: "$40 × 50 winners ($2,000)" },
      { place: "Day 5", prize: "$50 × 50 winners ($2,500)" },
      { place: "Day 6", prize: "$55 × 50 winners ($2,750)" },
      { place: "Day 7", prize: "$65 × 50 winners ($3,250)" },
    ],
    dailyMissions: [
      { day: 1, games: ["Aviator", "Pilot Chicken", "Plinko", "Mines"], tasks: ["Aviator: catch a 30x+ multiplier 10 times", "Pilot Chicken: collect 100x in total", "Plinko: place 100 individual bets", "Mines: collect 100x in total"] },
      { day: 2, games: ["Aviator", "Goal", "Keno", "Trader"], tasks: ["Aviator: catch a 30x+ multiplier 10 times", "Goal: collect 100x in total", "Keno: place 100 individual bets", "Trader: collect 100x in total"] },
      { day: 3, games: ["Aviator", "Pilot Chicken", "Mines", "Plinko"], tasks: ["Aviator: catch a 30x+ multiplier 10 times", "Pilot Chicken: place 100 individual bets", "Mines: collect 100x in total", "Plinko: place 100 individual bets"] },
      { day: 4, games: ["Aviator", "Trader", "Keno", "Goal"], tasks: ["Aviator: catch a 30x+ multiplier 10 times", "Trader: collect 100x in total", "Keno: place 100 individual bets", "Goal: collect 100x in total"] },
      { day: 5, games: ["Aviator", "Pilot Chicken", "Trader", "Mines"], tasks: ["Aviator: catch a 30x+ multiplier 10 times", "Pilot Chicken: collect 100x in total", "Trader: place 100 individual bets", "Mines: collect 100x in total"] },
      { day: 6, games: ["Aviator", "Plinko", "Keno", "Goal"], tasks: ["Tasks published in the Mission window before this Daily Mission opens"] },
      { day: 7, games: ["Aviator", "Pilot Chicken", "Plinko", "Mines"], tasks: ["Tasks published in the Mission window before this Daily Mission opens"] },
    ],
  },
  {
    id: "global-holiday-2026",
    name: "Global Holiday Tournament",
    type: "Seasonal Promotion",
    start: "2026-12-20",
    end: "2027-01-01",
    region: "Global",
    countries: ["Global"],
    games: ["Aviator"],
    prizePool: "TBD",
    funding: "TBD",
    summary:
      "The flagship Christmas / New Year cross-market network tournament, open to every eligible market — the one window kept close to full length given its scale.",
    qualification: "To be confirmed once game and prize mechanics are finalized.",
    scoring: "To be confirmed.",
    prizes: [],
    eventLinked: true,
  },
  {
    id: "ucl-final-2027",
    name: "Champions League Tournament — Final",
    type: "Network Tournament",
    start: "2027-06-01",
    end: "2027-06-05",
    region: "Europe/CIS",
    countries: ["Germany", "Poland", "Romania", "Georgia", "Kazakhstan"],
    games: ["Aviator"],
    prizePool: "TBD",
    funding: "TBD",
    summary: "Covers the UEFA Champions League Final in Madrid (5 Jun 2027) — the highest global-visibility window of the season.",
    qualification: "To be confirmed once game and prize mechanics are finalized.",
    scoring: "To be confirmed.",
    prizes: [],
    eventLinked: true,
  },
];

export function campaignById(id: string | undefined): CalendarCampaign | undefined {
  return id ? CALENDAR_CAMPAIGNS.find((c) => c.id === id) : undefined;
}
