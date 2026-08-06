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
| **8** | **Gmail send scope — keep `gmail.send`, or send through Resend?** *(Raised 2026-08-05 drafting Story 2.2. **Longest lead time on the project** and previously in no document.)* Gmail's read **and** send scopes are *restricted*, so production use with external tenants needs Google verification including a likely third-party security assessment — weeks to months. Read access is not negotiable; send might be. See the analysis below | Epic 2 ships unverified; **selling** blocks on it | **PM + Architect** |
| ~~5~~ | ~~Attachment malware scanning vendor~~ **Closed 2026-08-04: none.** The question was unanswerable as posed — it asked *which vendor*, and the answer is that scanning is deferred and containment ships instead (FR57). Reasoning in [[Email Engine Architecture]] §13.3 | ~~Epic 2~~ | Architect ✓ |
| ~~6~~ | ~~Does MVP need a shared team view of who is currently viewing a conversation?~~ **Resolved 2026-08-03: no** — assignment plus a send-time conflict check. Reasoning and revisit criteria in [[Email Engine Front-End Spec]] §13. | ~~Epic 3~~ | UX Expert ✓ |
| 7 | Retrieval quality bar — what recall@8 gates Epic 5? **The bar must be set against a *multi-tenant* measurement** — see §8.2 | Epic 4 → 5 | Architect + PM |

---

### 8.1 Analysis for question 8 — the Gmail send scope

Architect input, 2026-08-05. **Dropping `gmail.send` does not remove the verification requirement** — `gmail.readonly` is restricted too, and reading is what the product is. So the question is not *whether* to verify but *how hard the assessment is*, which scales with the scope set.

**What is actually lost by sending through Resend instead:**

| | Sending via `gmail.send` | Sending via Resend from the tenant's domain |
|---|---|---|
| Threads in the customer's client (FR39) | ✅ | ✅ — threading is `In-Reply-To`/`References`, not the transport |
| Signature and branding (FR40) | ✅ | ✅ |
| Deliverability | Google's reputation | The tenant's domain reputation, once DNS is set up |
| **Appears in the tenant's Gmail Sent folder** | ✅ | ❌ **This is the whole difference** |

That last row is the real trade. An agent who opens Gmail directly sees no record of what the product sent on their behalf — and a support lead auditing "what did we tell this customer" would find the thread incomplete in the tool they already trust.

**Two mitigations exist**, both cheaper than a scope escalation:

1. **Append to the mailbox** rather than send through it. Placing a copy in the Sent folder is a different, less restricted operation than sending, and it preserves the audit trail an agent expects.
2. **Accept the gap and make the product the record.** The conversation view already shows every outbound message (Epic 3), and the audit trail is FR53. This is defensible if tenants are told plainly.

**Recommendation to the PM:** decide on the basis of who audits, not on transport. If tenants will live in Gmail alongside the product, option 1. If the product is the system of record, option 2 and the smaller scope set. **Either way, start the verification application now** — it is the only item on this project measured in weeks, and the scope set can be narrowed during review more easily than the clock can be recovered.

### 8.2 Analysis for question 7 — which measurement the recall bar is set against

Architect input, 2026-08-06, raised drafting Story 4.4.

**Answering Q7 means naming a number. This note is about which experiment produces the number**, because two defensible measurements of the same query differ by a wide margin and only one of them is what production runs.

Architecture §6.8f: RLS is a filter, and with an approximate index **filtering is applied after the index is scanned**. At NFR7's scale — 500 tenants × 5,000 chunks, one tenant holding 0.2% of the table — pgvector's default `hnsw.ef_search` of 40 leaves well under one surviving row where §6.4 asks for thirty. §6.8f rules iterative index scans as the mitigation, and iterative scan is *bounded*, so the mitigated number is still not the single-tenant number.

| Measured on | What it reports |
|---|---|
| A one-tenant fixture | The retrieval quality of the algorithm. Flattering, reproducible, **and not what any customer experiences** |
| A ≥100-tenant fixture with iterative scan on | The retrieval quality of the system. The one Epic 5's drafts are actually grounded by |

**Recommendation to the PM and Architect: set the bar on the multi-tenant measurement, and require both numbers to be reported.** The gap between them is the value of §6.8f's mitigation, and it is worth watching over time — if it widens as the fixture grows, that is the signal that partitioning `kb_chunks` has stopped being optional.

Story 4.4 builds the labelled set and reports both. **It deliberately does not set the bar** — a Dev agent can run the measurement and cannot decide whether the result is good enough.

---
