/**
 * Chunking — Story 4.2 ACs 2, 3 and 5.
 *
 * Pure: text and headings in, chunks out. No database, no network, no tenant.
 * That is what makes AC5's fixture corpus affordable, and it is why extraction
 * lives elsewhere — the fetch is Story 4.1's security boundary, not this.
 */

import { contentHash, isEffectivelyEmpty, normalise } from "./normalise";

/** A heading and the text beneath it, as an extractor produces. */
export interface Section {
  /** Outermost heading first: `["Billing", "Refunds"]`. Empty for preamble. */
  headingPath: string[];
  text: string;
}

export interface Chunk {
  content: string;
  tokenCount: number;
  contentHash: string;
  metadata: { headingPath: string[]; sectionIndex: number; partIndex: number };
}

export interface ChunkOptions {
  /** AC2's "~500 tokens". A target, not a ceiling — sections win. */
  targetTokens?: number;
  /** AC2's "~15% overlap", applied within a section only. */
  overlapRatio?: number;
  /**
   * Token counter. **Required, with no default on purpose.**
   *
   * Story 4.2 AC3 wants counts from the embedding model's own tokeniser, and a
   * default would let the approximation below ship simply because nobody
   * passed anything. Making it mandatory means using the stand-in has to be
   * typed out — the same reasoning as `system.ts`'s enumerable surface and the
   * `region` single-value CHECK: **constrain the exception, do not merely
   * document it.**
   */
  countTokens: (text: string) => number;
}

/**
 * A stand-in token counter: ~4 characters per token.
 *
 * **Story 4.2 AC3 requires the embedding model's tokeniser**, and this is not
 * it. A count from a different tokeniser is a number that is right about
 * nothing, so this is deliberately crude rather than plausibly accurate.
 *
 * It is **not** a default — `ChunkOptions.countTokens` is required, so reaching
 * for this one has to be a decision somebody typed. It exists for tests and for
 * a caller who has consciously accepted an approximation.
 */
export const approximateTokens = (text: string): number => Math.ceil(text.length / 4);

/**
 * Split sections into chunks.
 *
 * **Sections are the primary boundary; the token target is a target.** AC2 asks
 * for both "~500 tokens with ~15% overlap" and "do not split mid-heading-
 * section", and those cannot both hold for a 3,000-token section. Sections win:
 * an oversized one splits at paragraph boundaries, and **every piece keeps the
 * heading path**, so a chunk retrieved from the middle still says what it is
 * about — which is what Story 4.5 renders and what Epic 5's citations quote.
 *
 * Never emits an empty or whitespace-only chunk (AC5).
 */
export function chunk(sections: Section[], options: ChunkOptions): Chunk[] {
  const { targetTokens = 500, overlapRatio = 0.15, countTokens } = options;

  if (targetTokens < 1) throw new RangeError("targetTokens must be at least 1");
  if (overlapRatio < 0 || overlapRatio >= 1) throw new RangeError("overlapRatio must be in [0, 1)");

  const out: Chunk[] = [];

  sections.forEach((section, sectionIndex) => {
    const text = normalise(section.text);
    if (isEffectivelyEmpty(text)) return;

    const parts =
      countTokens(text) <= targetTokens
        ? [text]
        : splitByParagraph(text, targetTokens, overlapRatio, countTokens);

    parts.forEach((content, partIndex) => {
      if (isEffectivelyEmpty(content)) return;
      out.push({
        content,
        tokenCount: countTokens(content),
        contentHash: contentHash(content),
        metadata: { headingPath: section.headingPath, sectionIndex, partIndex },
      });
    });
  });

  return out;
}

/**
 * Split one oversized section at paragraph boundaries, with overlap.
 *
 * Overlap is applied by carrying the tail paragraphs of the previous part into
 * the next, so a claim that straddles a boundary appears whole in at least one
 * chunk. It is **within a section only** — bleeding across a heading would put
 * two topics in one chunk and undo the reason sections are the boundary.
 *
 * A single paragraph larger than the target is emitted alone and over budget.
 * Splitting mid-sentence to satisfy a target would produce a chunk that
 * retrieves well and reads as nonsense when cited.
 */
function splitByParagraph(
  text: string,
  targetTokens: number,
  overlapRatio: number,
  countTokens: (t: string) => number,
): string[] {
  const paragraphs = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  if (paragraphs.length <= 1) return [text];

  const parts: string[] = [];
  let current: string[] = [];
  let currentTokens = 0;

  const flush = () => {
    if (current.length === 0) return;
    parts.push(current.join("\n\n"));
    const overlapTokens = Math.floor(targetTokens * overlapRatio);
    const carried: string[] = [];
    let carriedTokens = 0;
    for (let i = current.length - 1; i >= 0; i--) {
      const paragraph = current[i];
      if (paragraph === undefined) break;
      const t = countTokens(paragraph);
      if (carriedTokens + t > overlapTokens) break;
      carried.unshift(paragraph);
      carriedTokens += t;
    }
    current = carried;
    currentTokens = carriedTokens;
  };

  for (const paragraph of paragraphs) {
    const t = countTokens(paragraph);
    if (currentTokens > 0 && currentTokens + t > targetTokens) flush();
    current.push(paragraph);
    currentTokens += t;
  }
  if (current.length > 0) parts.push(current.join("\n\n"));

  // The overlap carry can leave a final part that is nothing but the tail of
  // the previous one — a duplicate rather than a chunk. Drop only that case.
  //
  // It must be a *strict* suffix, and only the last part. An earlier version
  // dropped any part its predecessor ended with, which silently deleted
  // legitimately repeated paragraphs: identical strings satisfy `endsWith`,
  // so a document with two identical sections lost one. Found by a test using
  // repeated filler text, which is exactly the input a synthetic fixture
  // produces and a real document occasionally does.
  const tail = parts[parts.length - 1];
  const beforeTail = parts[parts.length - 2];
  if (
    tail !== undefined &&
    beforeTail !== undefined &&
    tail.length < beforeTail.length &&
    beforeTail.endsWith(tail)
  ) {
    parts.pop();
  }
  return parts;
}
