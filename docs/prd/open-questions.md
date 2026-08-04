> **Shard of [PRD](../../Email%20Engine%20PRD.md) §8.**
> Derived file — edit the source document and re-shard, never this copy.

## 8. Open questions

Carried from [[Email Engine Architecture]] §17, plus product-side items. Each needs an owner and a decision date before the epic that depends on it starts.

| # | Question | Blocks | Owner |
|---|---|---|---|
| 1 | Auto-send default — conservative (0.9, off) or ship on at 0.85? | Epic 6 | PM, after Epic 5 eval data |
| ~~2~~ | ~~Data residency — single region now, or tenant→region routing designed up front?~~ **Closed 2026-08-04: single region.** The attribute is the seam ([[Email Engine Architecture]] §6.8b); the routing is not built, because it would change `withTenant()` before there is a customer to justify it. Reasoning and the revisit trigger in §6.8d | ~~Epic 8~~ | Architect ✓ |
| 3 | Model choice — tenant-selectable or a plan attribute we control? | Epic 5, pricing | PM |
| 4 | Pricing shape — per seat, per message, or hybrid? | Epic 8 | PM |
| ~~5~~ | ~~Attachment malware scanning vendor~~ **Closed 2026-08-04: none.** The question was unanswerable as posed — it asked *which vendor*, and the answer is that scanning is deferred and containment ships instead (FR57). Reasoning in [[Email Engine Architecture]] §13.3 | ~~Epic 2~~ | Architect ✓ |
| ~~6~~ | ~~Does MVP need a shared team view of who is currently viewing a conversation?~~ **Resolved 2026-08-03: no** — assignment plus a send-time conflict check. Reasoning and revisit criteria in [[Email Engine Front-End Spec]] §13. | ~~Epic 3~~ | UX Expert ✓ |
| 7 | Retrieval quality bar — what recall@8 gates Epic 5? | Epic 4 → 5 | Architect + PM |

---
