import { describe, expect, it } from "vitest";
import { computePromo } from "../metrics";
import type { MarketTrend, PromoRecord } from "../types";
import { buildPromoInsights } from "./index";

/*
 * Scenarios for the insight engine. Promos are dated in 2025 so they are
 * complete; before/after windows default to the promo's own length (7 days):
 * before 2025-03-03…09, during 10…16, after 17…23.
 */

function promo(over: Partial<PromoRecord> = {}): PromoRecord {
  return {
    id: "p1",
    name: "Test promo",
    type: "Missions",
    operator: "Operator A",
    aggregator: "Direct",
    games: ["Aviator"],
    market: "Brazil",
    currency: "EUR",
    startDate: "2025-03-10",
    endDate: "2025-03-16",
    windowDays: null,
    ggrBefore: 100_000,
    ggrDuring: 100_000,
    ggrAfter: 100_000,
    prizePool: 5_000,
    playersBefore: null,
    playersDuring: null,
    playersAfter: null,
    notes: "",
    ...over,
  };
}

function trend(changes: MarketTrend["changes"], over: Partial<MarketTrend> = {}): MarketTrend {
  return {
    id: "t1",
    market: "Brazil",
    from: "2025-03-10",
    to: "2025-03-16",
    baselineFrom: "2025-03-03",
    baselineTo: "2025-03-09",
    changes,
    provider: "Blask",
    origin: "manual",
    ...over,
  };
}

const run = (p: PromoRecord, trends: MarketTrend[] = []) => buildPromoInsights(computePromo(p), { currency: "EUR", marketTrends: trends });
const byId = (r: ReturnType<typeof run>, prefix: string) => r.insights.find((i) => i.id.startsWith(prefix));

describe("relative performance vs the market", () => {
  it("TEST 1 — promo +20%, market +5%: positive, +15 pp", () => {
    const r = run(promo({ ggrDuring: 120_000 }), [trend({ ggr: 0.05 })]);
    const i = byId(r, "market-ggr")!;
    expect(i.severity).toBe("positive");
    expect(i.facts.relativePp).toBeCloseTo(15, 5);
    expect(i.message).toContain("+15.0 pp");
    expect(i.source).toContain("Blask (entered manually)");
  });

  it("TEST 2 — promo −10%, market −20%: absolute decline but +10 pp relative (mixed)", () => {
    const r = run(promo({ ggrDuring: 90_000 }), [trend({ ggr: -0.2 })]);
    const i = byId(r, "market-ggr")!;
    expect(i.severity).toBe("mixed");
    expect(i.title).toBe("Declined, but less than the market");
    expect(i.facts.relativePp).toBeCloseTo(10, 5);
    expect(i.message).toMatch(/declined 10\.0%/);
    expect(i.message).toContain("+10.0 pp");
  });

  it("TEST 3 — promo −10%, market +10%: negative, 20 pp underperformance", () => {
    const r = run(promo({ ggrDuring: 90_000 }), [trend({ ggr: 0.1 })]);
    const i = byId(r, "market-ggr")!;
    expect(i.severity).toBe("negative");
    expect(i.title).toBe("Declined despite market growth");
    expect(i.facts.relativePp).toBeCloseTo(-20, 5);
    expect(i.message).toContain("20.0 percentage-point relative underperformance");
  });

  it("promo +8%, market +15%: mixed (grew, but slower than the market)", () => {
    const i = byId(run(promo({ ggrDuring: 108_000 }), [trend({ ggr: 0.15 })]), "market-ggr")!;
    expect(i.severity).toBe("mixed");
    expect(i.facts.relativePp).toBeCloseTo(-7, 5);
  });

  it("small decline in a falling market is not red", () => {
    const i = byId(run(promo({ ggrDuring: 98_000 }), [trend({ ggr: -0.2 })]), "market-ggr")!;
    expect(i.severity).toBe("positive");
    expect(i.title).toBe("Held steady while the market fell");
  });
});

