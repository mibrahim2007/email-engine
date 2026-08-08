/**
 * Content normalisation and hashing — Story 4.2 Task 3, supporting FR27.
 *
 * The hash decides whether re-indexing skips a chunk, so **what it ignores is
 * the contract**, not an implementation detail. A document re-saved on Windows
 * must produce identical hashes, or every nightly re-index re-embeds an
 * unchanged corpus and FR27's "skipping unchanged content" delivers nothing.
 *
 * Normalisation is tested independently of hashing for that reason: a hash
 * that changes for a reason nobody intended is indistinguishable from a
 * document that changed.
 */

import { createHash } from "node:crypto";

/**
 * Collapse the differences that are not content.
 *
 * - CRLF and CR become LF, so line endings never change a hash.
 * - Trailing whitespace per line goes; editors add it invisibly.
 * - Runs of blank lines collapse to one; a reflowed paragraph is not an edit.
 * - Leading and trailing whitespace on the whole text goes.
 * - NBSP and the other Unicode space separators become ordinary spaces — a
 *   PDF extractor emits them inconsistently for the same visual output.
 *   Written as escapes, not literals: an invisible character in source is a
 *   defect nobody can see in a diff, which is what `no-irregular-whitespace`
 *   exists to catch — and it caught this.
 *
 * Deliberately **not** normalised: case, punctuation, and internal single
 * spaces. Those carry meaning, and folding them would make two genuinely
 * different chunks hash the same, which is the failure that silently serves
 * stale content.
 */
export function normalise(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g, " ")
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/, ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** SHA-256 of the normalised text. Hex, because it lands in a `text` column. */
export function contentHash(text: string): string {
  return createHash("sha256").update(normalise(text), "utf8").digest("hex");
}

/**
 * Below this many characters of extracted text, a source is `empty` rather
 * than `indexed` — Story 4.2's ruling.
 *
 * A scanned PDF extracts to nothing, chunks to nothing, and completes: green
 * badge, chunk count zero, no error at any layer. The admin concludes the bot
 * knows the handbook. **Zero chunks is a terminal state of its own**, not a
 * success, and this constant is the line — a number with a test, not a feeling.
 *
 * 20 rather than 0 because an extractor that returns a stray bullet or a page
 * number has still found no text worth indexing.
 */
export const MIN_EXTRACTED_CHARS = 20;

export function isEffectivelyEmpty(text: string): boolean {
  return normalise(text).length < MIN_EXTRACTED_CHARS;
}
