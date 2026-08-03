> **Shard of [Front-End Spec](../../Email%20Engine%20Front-End%20Spec.md) §13–14.**
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

## 14. Handoff

**For the Architect** — ✅ **all five ruled on 2026-08-03** in [[Email Engine Architecture]] §9.5:

| # | Delta | Section | Ruling |
|---|---|---|---|
| 1 | `/onboarding` route missing from §9.1 | §2.1 | **Accepted.** Redirect goes in `inbox/page.tsx`, not the layout — a layout check would add a query to every authenticated request |
| 2 | Draft review needs `popover` + `sheet`; `hover-card` alone fails AA | §4.2 | **Accepted, and `hover-card` dropped.** One `popover` serves hover, focus, and click; two code paths would let the accessible one rot |
| 3 | `outbound_messages` needs a cancelled state for Undo | §5.1 | **Accepted, mechanism corrected.** Enqueue with `scheduled_for = now() + window` so cancel cannot race the 30s drain; the affected-row count tells the UI whether it won |
| 4 | Conversation timeline is messages **and** system events | §7 | **Accepted** as a new `conversation_events` table. `UNION` on `audit_events` and deriving from three sources were both rejected |
| 5 | List virtualisation vs. the 200KB JS budget | §12 | **Rejected for MVP.** Cursor pagination already keeps 50k rows out of the DOM; bound the retained window to ~200 rows instead. Revisit on a measured INP regression |

Deltas 3 and 4 are specified as SQL in Architecture §6.7 and await `migrations/0003_timeline_and_cancel.sql`.

Two consequences for this spec, both already folded in above: §4.2's hover-card is now a `popover`, and §7's component map drops `hover-card`.

**For the SM** — Epic 3 and 5 stories should embed §3 (core loop), §4 (supervision surface), §8 (keyboard), and §11 (accessibility) directly into the story files, per Architecture §1.2's rule that a story is self-contained.

**For the PO** — this artifact closes the gap flagged in [[Email Engine PRD]] §9 and README. Open question 6 is resolved in §13 and can be struck from the PRD table.

**Still open, not owned by UX:** PRD §8 questions 1–5 and 7. Question 1 (auto-send default) shapes §5.3's copy but not its design — the backtest dialog works at any threshold.

---

