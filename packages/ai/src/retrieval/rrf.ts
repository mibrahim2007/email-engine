/**
 * Reciprocal Rank Fusion — Architecture §6.4, Story 4.4 AC2.
 *
 * §6.4 computes this in SQL. It is duplicated here as a pure function because
 * the SQL cannot be unit-tested without Postgres, and this is the half where
 * the interesting cases live: disjoint lists, one empty list, a document
 * ranked highly by one retriever and not seen by the other.
 *
 * The duplication is deliberate and bounded — see `fuse`'s note on staying in
 * step with §6.4.
 */

/** The constant in §6.4's `1.0/(60 + rank)`. */
export const RRF_K = 60;

export interface Ranked {
  /** Chunk id. Ranks are per-list, so the same id may appear in both. */
  id: string;
  /** 1-based position in its own list, as `row_number()` produces. */
  rank: number;
}

export interface Fused {
  id: string;
  score: number;
  /**
   * Which retriever found it. Story 4.5 AC2 renders this — "semantic",
   * "keyword", or "both" — and it is the only place a human sees the two
   * halves separately, which makes it the surface where §6.8f's silent
   * degradation to keyword-only becomes visible without reading logs.
   */
  matchedBy: "semantic" | "keyword" | "both";
}

/**
 * Fuse two ranked lists.
 *
 * Mirrors §6.4's `COALESCE(1.0/(60 + s.rank), 0) + COALESCE(1.0/(60 + k.rank), 0)`
 * exactly: a document absent from a list contributes zero from that list rather
 * than being excluded. **If §6.4's expression changes, this must change with
 * it** — they are two statements of one formula, and the test suite pins the
 * arithmetic rather than only the ordering so a drift fails loudly.
 *
 * Ties are broken by id, so the output is deterministic. Postgres makes no such
 * promise for equal `rrf` values, which is why the caller must not assume the
 * two orderings agree on ties — only on scores.
 */
export function fuse(semantic: Ranked[], keyword: Ranked[]): Fused[] {
  const contribution = new Map<string, { s: number; k: number }>();

  const add = (list: Ranked[], key: "s" | "k") => {
    for (const { id, rank } of list) {
      if (rank < 1) throw new RangeError(`rank must be 1-based, got ${rank} for ${id}`);
      const entry = contribution.get(id) ?? { s: 0, k: 0 };
      // Last write wins on a duplicate id within one list. That is a caller
      // bug, not something to average silently.
      entry[key] = 1 / (RRF_K + rank);
      contribution.set(id, entry);
    }
  };

  add(semantic, "s");
  add(keyword, "k");

  return [...contribution.entries()]
    .map(([id, { s, k }]) => ({
      id,
      score: s + k,
      matchedBy: (s > 0 && k > 0 ? "both" : s > 0 ? "semantic" : "keyword") as Fused["matchedBy"],
    }))
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
}

/**
 * Trim a fused list to a token budget — §6.4's "trimmed to a token budget",
 * Story 4.4 AC2.
 *
 * **After fusion, never before.** Trimming candidates before merging discards
 * rank information the fusion is computed from: a chunk ranked 30th by keyword
 * and 2nd by semantic outranks one ranked 5th by both, and dropping it early
 * makes that unreachable.
 *
 * Takes chunks in fused order until the next one would exceed the budget, and
 * **keeps going** rather than stopping — one long chunk in the middle should
 * not discard the shorter, equally relevant ones behind it.
 */
export function trimToBudget<T extends { id: string }>(
  ranked: T[],
  tokensOf: (item: T) => number,
  budget: number,
): T[] {
  const kept: T[] = [];
  let used = 0;
  for (const item of ranked) {
    const cost = tokensOf(item);
    if (used + cost > budget) continue;
    kept.push(item);
    used += cost;
  }
  return kept;
}
