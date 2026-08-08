import { describe, expect, it } from "vitest";
import { computeGroundedness, meetsThreshold, splitSentences } from "./confidence";

const run = (over: Partial<Parameters<typeof computeGroundedness>[0]> = {}) =>
  computeGroundedness({ body: "", citations: [], retrievedChunkIds: [], ...over });

describe("computeGroundedness — §10.4, PRD Q10", () => {
  it("scores the fraction of claim sentences carrying a resolvable citation", () => {
    const body = "Hi Sarah. Refunds take five days. Refunds go to the original card. Thanks!";
    // Sentences: 0 "Hi Sarah." 1 "Refunds take five days." 2 "Refunds go..." 3 "Thanks!"
    // Claims: 1 and 2. One cited.
    const out = run({
      body,
      citations: [{ chunkId: "c1", sentenceIndex: 1 }],
      retrievedChunkIds: ["c1"],
    });
    expect(out.claimSentences).toBe(2);
    expect(out.citedSentences).toBe(1);
    expect(out.confidence).toBeCloseTo(0.5, 12);
  });

  it("THE NEGATIVE CONTROL — an uncovered question scores low", () => {
    // Story 5.3's test: a question the KB does not answer produces low
    // confidence. With an empty retrieved set no citation resolves, so every
    // claim sentence misses. Under a self-report this test could not be
    // written at all, which was the argument for option B.
    const out = run({
      body: "Your card was declined because your bank blocked it. Contact them to unblock.",
      citations: [{ chunkId: "hallucinated", sentenceIndex: 0 }],
      retrievedChunkIds: [],
    });
    expect(out.confidence).toBe(0);
    expect(out.unresolvedCitations).toBe(1);
  });

  it("a hallucinated citation lowers the score rather than raising it", () => {
    const body = "Refunds take five days. Refunds go to the original card.";
    const real = run({ body, citations: [{ chunkId: "c1", sentenceIndex: 0 }], retrievedChunkIds: ["c1"] });
    const fake = run({
      body,
      citations: [
        { chunkId: "c1", sentenceIndex: 0 },
        { chunkId: "not-retrieved", sentenceIndex: 1 },
      ],
      retrievedChunkIds: ["c1"],
    });
    expect(fake.confidence).toBe(real.confidence);
    expect(fake.unresolvedCitations).toBe(1);
    expect(fake.confidence!).toBeLessThan(1);
  });

  it("returns null, not 0, when the reply makes no claims", () => {
    // "I've passed this to a colleague" is not a low-confidence reply; it is a
    // reply with nothing to be confident about. Rendering it as 0 would read as
    // badly grounded, which is wrong (Story 5.5).
    const out = run({ body: "Hi Sarah. Thanks for reaching out. Best regards" });
    expect(out.claimSentences).toBe(0);
    expect(out.confidence).toBeNull();
  });

  it("does not let the model shrink the denominator — the anti-gaming property", () => {
    // Boilerplate detection is code-owned and conservative. A sentence the
    // patterns do not recognise counts as a claim, so an unusual sentence can
    // only make the score *lower*.
    const out = run({
      body: "Per your request, I am marking this resolved.",
      citations: [],
      retrievedChunkIds: [],
    });
    expect(out.claimSentences).toBe(1);
    expect(out.confidence).toBe(0);
  });

  it("excludes the tenant's configured signature and disclaimers", () => {
    const out = run({
      body: "Refunds take five days. Acme Support — this email is confidential.",
      citations: [{ chunkId: "c1", sentenceIndex: 0 }],
      retrievedChunkIds: ["c1"],
      boilerplate: ["Acme Support — this email is confidential."],
    });
    expect(out.claimSentences).toBe(1);
    expect(out.confidence).toBe(1);
  });

  it("counts a sentence once however many citations it carries", () => {
    const out = run({
      body: "Refunds take five days.",
      citations: [
        { chunkId: "c1", sentenceIndex: 0 },
        { chunkId: "c2", sentenceIndex: 0 },
      ],
      retrievedChunkIds: ["c1", "c2"],
    });
    expect(out.citedSentences).toBe(1);
    expect(out.confidence).toBe(1);
  });

  it("ignores a citation pointing at a boilerplate sentence", () => {
    const out = run({
      body: "Hi Sarah. Refunds take five days.",
      citations: [{ chunkId: "c1", sentenceIndex: 0 }],
      retrievedChunkIds: ["c1"],
    });
    expect(out.citedSentences).toBe(0);
    expect(out.confidence).toBe(0);
  });
});

describe("meetsThreshold — the one place auto-send is decided", () => {
  it("null never sends, at any threshold including zero", () => {
    expect(meetsThreshold(null, 0.9)).toBe(false);
    expect(meetsThreshold(null, 0)).toBe(false);
  });

  it("is inclusive at the threshold", () => {
    expect(meetsThreshold(0.9, 0.9)).toBe(true);
    expect(meetsThreshold(0.89, 0.9)).toBe(false);
  });
});

describe("splitSentences", () => {
  it("splits on terminators and line breaks", () => {
    expect(splitSentences("One. Two! Three?\nFour")).toEqual(["One.", "Two!", "Three?", "Four"]);
  });

  it("drops empty fragments", () => {
    expect(splitSentences("  \n\n One.  \n ")).toEqual(["One."]);
  });
});
