> **Shard of [PRD](../../Email%20Engine%20PRD.md) §8.**
> Derived file — edit the source document and re-shard, never this copy.

## 8. Open questions

Carried from [[Email Engine Architecture]] §17, plus product-side items. Each needs an owner and a decision date before the epic that depends on it starts.

| # | Question | Blocks | Owner |
|---|---|---|---|
| 1 | Auto-send default — conservative (0.9, off) or ship on at 0.85? **Unblocked 2026-08-07 by question 10.** The threshold is now a fraction of factual sentences backed by a clickable source, so 0.85 and 0.9 are a real choice — and Front-End Spec §5.3's backtest (*"of your last 200 drafts, 84 would have sent"*) is a sentence that can be defended | Epic 6 | PM, after Epic 5 eval data |
| ~~2~~ | ~~Data residency — single region now, or tenant→region routing designed up front?~~ **Closed 2026-08-04: single region.** The attribute is the seam ([[Email Engine Architecture]] §6.8b); the routing is not built, because it would change `withTenant()` before there is a customer to justify it. Reasoning and the revisit trigger in §6.8d | ~~Epic 8~~ | Architect ✓ |
| 3 | Model choice — tenant-selectable or a plan attribute we control? | Epic 5, pricing | PM |
| 4 | Pricing shape — per seat, per message, or hybrid? | Epic 8 | PM |
| **8** | **Gmail send scope — keep `gmail.send`, or send through Resend?** *(Raised 2026-08-05 drafting Story 2.2. **Longest lead time on the project** and previously in no document.)* Gmail's read **and** send scopes are *restricted*, so production use with external tenants needs Google verification including a likely third-party security assessment — weeks to months. Read access is not negotiable; send might be. See the analysis below | Epic 2 ships unverified; **selling** blocks on it | **PM + Architect** |
| ~~5~~ | ~~Attachment malware scanning vendor~~ **Closed 2026-08-04: none.** The question was unanswerable as posed — it asked *which vendor*, and the answer is that scanning is deferred and containment ships instead (FR57). Reasoning in [[Email Engine Architecture]] §13.3 | ~~Epic 2~~ | Architect ✓ |
| ~~6~~ | ~~Does MVP need a shared team view of who is currently viewing a conversation?~~ **Resolved 2026-08-03: no** — assignment plus a send-time conflict check. Reasoning and revisit criteria in [[Email Engine Front-End Spec]] §13. | ~~Epic 3~~ | UX Expert ✓ |
| 7 | Retrieval quality bar — what recall@8 gates Epic 5? **The bar must be set against a *multi-tenant* measurement** — see §8.2 | Epic 4 → 5 | Architect + PM |
| ~~10~~ | ~~What is the confidence number?~~ **Closed 2026-08-07: computed groundedness (option B).** `confidence` becomes *resolvable-cited claim sentences / claim sentences*, computed in code with a **code-owned denominator** so the model cannot relabel its way to a better score; the self-report is kept as `model_confidence` and gates nothing. A zero denominator yields `NULL`, and `NULL` never auto-sends. Reasoning in §8.3 and [[Email Engine Architecture]] §10.4 | ~~Story 5.3, Epic 6~~ | **PM + Architect ✓** |
| 9 | Classification accuracy bar — what threshold gates enabling drafting? *(Raised 2026-08-06 drafting Story 5.1: unlike question 7's, this number exists in no document and nobody has been asked to agree it.)* Needs answering **per field**, with `requires_human` recall weighted above intent accuracy | Epic 5 | PM + Architect |

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


### 8.3 Analysis for question 10 — what the confidence number is

> [!success] Resolved 2026-08-07 — option B, with A retained as a recorded column
> **`confidence` is computed groundedness**, not a self-report. The full ruling and its three anti-gaming definitions are [[Email Engine Architecture]] §10.4; the schema half is §6.7a.
>
> **What decided it was AC4, not the failure mode.** Story 6.3 requires an admin to acknowledge a plain-language explanation before arming auto-send, and Front-End Spec §5.3 specifies that explanation as a backtest: *"With auto-send at 0.90, of your last 200 drafts, 84 would have sent without a person reading them."* Under option A the honest second half of that sentence is *"84 drafts the model felt good about"* — an explanation that should, correctly, stop a support lead from clicking the button. **A number you cannot explain to the person taking the risk is not a threshold, it is a decoration.**
>
> **Option C is not rejected, it is sequenced.** A second-model grader costs a call per draft and adds a second thing that can be wrong, and under a self-report there was no baseline to justify it against. There is now: Story 5.1's eval set can score groundedness against human-judged correctness, and **if the two diverge, C becomes a decision with evidence.** Keeping `model_confidence` is what makes that comparison possible at all.
>
> **The known limitation, stated so nobody rediscovers it as a defect:** groundedness is provenance, not truth. A reply can be perfectly cited to a chunk that is out of date. This ruling makes the number *honest and comparable*; it does not make it a correctness score, and the meter's label says so.

Architect input, 2026-08-06, raised drafting Story 5.3.

**Today the number is the model's opinion of its own work.** `propose_reply` emits body, citations, and confidence in one call, from one context, and Story 5.3 AC3's *"ungrounded claims lower the confidence"* is an instruction in a prompt whose compliance nothing checks.

**What rests on it:**

| Consumer | Uses confidence to |
|---|---|
| Front-End Spec §4.1 | Four redundant encodings, band labels, and the **threshold marker** — described there as "the trust-building device" |
| Story 5.4 AC1 | Escalate below a floor |
| **FR42 / Epic 6** | **Send with no human review above a tenant-set threshold** |
| **§8 Q1** | **Choose between defaulting to 0.9 and 0.85** |

**Q1 cannot be answered while Q10 is open.** Deciding between 0.85 and 0.9 assumes a 0.87 draft is reliably worse than a 0.92 one — across tenants, intents, weeks, and a model version changing underneath. A self-report has none of those properties, and models are known to report high confidence in precisely the case this product exists to catch: a fluent, plausible answer to a question the knowledge base does not cover.

**The failure is exact.** Auto-send armed at 0.9. A customer asks something the KB does not answer. The model writes a confident, well-formed, wrong reply, scores itself 0.94, and it sends with nobody looking. Every supervision surface worked — the popover shows the chunks it did retrieve, the meter shows 94, the trace shows the calls. **Nothing in the system disagrees with itself.**

| Option | What it is | Cost |
|---|---|---|
| **A — self-report** *(as currently specified)* | The model's own number | Free. Uncalibrated, and **unfalsifiable from inside the system** |
| **B — mechanical groundedness** | Fraction of the draft's factual sentences carrying a resolvable citation, computed in code | Cheap, deterministic, explainable. Measures grounding, **not correctness** |
| **C — a second-model check** | A cheap fast-tier call scoring each claim against the chunks it cites | One extra call per draft. Independent of the drafting context |

**Recommendation: B ships as the confidence, with A recorded beside it and unused by any gate.**

Confidence becomes computed rather than claimed; an agent can be told what it means in one sentence — *"84% of this reply's factual sentences are backed by a source you can click"* — and that is the number §4.1's meter should carry, because the meter's job is to make grounding legible rather than to relay a mood.

Keeping A as a second column costs nothing and gives the project the one signal it cannot otherwise get: **the gap between what the model claims and what it can support.** That gap is the eval metric worth watching over a model upgrade.

**C stays live for Epic 6**, where auto-send makes the stakes real, and it is best priced against Story 5.1's eval data rather than now.

**Story 5.3 AC3 is not implementable until this is decided** — "lower the confidence" names no mechanism — and Epic 6 inherits whatever is chosen, so the decision is cheaper now than after FR42 is built on it.

---
