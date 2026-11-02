import { describe, expect, it } from "vitest";
import { computeAll } from "./metrics";
import { toDisplayCurrency } from "./fx";
import { sampleDataset } from "./sampleData";
import { ask, suggestions, type Answer } from "./ask";

const ds = sampleDataset();
const all = computeAll(toDisplayCurrency(ds));
const q = (text: string, prev?: Answer) => ask(text, all, ds.monthly, "EUR", prev?.context);
const plain = (a: Answer) => a.text.join(" ").replace(/\*\*/g, "");

describe("small talk", () => {
  it("answers good morning with a greeting, not an error", () => {
    const a = q("good morning");
    expect(a.understood).toBe(true);
    expect(a.text[0]).toMatch(/^Good morning! I can answer questions about your \d+ promos\.$/);
    expect(a.followUps?.length).toBeGreaterThan(0);
  });
  it("greets and answers in one go", () => {
    const a = q("Good morning, which promo had the best Promo ROI?");
    expect(a.text[0]).toBe("Good morning!");
    expect(plain(a)).toMatch(/Highest Promo ROI/);
  });
  it("handles thanks, help and how are you", () => {
    expect(plain(q("thanks!"))).toMatch(/welcome/);
    expect(plain(q("what can you do?"))).toMatch(/answer questions about the promos/);
    expect(plain(q("hey, how are you?"))).toMatch(/ready to dig into the numbers/);
  });
});

describe("best vs worst", () => {
  it("returns two promos, both started since April", () => {
    const a = q("what was the best promo vs worst promo since April");
    expect(plain(a)).toMatch(/Best: .+Worst: /);
    expect(a.links).toHaveLength(2);
    expect(a.table?.head).toHaveLength(3);
    const ids = a.links!.map((l) => l.id);
    for (const id of ids) expect(all.find((m) => m.promo.id === id)!.month >= "2026-04").toBe(true);
    expect(ids[0]).not.toBe(ids[1]);
    expect(plain(a)).toMatch(/since April 2026/);
  });
  it("uses the asked metric", () => {
    expect(plain(q("best and worst promo by Promo ROI"))).toMatch(/by Promo ROI/);
  });
});

describe("date ranges", () => {
  it("'since April' covers April and later, not only April", () => {
    const a = q("how many promos since April");
    const n = all.filter((m) => m.month >= "2026-04").length;
    expect(plain(a)).toContain(`${n} promos`);
  });
  it("'between April and June'", () => {
    const n = all.filter((m) => m.month >= "2026-04" && m.month <= "2026-06").length;
    expect(plain(q("how many promos between April and June"))).toContain(`${n} promos`);
  });
});

describe("follow-ups", () => {
  it("'and the worst?' keeps the scope and metric", () => {
    const first = q("which promo had the best Promo ROI since April?");
    const next = q("and the worst?", first);
    expect(plain(next)).toMatch(/Lowest Promo ROI \(started since April 2026\)/);
  });
  it("'what about Operator Bravo?' asks the same question for Bravo", () => {
    const first = q("best promo since April");
    const next = q("what about Operator Bravo?", first);
    expect(plain(next)).toMatch(/Operator Bravo/);
    expect(plain(next)).toMatch(/Highest/);
  });
  it("'compare them' compares the promos of the last answer", () => {
    const first = q("best vs worst promo since April");
    const next = q("compare them", first);
    expect(next.table?.head.length).toBe(3);
  });
});

describe("robustness", () => {
  it("never throws, and every suggested follow-up answers", () => {
    const seen = new Set<string>();
    let queue = [...suggestions(all), "??", "asdf qwer", "since", "best", "worst worst best", "compare", "may", "ggr since may 2026"];
    for (let d = 0; d < 3; d++) {
      const next: string[] = [];
      let prev: Answer | undefined;
      for (const x of queue) {
        if (seen.has(x)) continue;
        seen.add(x);
        const a = q(x, prev);
        expect(a.text.every((t) => typeof t === "string")).toBe(true);
        next.push(...(a.followUps ?? []));
        prev = a;
      }
      queue = next;
    }
  });
});