describe("cross-metric rules", () => {
  it("TEST 4 — bets +20%, wager −10%: more bets, smaller stakes, with the actual average bet", () => {
    const r = run(promo({ turnoverBefore: 2_500_000, turnoverDuring: 2_250_000, totalBetsBefore: 1_000_000, totalBetsDuring: 1_200_000 }));
    const i = byId(r, "cross-bets-wager")!;
    expect(i.severity).toBe("mixed");
    expect(i.title).toBe("More bets, smaller stakes");
    // €2.50 → €1.875: −25%
    expect(i.facts.averageBetChange).toBeCloseTo(-25, 5);
    expect(i.message).toContain("€2.50");
    expect(i.message).toContain("€1.88");
    expect(i.message).not.toMatch(/suggest/i);
  });

  it("TEST 5 — wager +20%, GGR −10%: hold deterioration", () => {
    const r = run(promo({ ggrDuring: 90_000, turnoverBefore: 2_000_000, turnoverDuring: 2_400_000 }));
    const i = byId(r, "cross-hold")!;
    expect(i.title).toContain("lower hold");
    expect(i.facts.holdBefore).toBeCloseTo(5, 5); // 100K ÷ 2M
    expect(i.facts.holdDuring).toBeCloseTo(3.8, 5); // 90K ÷ 2.4M = 3.75% → 3.8
    expect(i.message).toContain("5.00%");
    expect(i.message).toContain("3.75%");
  });

  it("TEST 5b — without wager data the hold rule stays silent", () => {
    expect(byId(run(promo({ ggrDuring: 90_000 })), "cross-hold")).toBeUndefined();
  });

  it("TEST 6 — players +20%, bets +5%: bets per player decline", () => {
    const r = run(promo({ playersBefore: 10_000, playersDuring: 12_000, totalBetsBefore: 1_000_000, totalBetsDuring: 1_050_000 }));
    const i = byId(r, "cross-players-frequency")!;
    expect(i.title).toBe("More players, less betting per player");
    expect(i.severity).toBe("mixed");
    // 100 → 87.5 bets per player: −12.5%
    expect(i.facts.betsPerPlayerChange).toBeCloseTo(-12.5, 5);
  });
});

describe("normalization", () => {
  it("TEST 7 — 7-day before vs 2-day promo is compared per day, not on raw totals", () => {
    const p = promo({
      startDate: "2025-03-10",
      endDate: "2025-03-11",
      windowDays: 7,
      ggrBefore: 700_000,
      ggrDuring: 250_000,
      ggrAfter: 700_000,
      turnoverBefore: 7_000_000,
      turnoverDuring: 2_500_000,
    });
    const r = run(p);
    const g = r.facts.metrics.ggr;
    expect(g.normalized).toBe(true);
    expect(g.before.value).toBe(100_000);
    expect(g.during.value).toBe(125_000);
    expect(g.duringVsBefore).toBeCloseTo(0.25, 10);
    const i = byId(r, "move-ggr")!;
    expect(i.title).toBe("GGR per day up 25.0%");
    expect(i.calc[0].rows[0].value).toContain("÷ 7 days");
    expect(r.quality.some((q) => q.id === "unequal")).toBe(true);
    // Unique players are never compared across windows of different length.
    expect(r.facts.metrics.players.unavailable).toBeTruthy();
  });
});

