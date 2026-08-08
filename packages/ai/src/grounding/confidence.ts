/**
 * Computed groundedness — Architecture §10.4, closing PRD §8 Q10.
 *
 *     confidence = resolvable-cited claim sentences / claim sentences
 *
 * This number drives the §4.1 meter, Story 5.4's escalation floor and FR42's
 * auto-send threshold, so **the whole design is about making it something the
 * model cannot influence.** Three properties carry that, and each is a test:
 *
 *  1. The denominator is code-owned — the model does not get to declare a
 *     sentence non-factual and shrink the divisor.
 *  2. Only citations that resolve count, so a hallucinated citation *lowers*
 *     the score rather than raising it.
 *  3. A zero denominator yields `null`, never `0` — a reply with no claims has
 *     nothing to be confident about, and `null` never auto-sends.
 *
 * **It measures provenance, not truth.** A reply can be perfectly grounded in
 * a chunk that is out of date. The meter's label says what was measured for
 * exactly this reason.
 */

export interface Citation {
  /** The chunk this sentence claims to rest on. */
  chunkId: string;
  /** 0-based index of the sentence it grounds, within the draft body. */
  sentenceIndex: number;
}

export interface GroundednessInput {
  /** The draft body, plain text. */
  body: string;
  citations: Citation[];
  /** Chunk ids actually returned by retrieval for this run. */
  retrievedChunkIds: readonly string[];
  /**
   * Persona strings to exclude from the denominator: the configured signature
   * and any standard disclaimers. **Known strings from the tenant's settings**,
   * which is what makes the exclusion code-owned rather than a judgement.
   */
  boilerplate?: readonly string[];
}

export interface Groundedness {
  /** `null` when there are no claim sentences. Never auto-sends. */
  confidence: number | null;
  claimSentences: number;
  citedSentences: number;
  /** Citations pointing at a chunk retrieval did not return. */
  unresolvedCitations: number;
}

/**
 * Greetings and sign-offs, excluded from the denominator.
 *
 * A fixed, code-owned list. It is deliberately short and conservative: a
 * sentence this does not recognise counts as a claim, so the failure mode is a
 * *lower* score rather than a flattering one. **Erring toward more claims is
 * the safe direction** — it can only make a draft look less grounded, which
 * escalates rather than sends.
 */
const BOILERPLATE_PATTERNS: readonly RegExp[] = [
  /^(hi|hello|hey|dear)\b/i,
  /^(thanks|thank you|many thanks)\b/i,
  /^(best|kind) regards\b/i,
  /^(regards|sincerely|cheers)\b/i,
  /^(please )?let me know\b/i,
  /^(i hope|hope) (this|you)\b/i,
  /^(happy to help|glad to help)\b/i,
  /^(sorry for|apologies for)\b/i,
];

/**
 * Split a body into sentences.
 *
 * Deliberately simple: terminator followed by whitespace, plus line breaks.
 * A cleverer splitter would be more accurate and less predictable, and the
 * denominator's value is that it is *stated*, not that it is subtle.
 */
export function splitSentences(body: string): string[] {
  return body
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function isBoilerplate(sentence: string, extra: readonly string[]): boolean {
  const s = sentence.trim();
  if (BOILERPLATE_PATTERNS.some((re) => re.test(s))) return true;
  return extra.some((b) => {
    const t = b.trim();
    return t.length > 0 && (s === t || s.includes(t) || t.includes(s));
  });
}

export function computeGroundedness(input: GroundednessInput): Groundedness {
  const { body, citations, retrievedChunkIds, boilerplate = [] } = input;
  const retrieved = new Set(retrievedChunkIds);

  const sentences = splitSentences(body);
  const claimIndexes = sentences
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => !isBoilerplate(s, boilerplate))
    .map(({ i }) => i);

  const resolvable = new Set<number>();
  let unresolved = 0;
  for (const c of citations) {
    if (!retrieved.has(c.chunkId)) {
      // A citation to a chunk this run did not retrieve is not evidence. It
      // does not count toward the numerator, so it lowers the score — which is
      // the intended treatment of a hallucinated citation.
      unresolved++;
      continue;
    }
    if (claimIndexes.includes(c.sentenceIndex)) resolvable.add(c.sentenceIndex);
  }

  const claimSentences = claimIndexes.length;
  const citedSentences = resolvable.size;

  return {
    confidence: claimSentences === 0 ? null : citedSentences / claimSentences,
    claimSentences,
    citedSentences,
    unresolvedCitations: unresolved,
  };
}

/**
 * The one place that decides whether a draft may auto-send on groundedness.
 *
 * `null` is not "treat as zero" and not "treat as pass" — it is its own case,
 * and it never sends. Written as a function rather than left to each caller
 * because Story 6.3's Task 2 and Story 5.4's escalation floor must agree, and
 * a comparison spelled out twice is a comparison that diverges once.
 */
export function meetsThreshold(confidence: number | null, threshold: number): boolean {
  if (confidence === null) return false;
  return confidence >= threshold;
}
