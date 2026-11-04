import worldCupBanner from "@/assets/banner-worldcup-aviator.jpg";
import bundledFeed from "./calendar-feed.json";

/**
 * Network campaigns from the SPRIBE Promo Calendar (the partner-facing
 * calendar site). They're SPRIBE-run and span many operators, so they live
 * next to the per-operator promo records rather than inside them: an
 * operator's results for a campaign are ordinary promo records that point
 * back here with `calendarId`.
 *
 * The Promo Calendar publishes its campaigns as calendar.json, generated from
 * its own data on every build. This site reads that feed two ways:
 *  - calendar-feed.json, a copy baked in at build time, so the page always
 *    has the campaigns even offline;
 *  - ./calendar.json next to this page, copied from the calendar site each
 *    time this site is published — when it's newer, it replaces the baked copy.
 * Nothing here is typed by hand any more.
 */
/** The full partner-facing Promo Calendar site. */
export const CALENDAR_SITE_URL = "https://claude.ai/artifact/3zCsmHp7DAx1HZrRmS7Mx3";
/** The Promo Toolkit: mission calculator, prize split, timeline, T&C generator. */
export const TOOLKIT_SITE_URL = "https://claude.ai/artifact/PxXQPYyC5SVRSPdp6h7gqD";

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

interface CalendarFeed {
  version: number;
  generatedAt: string;
  source: string;
  campaigns: Omit<CalendarCampaign, "banner">[];
}

/** Banners this site ships for calendar campaigns, by campaign id. */
const BANNERS: Record<string, string> = {
  "world-cup-aviator-kickoff": worldCupBanner,
};

const isStr = (v: unknown): v is string => typeof v === "string";
const isStrArr = (v: unknown): v is string[] => Array.isArray(v) && v.every(isStr);

function isCampaign(v: unknown): v is CalendarFeed["campaigns"][number] {
  if (!v || typeof v !== "object") return false;
  const c = v as Record<string, unknown>;
  return (
    [c.id, c.name, c.type, c.start, c.end, c.region, c.prizePool, c.funding, c.summary, c.qualification, c.scoring].every(isStr) &&
    isStrArr(c.countries) &&
    isStrArr(c.games) &&
    Array.isArray(c.prizes)
  );
}

function isFeed(v: unknown): v is CalendarFeed {
  if (!v || typeof v !== "object") return false;
  const f = v as Record<string, unknown>;
  return f.version === 1 && isStr(f.generatedAt) && Array.isArray(f.campaigns) && f.campaigns.length > 0 && f.campaigns.every(isCampaign);
}

/** Read in place by the calendar, reports and sample data — replaced, never reassigned. */
export const CALENDAR_CAMPAIGNS: CalendarCampaign[] = [];

/** Which copy of the calendar feed is in use. */
export const CALENDAR_FEED_INFO = { generatedAt: "", origin: "bundled" as "bundled" | "published" };

function applyFeed(feed: CalendarFeed, origin: "bundled" | "published") {
  CALENDAR_CAMPAIGNS.splice(0, CALENDAR_CAMPAIGNS.length, ...feed.campaigns.map((c) => ({ ...c, banner: BANNERS[c.id] })));
  CALENDAR_FEED_INFO.generatedAt = feed.generatedAt;
  CALENDAR_FEED_INFO.origin = origin;
}

if (isFeed(bundledFeed)) applyFeed(bundledFeed, "bundled");

/**
 * Picks up ./calendar.json if this page was published with a newer copy of
 * the calendar than the one baked in. Never throws and gives up after a
 * short wait, so the page always renders.
 */
export async function loadPublishedCalendarFeed(timeoutMs = 1500): Promise<void> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch("./calendar.json", { cache: "no-store", signal: ctrl.signal });
    if (!res.ok) return;
    const feed: unknown = await res.json();
    if (isFeed(feed) && feed.generatedAt > CALENDAR_FEED_INFO.generatedAt) applyFeed(feed, "published");
  } catch {
    // Not published alongside, blocked, or slow — the baked copy stays.
  } finally {
    clearTimeout(timer);
  }
}

export function campaignById(id: string | undefined): CalendarCampaign | undefined {
  return id ? CALENDAR_CAMPAIGNS.find((c) => c.id === id) : undefined;
}