describe("market data honesty", () => {
  it("TEST 8 — no market data: no market insight, and the gap is stated", () => {
    const r = run(promo({ ggrDuring: 120_000 }));
    expect(r.insights.some((i) => i.type === "market_relative")).toBe(false);
    expect(r.quality.some((q) => q.id === "market-missing")).toBe(true);
    expect(byId(r, "move-ggr")!.interpretation).toMatch(/can't be separated from the market trend/);
  });

  it("market data for slightly different dates is not used, and says why", () => {
    const r = run(promo({ ggrDuring: 120_000 }), [trend({ ggr: 0.05 }, { from: "2025-03-12", to: "2025-03-18", baselineFrom: "2025-03-05", baselineTo: "2025-03-11" })]);
    expect(r.insights.some((i) => i.type === "market_relative")).toBe(false);
    expect(r.quality.find((q) => q.id === "market-mismatch")!.text).toMatch(/Market comparison unavailable/);
  });

  it("market data within the configured tolerance is used, with a note", () => {
    const m = computePromo(promo({ ggrDuring: 120_000 }));
    const r = buildPromoInsights(m, { currency: "EUR", marketTrends: [trend({ ggr: 0.05 }, { to: "2025-03-17" })], config: { marketPeriodToleranceDays: 1 } });
    expect(r.market.sources[0].dateNote).toMatch(/within 1 day/);
    expect(r.insights.some((i) => i.type === "market_relative")).toBe(true);
  });

  it("market data for unrelated dates is ignored", () => {
    const r = run(promo(), [trend({ ggr: 0.05 }, { from: "2025-08-01", to: "2025-08-07", baselineFrom: "2025-07-25", baselineTo: "2025-07-31" })]);
    expect(r.quality.some((q) => q.id === "market-missing")).toBe(true);
  });

  it("TEST 9 — activity index is never presented as market GGR", () => {
    const r = run(promo({ ggrDuring: 90_000 }), [trend({ activity: 0.08 }, { activityLabel: "Blask Index (search demand)" })]);
    const i = byId(r, "market-ggr")!;
    expect(i.confidence).toBe("indicative");
    expect(i.message).toContain("broader market activity in Brazil (Blask Index (search demand))");
    expect(i.source).toContain("Blask (entered manually)");
    expect(i.message).not.toMatch(/market's GGR|market GGR/i);
    expect(i.interpretation).toMatch(/not GGR/);
  });

  it("manually entered data is labelled as manual", () => {
    expect(run(promo(), [trend({ ggr: 0 })]).market.sources[0].origin).toBe("entered manually");
  });
});

describe("data quality", () => {
  it("TEST 10 — insufficient data: warnings instead of invented conclusions", () => {
    const r = run(promo({ ggrBefore: null, ggrDuring: 50_000, ggrAfter: null }));
    expect(r.insights.filter((i) => i.type !== "participation")).toHaveLength(0);
    expect(r.quality.some((q) => q.id === "ggr-before")).toBe(true);
    expect(r.quality.some((q) => q.id === "missing")).toBe(true);
  });

  it("zero baseline: no division by zero", () => {
    const r = run(promo({ ggrBefore: 0, ggrDuring: 50_000 }));
    expect(r.facts.metrics.ggr.duringVsBefore).toBeNull();
    expect(r.quality.some((q) => q.id === "ggr-before-zero")).toBe(true);
  });

  it("small samples are flagged", () => {
    const r = run(promo({ playersBefore: 40, playersDuring: 50, participants: 12 }));
    expect(r.quality.find((q) => q.id === "small")!.text).toContain("50 active players");
  });
});

describe("before / during / after pattern", () => {
  it("temporary uplift returns to baseline", () => {
    const i = byId(run(promo({ ggrDuring: 120_000, ggrAfter: 101_000 })), "pattern-ggr")!;
    expect(i.title).toBe("Temporary uplift");
  });
  it("persisting uplift is described without claiming causation", () => {
    const i = byId(run(promo({ ggrDuring: 120_000, ggrAfter: 110_000 })), "pattern-ggr")!;
    expect(i.title).toBe("Uplift persisted after the promo");
    expect(`${i.message} ${i.interpretation}`).not.toMatch(/created lasting retention/);
  });
  it("decline during, recovery after", () => {
    expect(byId(run(promo({ ggrDuring: 85_000, ggrAfter: 100_000 })), "pattern-ggr")!.title).toBe("Declined during, recovered after");
  });
});

describe("participation", () => {
  it("states the rate without calling it high or low when there is no benchmark", () => {
    const i = byId(run(promo({ participants: 1_300, playersBefore: 9_000, playersDuring: 10_000 })), "participation")!;
    expect(i.message).toContain("1,300 of 10,000 active players took part — a 13.0% participation rate");
    expect(`${i.title} ${i.message}`).not.toMatch(/\b(high|low)\b/i);
  });

  it("compares with the previous comparable promo in percentage points", () => {
    const prev = computePromo(promo({ id: "p0", startDate: "2025-01-10", endDate: "2025-01-16", participants: 850, playersDuring: 10_000 }));
    const m = computePromo(promo({ participants: 1_300, playersDuring: 10_000 }));
    const r = buildPromoInsights(m, { currency: "EUR", peers: [prev, m] });
    const i = byId(r, "participation")!;
    expect(i.facts.changePp).toBeCloseTo(4.5, 5);
    expect(i.message).toContain("+4.5 pp");
    expect(i.severity).toBe("positive");
  });

  it("participants' share of wager vs share of players", () => {
    const i = byId(run(promo({ participants: 1_200, playersDuring: 10_000, turnoverBefore: 1_000_000, turnoverDuring: 1_000_000, participantWagerDuring: 240_000 })), "contribution")!;
    expect(i.message).toContain("12.0% of active players but generated 24.0% of wager");
    expect(i.interpretation).toMatch(/disproportionately more/);
  });
});

describe("games", () => {
  it("names the strongest and weakest game when they diverge", () => {
    const r = run(
      promo({
        games: ["Mines", "Goal"],
        gameGgr: [
          { game: "Mines", ggrDuring: 50_000, wagerBefore: 1_000_000, wagerDuring: 1_320_000 },
          { game: "Goal", ggrDuring: 20_000, wagerBefore: 1_000_000, wagerDuring: 890_000 },
        ],
      }),
    );
    const i = byId(r, "games-wager")!;
    expect(i.message).toContain("Mines recorded the strongest wager growth during the promotion at +32.0%, while Goal declined 11.0%");
  });
});

describe("ranking", () => {
  it("keeps the top list short and market-relative first", () => {
    const r = run(
      promo({
        ggrDuring: 90_000,
        ggrAfter: 95_000,
        turnoverBefore: 2_000_000,
        turnoverDuring: 2_400_000,
        totalBetsBefore: 800_000,
        totalBetsDuring: 1_100_000,
        playersBefore: 10_000,
        playersDuring: 12_000,
        playersAfter: 9_000,
        participants: 2_000,
      }),
      [trend({ ggr: 0.1 })],
    );
    expect(r.top.length).toBeLessThanOrEqual(6);
    expect(r.top[0].type).toBe("market_relative");
    expect(r.summary.length).toBeGreaterThanOrEqual(3);
    expect(r.summary.length).toBeLessThanOrEqual(5);
  });
});
