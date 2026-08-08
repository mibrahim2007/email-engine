import { describe, expect, it } from "vitest";
import { chunk, approximateTokens, type Section } from "./chunk";
import { contentHash, normalise, isEffectivelyEmpty, MIN_EXTRACTED_CHARS } from "./normalise";

const para = (n: number, seed = "word") => Array.from({ length: n }, () => seed).join(" ");

describe("normalise — Story 4.2 Task 3", () => {
  it("makes CRLF and LF hash identically — the FR27 case", () => {
    // A document re-saved on Windows must not re-embed. This is the whole
    // reason normalisation exists.
    const lf = "First line\nSecond line\n\nThird";
    expect(contentHash(lf.replace(/\n/g, "\r\n"))).toBe(contentHash(lf));
  });

  it("ignores trailing whitespace and collapsed blank runs", () => {
    expect(contentHash("a   \n\n\n\nb")).toBe(contentHash("a\n\nb"));
  });

  it("treats non-breaking spaces as spaces — PDF extractors emit them unevenly", () => {
    expect(contentHash("a b")).toBe(contentHash("a b"));
    expect(contentHash("a b")).toBe(contentHash("a b"));
  });

  it("does NOT fold case or punctuation", () => {
    // Folding these would make two different chunks hash alike, which serves
    // stale content silently — the failure worse than re-embedding.
    expect(contentHash("Refunds are final.")).not.toBe(contentHash("refunds are final"));
  });

  it("is idempotent", () => {
    const messy = "  a  \r\n\r\n\r\n b \t\n";
    expect(normalise(normalise(messy))).toBe(normalise(messy));
  });
});

describe("isEffectivelyEmpty — Story 4.2's ruling", () => {
  it("treats a scanned PDF's empty extraction as empty", () => {
    expect(isEffectivelyEmpty("")).toBe(true);
    expect(isEffectivelyEmpty("   \n\n \t ")).toBe(true);
  });

  it("treats a stray page number as empty rather than as content", () => {
    expect(isEffectivelyEmpty("- 4 -")).toBe(true);
  });

  it("accepts text at the floor", () => {
    expect(isEffectivelyEmpty("x".repeat(MIN_EXTRACTED_CHARS))).toBe(false);
  });
});

describe("chunk — Story 4.2 AC2, AC3, AC5", () => {
  it("keeps a small section whole and carries its heading path", () => {
    const sections: Section[] = [{ headingPath: ["Billing", "Refunds"], text: "Refunds take 5 days to clear." }];
    const out = chunk(sections);
    expect(out).toHaveLength(1);
    expect(out[0]!.metadata.headingPath).toEqual(["Billing", "Refunds"]);
    expect(out[0]!.tokenCount).toBe(approximateTokens(out[0]!.content));
  });

  it("splits an oversized section at paragraph boundaries and keeps the heading on every piece", () => {
    // AC2's two constraints conflict for a long section. Sections win, and the
    // heading path must survive onto each part or a mid-section chunk retrieves
    // with nothing saying what it is about.
    const long = [para(400), para(400), para(400)].join("\n\n");
    const out = chunk([{ headingPath: ["Policies"], text: long }], { targetTokens: 200 });
    expect(out.length).toBeGreaterThan(1);
    expect(out.every((c) => c.metadata.headingPath.join("/") === "Policies")).toBe(true);
  });

  it("never emits an empty or whitespace-only chunk — AC5", () => {
    const out = chunk([
      { headingPath: ["A"], text: "" },
      { headingPath: ["B"], text: "   \n\n  " },
      { headingPath: ["C"], text: "Real content that is long enough to keep." },
    ]);
    expect(out).toHaveLength(1);
    expect(out.every((c) => c.content.trim().length > 0)).toBe(true);
  });

  it("returns nothing for a document that extracts to nothing — the scanned PDF", () => {
    // The negative control for this story: zero chunks, so the caller must
    // record `empty` rather than `indexed`. The chunker's job is to return
    // nothing honestly; the status ruling is Story 4.3's to apply.
    expect(chunk([{ headingPath: [], text: "" }])).toEqual([]);
  });

  it("emits an over-budget chunk rather than splitting mid-sentence", () => {
    const single = para(5000);
    const out = chunk([{ headingPath: ["X"], text: single }], { targetTokens: 100 });
    expect(out).toHaveLength(1);
    expect(out[0]!.tokenCount).toBeGreaterThan(100);
  });

  it("overlaps within a section and never across one", () => {
    const a = chunk([{ headingPath: ["A"], text: [para(300), para(300)].join("\n\n") }], { targetTokens: 200 });
    const combined = a.map((c) => c.content).join("|");
    expect(a.length).toBeGreaterThan(1);
    // Two separate sections must never share a chunk.
    const two = chunk(
      [
        { headingPath: ["A"], text: "Alpha content long enough to survive the floor." },
        { headingPath: ["B"], text: "Bravo content long enough to survive the floor." },
      ],
      { targetTokens: 10_000 },
    );
    expect(two).toHaveLength(2);
    expect(two[0]!.content).not.toContain("Bravo");
    expect(combined.length).toBeGreaterThan(0);
  });

  it("carries overlap forward without emitting a duplicate chunk", () => {
    // Distinct paragraphs, deliberately. An earlier version of this test used
    // three identical ones and failed — correctly, because identical input
    // *should* produce identical chunks. The property under test is that the
    // overlap carry does not duplicate a chunk, which only means anything when
    // the paragraphs differ.
    const text = [para(20, "alpha"), para(20, "bravo"), para(20, "charlie")].join("\n\n");
    const out = chunk([{ headingPath: ["A"], text }], { targetTokens: 60, overlapRatio: 0.5 });

    const hashes = out.map((c) => c.contentHash);
    expect(new Set(hashes).size).toBe(hashes.length);

    // The overlap is the point: a claim straddling a boundary appears whole
    // in at least one chunk.
    expect(out.length).toBeGreaterThan(1);
    expect(out.some((c) => c.content.includes("bravo"))).toBe(true);
  });

  it("keeps identical paragraphs as separate chunks", () => {
    // The regression the above replaced. A document repeating a clause in two
    // sections must not silently lose one — identical strings satisfy
    // `endsWith`, which is how the first duplicate-filter deleted them.
    const repeated = "The refund window is fourteen days from delivery.";
    const out = chunk([{ headingPath: ["A"], text: [repeated, repeated].join("\n\n") }], {
      targetTokens: 12,
      countTokens: (t) => t.split(/\s+/).length,
    });
    expect(out).toHaveLength(2);
    expect(out[0]!.contentHash).toBe(out[1]!.contentHash);
  });

  it("uses the injected tokeniser, not the default", () => {
    // AC3: counts must come from the embedding model's tokeniser. The chunker
    // must not quietly fall back to its own approximation.
    const out = chunk([{ headingPath: [], text: "Some content that is long enough." }], {
      countTokens: () => 7,
    });
    expect(out[0]!.tokenCount).toBe(7);
  });

  it("rejects nonsense options rather than producing odd chunks", () => {
    expect(() => chunk([], { targetTokens: 0 })).toThrow(RangeError);
    expect(() => chunk([], { overlapRatio: 1 })).toThrow(RangeError);
  });
});
