import { describe, expect, it } from "vitest";
import { buildReplyHeaders, truncateReferences, replyParent, MAX_REFERENCES } from "./references";

const id = (n: number) => `<msg-${n}@example.com>`;
const chain = (n: number) => Array.from({ length: n }, (_, i) => id(i + 1));

describe("buildReplyHeaders — Story 6.2 AC1", () => {
  it("sets In-Reply-To to the parent and appends it to References", () => {
    const out = buildReplyHeaders(id(3), [id(1), id(2)]);
    expect(out.inReplyTo).toBe(id(3));
    expect(out.references).toEqual([id(1), id(2), id(3)]);
  });

  it("handles a first reply, where the parent has no References", () => {
    const out = buildReplyHeaders(id(1));
    expect(out.references).toEqual([id(1)]);
  });

  it("does not duplicate a parent already present in the chain", () => {
    const out = buildReplyHeaders(id(2), [id(1), id(2)]);
    expect(out.references).toEqual([id(1), id(2)]);
  });
});

describe("truncateReferences — the middle goes, never the head", () => {
  it("keeps a short chain intact", () => {
    expect(truncateReferences(chain(5))).toEqual(chain(5));
  });

  it("THE NEGATIVE CONTROL — the root survives a 40-message thread", () => {
    // Truncating from the front is the obvious `slice(-20)` and it drops the
    // root, which is what a client groups the whole conversation by. Losing it
    // sends the reply to subject-matching — the heuristic Story 2.6 spends its
    // whole length trying to avoid.
    const out = truncateReferences(chain(40));
    expect(out).toHaveLength(MAX_REFERENCES);
    expect(out[0]).toBe(id(1));
  });

  it("keeps the immediate context at the tail", () => {
    const out = truncateReferences(chain(40));
    expect(out[out.length - 1]).toBe(id(40));
    expect(out[out.length - 2]).toBe(id(39));
  });

  it("drops only from the middle", () => {
    const out = truncateReferences(chain(40), 5);
    expect(out).toEqual([id(1), id(37), id(38), id(39), id(40)]);
  });

  it("refuses a max too small to hold a root and a recent entry", () => {
    expect(() => truncateReferences(chain(10), 1)).toThrow(RangeError);
  });
});

describe("replyParent — the latest INBOUND message", () => {
  const m = (direction: "inbound" | "outbound", day: number) => ({
    direction,
    receivedAt: new Date(Date.UTC(2026, 7, day)),
    tag: `${direction}-${day}`,
  });

  it("THE NEGATIVE CONTROL — does not reply to our own last message", () => {
    // A conversation with eight messages has eight possible parents. Replying
    // to our own previous outbound threads the reply under ourselves: it looks
    // right in our UI and wrong in the customer's.
    const messages = [m("inbound", 1), m("outbound", 2), m("inbound", 3), m("outbound", 4)];
    expect(replyParent(messages)?.tag).toBe("inbound-3");
  });

  it("picks the latest inbound regardless of array order", () => {
    const messages = [m("inbound", 5), m("inbound", 1), m("inbound", 3)];
    expect(replyParent(messages)?.tag).toBe("inbound-5");
  });

  it("returns undefined when there is no inbound message", () => {
    // Not a state a reply should be composed in. The caller must treat this as
    // an error rather than defaulting to the newest message, which is exactly
    // the silent wrong-parent bug this function exists to prevent.
    expect(replyParent([m("outbound", 1)])).toBeUndefined();
    expect(replyParent([])).toBeUndefined();
  });
});
