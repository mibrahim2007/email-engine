/**
 * `In-Reply-To` and `References` for outbound replies — Story 6.2 AC1.
 *
 * Pure header arithmetic. Story 6.2's two findings are encoded here:
 *
 *  1. **The reply's parent is the latest *inbound* message**, not the latest
 *     message — which may be our own previous reply.
 *  2. **`References` is truncated in the middle, never at the front.** Dropping
 *     the head breaks the chain and clients fall back to subject matching,
 *     which is the heuristic Story 2.6 spends its length trying to avoid.
 *
 * Threading is `In-Reply-To`/`References`, not the transport — which is why
 * PRD §8.1 concluded that sending through Resend rather than `gmail.send`
 * costs the Sent-folder copy and not the threading.
 */

/** A `Message-ID` including angle brackets, as it appears on the wire. */
export type MessageId = string;

export interface ReplyHeaders {
  inReplyTo: MessageId;
  references: MessageId[];
}

/**
 * RFC 5322 sets no limit on `References`, but a header line that grows without
 * bound is rejected or truncated by intermediate servers — and a *server*
 * truncating it will cut wherever it likes, including the front.
 *
 * Truncating deliberately is how the head is protected. 20 is comfortably
 * within what every client handles and long enough that no real thread loses
 * usable context.
 */
export const MAX_REFERENCES = 20;

/**
 * Build the threading headers for a reply.
 *
 * `parentReferences` is the parent message's own `References`, and
 * `parentMessageId` its `Message-ID`. Per RFC 5322 the reply's `References` is
 * the parent's chain **plus** the parent itself.
 */
export function buildReplyHeaders(
  parentMessageId: MessageId,
  parentReferences: readonly MessageId[] = [],
): ReplyHeaders {
  const chain = [...parentReferences, parentMessageId].filter(
    (id, i, all) => id.length > 0 && all.indexOf(id) === i,
  );

  return { inReplyTo: parentMessageId, references: truncateReferences(chain) };
}

/**
 * Keep the head and the tail, drop the middle.
 *
 * The first entry identifies the thread's root and is what a client uses to
 * group the whole conversation; the last few carry the immediate context. **The
 * middle is the only part that can be lost without breaking anything**, which
 * is precisely why the convention exists and why truncating from the front —
 * the obvious `slice(-20)` — is the version that quietly breaks threading on
 * long chains.
 */
export function truncateReferences(
  references: readonly MessageId[],
  max: number = MAX_REFERENCES,
): MessageId[] {
  if (max < 2) throw new RangeError("max must be at least 2 — the root and one recent entry");
  if (references.length <= max) return [...references];

  const head = references.slice(0, 1);
  const tail = references.slice(references.length - (max - 1));
  return [...head, ...tail];
}

/**
 * The message a reply should be addressed to.
 *
 * **The latest inbound one**, not the latest overall. A conversation with eight
 * messages has eight possible parents, and replying to our own previous
 * outbound message threads the reply under ourselves rather than under the
 * customer — which looks right in our UI and wrong in theirs.
 *
 * Returns `undefined` for a conversation with no inbound message, which is not
 * a state a reply should be composed in; the caller must treat it as an error
 * rather than defaulting to the newest message.
 */
export function replyParent<T extends { direction: "inbound" | "outbound"; receivedAt: Date }>(
  messages: readonly T[],
): T | undefined {
  return messages
    .filter((m) => m.direction === "inbound")
    .reduce<T | undefined>(
      (latest, m) => (latest === undefined || m.receivedAt > latest.receivedAt ? m : latest),
      undefined,
    );
}
