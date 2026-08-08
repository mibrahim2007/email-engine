/**
 * Subject normalisation for the threading fallback — Story 2.6 AC2, Task 2.
 *
 * Pure, and deliberately conservative. This feeds the *fallback* path used when
 * `Message-ID` / `In-Reply-To` / `References` are missing or broken, and Story
 * 2.6's ruling on that path is the thing to keep in mind while reading:
 *
 * > **A wrong merge is a data-exposure incident RLS cannot prevent.** Both
 * > messages belong to the same tenant, so every policy is satisfied — tenant
 * > isolation is not thread isolation. Splitting looks disorganised; merging
 * > shows one customer's mail inside another's conversation.
 *
 * So every judgement call here resolves toward *not* matching.
 */

/**
 * Reply and forward prefixes, including the localised forms.
 *
 * **The localised ones are the common miss** (Story 2.6 Task 2), because a
 * developer testing against their own mail client sees only `Re:` and `Fwd:`
 * and everything appears to work.
 *
 * Matched case-insensitively, with an optional bracketed counter — Outlook and
 * several clients emit `Re[2]:` — and an optional trailing space.
 */
const PREFIXES = [
  "re", // English, Italian, Spanish, Portuguese, Dutch
  "aw", // German — Antwort
  "antw", // Dutch — Antwoord
  "sv", // Swedish, Danish, Norwegian — Svar
  "vs", // Finnish — Vastaus
  "vá", // Hungarian — Válasz
  "odp", // Polish — Odpowiedź
  "ynt", // Turkish — Yanıt
  "ref", // French variant
  "res", // Spanish variant
  "fw",
  "fwd", // English forward
  "wg", // German — Weitergeleitet
  "tr", // French — Transféré
  "rv", // Spanish — Reenviado
  "enc", // Portuguese — Encaminhada
  "doorst", // Dutch — Doorgestuurd
  "vb", // Swedish — Vidarebefordrat
  "ilt", // Finnish — Iletilen
] as const;

const PREFIX_RE = new RegExp(
  String.raw`^\s*(?:(?:${PREFIXES.join("|")})(?:\s*\[\d+\])?\s*:\s*)+`,
  "i",
);

/**
 * Strip reply/forward prefixes and collapse whitespace.
 *
 * Repeated prefixes collapse in one pass — `Re: Fwd: Re: Invoice` becomes
 * `invoice` — because a long chain is exactly where the fallback gets used.
 *
 * Lower-cased, because clients differ on capitalisation of the subject itself
 * when quoting, and this value is only ever compared, never displayed. The
 * *displayed* subject is `conversations.subject`, which keeps its original form.
 */
export function normaliseSubject(subject: string): string {
  let previous: string;
  let current = subject ?? "";
  do {
    previous = current;
    current = current.replace(PREFIX_RE, "");
  } while (current !== previous);

  return current.replace(/\s+/g, " ").trim().toLowerCase();
}

/**
 * Subjects too generic to justify a fallback merge on their own.
 *
 * Story 2.6 Task 2: *"'Invoice', 'Question', 'Hello' plus an overlapping
 * participant set is a plausible false match — consider refusing the fallback
 * entirely for subjects below a length or entropy floor. Splitting is the safe
 * failure."*
 *
 * Both floors, not either: a short subject is refused, and so is a subject made
 * of nothing but common words however long it is. `"Hello"` fails the first;
 * `"question about the order"` fails the second.
 */
const GENERIC_WORDS = new Set([
  "hello", "hi", "hey", "question", "questions", "invoice", "invoices",
  "order", "orders", "help", "support", "info", "information", "enquiry",
  "inquiry", "issue", "problem", "urgent", "update", "request", "quote",
  "follow", "up", "thanks", "query", "about", "the", "a", "an", "my", "our",
  "your", "for", "with", "and", "of", "to", "re", "on", "in", "at", "is",
  "it", "this", "that", "from", "please", "hello", "regarding", "account",
]);

/** Minimum normalised length before a subject may drive a fallback match. */
export const MIN_SUBJECT_LENGTH = 12;

/** A run of digits long enough to be an identifier rather than a quantity. */
const IDENTIFIER_DIGITS = /\d{3,}/;

/** Tokens shorter than this are never distinguishing on their own. */
const DISTINCTIVE_WORD_LENGTH = 6;

/**
 * A subject is generic unless it carries **positive evidence** of being
 * distinctive: an identifier-like digit run, or a reasonably long word that is
 * not in the common list.
 *
 * **The direction matters more than the list.** The first version asked whether
 * *every* word was common, which meant a single word missing from the list made
 * a subject look distinctive and *permitted* a merge — the unsafe direction, and
 * `"follow up on my request"` slipped through on the word "on". Story 2.6's
 * ruling is "when in doubt, split", so the test has to be evidence *for*
 * matching, not absence of evidence against it.
 *
 * The list is still incomplete and always will be. What changed is what
 * incompleteness costs: an unrecognised long word now over-permits, where
 * before any unrecognised word did. **And this is one of three conditions, not
 * the whole test** — Story 2.6 requires normalised subject *and* participant
 * set *and* the 30-day window, "never two of three".
 */
export function isGenericSubject(normalised: string): boolean {
  if (normalised.length < MIN_SUBJECT_LENGTH) return true;

  const words = normalised.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  if (words.length === 0) return true;

  if (IDENTIFIER_DIGITS.test(normalised)) return false;

  const hasDistinctiveWord = words.some(
    (w) => w.length >= DISTINCTIVE_WORD_LENGTH && !GENERIC_WORDS.has(w),
  );
  return !hasDistinctiveWord;
}

/**
 * Whether the fallback may be used at all for this subject.
 *
 * Story 2.6's fallback needs **all three** of normalised subject, participant
 * set, and the 30-day window — "never two of three". This answers only the
 * first, and answers it in the refusing direction when unsure.
 */
export function canFallbackOnSubject(subject: string): boolean {
  const n = normaliseSubject(subject);
  return n.length > 0 && !isGenericSubject(n);
}
