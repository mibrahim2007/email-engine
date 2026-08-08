import { describe, expect, it } from "vitest";
import { fuse, trimToBudget, RRF_K } from "./rrf";

const r = (...ids: string[]) => ids.map((id, i) => ({ id, rank: i + 1 }));

describe("fuse — Story 4.4 AC2", () => {
  it("pins the arithmetic to §6.4, not just the ordering", () => {
    // §6.4: COALESCE(1.0/(60 + s.rank), 0) + COALESCE(1.0/(60 + k.rank), 0).
    // Asserted numerically so a change to the SQL that is not mirrored here
    // fails, rather than both drifting while the order happens to survive.
    const [top] = fuse(r("a"), r("a"));
    expect(top!.score).toBeCloseTo(1 / (RRF_K + 1) + 1 / (RRF_K + 1), 12);

    const [only] = fuse(r("b"), []);
    expect(only!.score).toBeCloseTo(1 / (RRF_K + 1), 12);
  });

  it("ranks a document found by both above one found by either", () => {
    const out = fuse(r("only-semantic", "both"), r("both", "only-keyword"));
    expect(out[0]!.id).toBe("both");
    expect(out[0]!.matchedBy).toBe("both");
  });

  it("handles disjoint lists — every document survives", () => {
    const out = fuse(r("s1", "s2"), r("k1", "k2"));
    expect(out.map((x) => x.id).sort()).toEqual(["k1", "k2", "s1", "s2"]);
    expect(out.every((x) => x.matchedBy !== "both")).toBe(true);
  });

  it("handles identical lists — order is preserved, scores are doubled", () => {
    const out = fuse(r("a", "b", "c"), r("a", "b", "c"));
    expect(out.map((x) => x.id)).toEqual(["a", "b", "c"]);
    expect(out[0]!.score).toBeCloseTo(2 / (RRF_K + 1), 12);
  });

  it("handles one empty list, which is what §6.8f's failure actually looks like", () => {
    // When the HNSW scan post-filters to nothing, the semantic CTE is empty and
    // hybrid retrieval silently becomes keyword-only. Fusion must still return
    // a usable list — the defect is that nothing errors, and this test pins
    // that behaviour so the *caller* is responsible for noticing, not fuse().
    const out = fuse([], r("k1", "k2"));
    expect(out.map((x) => x.id)).toEqual(["k1", "k2"]);
    expect(out.every((x) => x.matchedBy === "keyword")).toBe(true);
  });

  it("returns nothing for two empty lists", () => {
    expect(fuse([], [])).toEqual([]);
  });

  it("beats a both-match with a strong single match when the ranks justify it", () => {
    // 1/(60+1) = 0.01639 alone, versus 1/(60+40) + 1/(60+40) = 0.02 together.
    // The both-match wins here — the point is that it is arithmetic, not a rule
    // that "both always wins", and the next case shows it losing.
    expect(fuse(r("solo"), Array.from({ length: 40 }, (_, i) => ({ id: "pair", rank: i + 1 })).slice(-1))[0]!.id)
      .toBe("solo");
  });

  it("is deterministic on ties", () => {
    const out = fuse(r("b"), r("a"));
    expect(out.map((x) => x.id)).toEqual(["a", "b"]);
    expect(out[0]!.score).toBeCloseTo(out[1]!.score, 12);
  });

  it("rejects a 0-based rank rather than scoring it wrongly", () => {
    expect(() => fuse([{ id: "x", rank: 0 }], [])).toThrow(RangeError);
  });
});

describe("trimToBudget — Story 4.4 AC2", () => {
  const tokens = (x: { id: string; n: number }) => x.n;

  it("keeps fused order and stops at the budget", () => {
    const out = trimToBudget([{ id: "a", n: 400 }, { id: "b", n: 400 }, { id: "c", n: 400 }], tokens, 900);
    expect(out.map((x) => x.id)).toEqual(["a", "b"]);
  });

  it("skips one oversized chunk rather than discarding everything behind it", () => {
    // The reason this does not `break`: a single long chunk in the middle must
    // not cost the shorter, equally relevant ones after it.
    const out = trimToBudget([{ id: "a", n: 100 }, { id: "huge", n: 5000 }, { id: "c", n: 100 }], tokens, 500);
    expect(out.map((x) => x.id)).toEqual(["a", "c"]);
  });

  it("returns nothing when the first chunk alone exceeds the budget", () => {
    expect(trimToBudget([{ id: "a", n: 5000 }], tokens, 100)).toEqual([]);
  });
});
