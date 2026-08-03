> **Shard of [Front-End Spec](../../Email%20Engine%20Front-End%20Spec.md) §1.**
> Derived file — edit the source document and re-shard, never this copy.

## 1. Design principles

Five rules, each falsifiable. A design that violates one is wrong even if it looks better.

1. **Reviewing must beat writing.** The benchmark is the agent's own hands: if the median draft takes longer to review than to type from scratch, the feature is negative value. Budget: **≤ 8 seconds** from opening a conversation to sending an accepted draft, ≤ 3 keystrokes.
2. **Trust is earned by exposure, never by assertion.** Never show a claim about the AI's reliability. Show the confidence, the sources, and the tool calls, and let the agent form their own estimate. No "AI-powered" badges, no sparkle icons, no persuasion.
3. **The machinery yields to the message.** The draft is text in a box. Confidence is a small meter. Citations are markers. The tool trace is behind a disclosure. Progressive disclosure is not decoration here — it is what keeps rule 1 true.
4. **Every AI failure is visible and explained in one sentence.** Silence is prohibited (NFR23). An escalation, a timeout, and a model outage each produce a timeline entry in plain language, in the conversation, where the agent already is.
5. **Colour is never the only carrier.** Every state encoded in colour also carries a numeral, a word, or a shape (§4.2, §11).

---

