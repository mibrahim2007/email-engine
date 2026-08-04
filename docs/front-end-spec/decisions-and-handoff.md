> **Shard of [Front-End Spec](../../Email%20Engine%20Front-End%20Spec.md) §13.**
> Derived file — edit the source document and re-shard, never this copy.

## 13. Resolution — PRD open question 6

> **Q6. Does MVP need a shared team view of who is currently viewing a conversation?** — Blocks Epic 3, owned by UX Expert.

**No. Ship assignment plus a send-time conflict check instead.**

Reasoning:

1. **Real presence needs infrastructure the architecture deliberately deferred.** §9.3 chose 10s SWR polling and marked `LISTEN/NOTIFY` → SSE as a future upgrade. Presence at a 10s resolution is worse than none — an avatar that appears seconds after someone starts typing, and lingers seconds after they leave, teaches agents to distrust it.
2. **The collision it prevents is already handled.** Teams of 3–20 (PRD §1.2) working an assigned queue rarely open the same conversation. Assignment is the coordination primitive, and it exists.
3. **The residual risk is duplicate sends, and that has a cheaper fix.** On send, if another message was added to the conversation since the draft was generated, block and show: *"Marco replied 30 seconds ago — review before sending."* This catches the actual failure at the actual moment, costs one query, and needs no realtime channel.

**Revisit when** either SSE lands for another reason, or analytics show duplicate-reply incidents above ~1% of sends. Both are observable, so this decision is falsifiable rather than permanent.

---
