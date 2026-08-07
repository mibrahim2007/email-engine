# Requirements traceability

| | |
|---|---|
| **Built** | 2026-08-04, PO — resolving [validation finding F7](../po-validation-2026-08-03.md) |
| **Covers** | FR1–57, NFR1–25 against 45 stories across 8 epics |
| **Result** | Every FR has a delivering story. **Four new findings** (F8–F11), all in requirements whose *verification* is missing rather than whose delivery is |
| **Status** | ✅ **F8–F11 all resolved 2026-08-04** — see the notes under each. The recommendation at the foot of this page was also adopted |

## Why this exists

PRD §7 recorded "Every FR maps to at least one story ✅" and "NFRs are reflected in acceptance criteria, not only stated ✅". Both were true enough to survive a reading and neither was demonstrable — the epics cite no FR numbers, so the mapping lived in the PM's reasoning rather than in the artifact.

That mattered: findings **F3** (no story built the notification channel) and **F5** (attachment scanning had a column and a question but no requirement) were both found by reading the documents against each other, which is slow, unrepeatable, and lucky. This table is the repeatable version. It found four more.

**Method.** Every story's acceptance criteria were read, not skimmed for keywords. A story is listed against an FR only where an AC actually delivers it; a story that *consumes* a capability is not the same as one that *builds* it — that distinction is what F3 turned on, and it is what F8 below turns on too.

> **A correction, 2026-08-05.** F11 marked NFR1 and NFR6 resolved on the grounds that Front-End Spec §12 covers them. **§12 states the budgets; nothing measured them** — `ci.yml` ran typecheck, lint, test and build, and no story owned a bundle-size check. That is the same "described by several, built by none" defect as F3, F8, SB-1 and SB-4 — **introduced while resolving a finding of exactly that class**, because pointing at a document reads like assigning an owner. Both now name Story 1.6 AC6. The rule this earns: **a requirement is only covered when a *story* covers it. A section number is a citation, not an owner.**

> **A limitation this table has, discovered 2026-08-05.** It maps requirement → delivering story and says nothing about **preconditions**. FR3 was mapped to Story 1.5 and the mapping was correct — but nothing populated the table 1.5 stores roles on, and the matrix could not show that, because the gap was between two stories rather than between a requirement and a story. The [story boundary audit](../story-boundary-audit-2026-08-05.md) is the pass that finds it. Rows carrying a **bold precondition** below were corrected after SB-1.

---

## Functional requirements

| FR | Requirement (abbreviated) | Delivered by | |
|---|---|---|---|
| FR1 | Tenants map to Clerk Organizations | 1.4 | ✅ |
| FR2 | User belongs to many tenants, switches without re-auth | 1.4 AC4, **1.4 AC6** | ✅ |
| FR3 | Four roles with distinct permissions | 1.5 AC1–2, **populated by 1.4 AC6** | ✅ |
| FR4 | Invite, remove, re-role members | 1.5 AC3 | ✅ |
| FR5 | No cross-tenant read or write | 1.3 | ✅ |
| FR6 | Gmail OAuth | 2.2 | ✅ |
| FR7 | Microsoft 365 via Graph | 2.3 AC1 | ✅ |
| FR8 | Generic IMAP/SMTP | 2.3 AC2 | ✅ |
| FR9 | Inbound webhook without mailbox access | 2.4 | ✅ |
| FR10 | Credentials encrypted, tokens auto-refreshed | 2.1 AC3–4, 2.2 AC2 | ✅ |
| FR11 | Connection health displayed, admins notified | 2.1 AC5, 2.2 AC5, 1.7 AC4 | ✅ |
| FR12 | 30-day backfill, non-blocking | 2.8 | ✅ |
| FR13 | Ingest within 2 min (webhook 10 s) | 2.4 AC4, 2.7, **2.8 AC6** | ✅ F9 fixed |
| FR14 | Each provider message processed exactly once | 2.7 | ✅ |
| FR15 | MIME → text, safe HTML, snippet, attachments | 2.5 AC1, AC5 | ✅ |
| FR16 | Threading by headers, subject fallback | 2.6 | ✅ |
| FR17 | Quoted history stripped but expandable | 3.3 AC2 | ✅ |
| FR18 | Never render unsanitized HTML; block remote images | 2.5 AC2–4 | ✅ |
| FR19 | Filterable, searchable conversation list | 3.1, 3.2 | ✅ |
| FR20 | Full message history with attachments | 3.3 | ✅ |
| FR21 | Change status, assign | 3.4 AC1–2 | ✅ |
| FR22 | Inbox reflects teammates' changes without refresh | 3.6 AC1 | ✅ |
| FR23 | Keyboard navigation and command palette | 3.6 AC2–3 | ✅ |
| FR24 | Contact panel with history and custom fields | 3.4 AC4 | ✅ |
| FR25 | Add sources: URL, file, text, FAQ | 4.1 | ✅ |
| FR26 | Extract, chunk, embed; per-source status | 4.1, 4.2, 4.3 | ✅ |
| FR27 | Re-index on demand and nightly, skip unchanged | 4.3 (nightly), 4.5 (on demand) | ✅ |
| FR28 | Direct KB search showing chunks and scores | 4.5 | ✅ |
| FR29 | Hybrid semantic + keyword, tenant-scoped | 4.4 | ✅ |
| FR30 | Classify intent, sentiment, urgency, language, PII | 5.1 | ✅ — **per message**, per §6.7a |
| FR31 | Draft every classified message not needing a human | 5.3 | ✅ |
| FR32 | Draft carries confidence, citations, model, tool calls | 5.3 AC2 | ⚠ **what `confidence` is, is §8 Q10** |
| FR33 | Agent tools: KB, contact, tenant webhook, escalate | 5.2 AC1 | ✅ — **five tools**; `propose_reply` was missing from the epic |
| FR34 | Escalate on language, PII, sentiment, low confidence | 5.4 AC1 | ✅ |
| FR35 | Tenant persona configuration | 5.6 AC1 | ✅ |
| FR36 | Playground using the production agent | 5.6 AC2–3 | ✅ |
| FR37 | Message content never authorizes a tool call | 5.2, 5.6 AC5, 8.4 AC2 | ✅ |
| FR38 | Approve, edit-send, regenerate, reject; outcome recorded | 5.5 AC3–4 | ✅ |
| FR39 | Correct threading headers on outbound | 6.2 AC1–2 | ✅ |
| FR40 | Tenant signature and branding applied | 6.2 AC3 | ✅ |
| FR41 | Each outbound message sent exactly once | 6.1 | ⚠ **holds only if `superseded` ships** — see T-2 |
| FR42 | Auto-send above a confidence threshold | 6.3 | ⚠ **blocked on §8 Q10** |
| FR43 | Business hours and configurable delay | 6.4 | ✅ |
| FR44 | Bounces and delivery failures surfaced | 6.5, **2.5 (detection)** | ⚠ **needs a 2.5 scope change** |
| FR45 | Manual reply bypassing the AI | 3.5 | ✅ |
| FR46 | API keys: create, scope, revoke, shown once | 7.1 | ✅ — **`scope` needed a column** (§6.7b) |
| FR47 | Versioned REST API | 7.2 | ⚠ **`GET /v1/usage` deferred to 8.2** — ships as `501` |
| FR48 | Signed outbound webhooks with retries | 7.4 AC1–3 | ✅ |
| FR49 | Pre-registered tenant action webhook | 7.4 AC4, **5.2** (the tool) | ✅ |
| FR50 | Analytics over a selectable period | 8.1 | ✅ |
| FR51 | Per-tenant usage recorded and reported | 8.2 AC1–2 | ✅ |
| FR52 | Subscribe, upgrade, downgrade, invoices, limits | 8.2 AC3–5 | ✅ |
| FR53 | Append-only audit event for every state change | **1.5 AC5 owns the write path**; 3.4 AC5, 7.1 AC5 consume it | ✅ F8 fixed |
| FR54 | Data export and full deletion | 8.4 AC3 | ✅ |
| FR55 | In-app notification centre | 1.7 AC1–3 | ✅ |
| FR56 | Operational email for two conditions | 1.7 AC4–5 | ✅ |
| FR57 | Attachment containment, true type, no false scan claim | 2.5 AC6–7 | ✅ |

**57 of 57 have a delivering story.** The PM's claim holds. The two that carried qualifications when this table was built — FR13 and FR53 — were fixed the same day; see F9 and F8.

---

## Non-functional requirements

This is where the PRD's second claim — "reflected in acceptance criteria, not only stated" — did not hold when the table was built. Five NFRs had no verifying criterion and one, NFR20, had nothing anywhere. All but NFR4 were fixed the same day; PRD §7's claim is annotated rather than silently corrected.

| NFR | Requirement | Verified by | |
|---|---|---|---|
| NFR1 | LCP < 1.8 s, INP < 200 ms p75 | **1.6 AC6** gates a Lighthouse lab proxy; the p75 field figure is observed via Speed Insights | ✅ corrected 08-05 |
| NFR2 | Conversation detail < 300 ms p95 | **3.3 AC6** (3.1 AC5 covers the list) | ✅ F11 fixed |
| NFR3 | Inbound → draft-ready < 30 s p95 | 5.3 AC5 | ✅ |
| NFR4 | Playground first token < 1.5 s p95 | **5.6 AC2** | ✅ **F11 fully closed 2026-08-06** |
| NFR5 | Retrieval < 150 ms p95 | 4.4 AC4 | ⚠ **on a multi-tenant fixture only** — §6.8f |
| NFR6 | Client JS < 200 KB gzipped | **1.6 AC6** — CI fails the build above the ceiling | ✅ corrected 08-05 |
| NFR7 | 500 tenants × 50 k conversations | 8.5 AC2, **4.4 AC4** | ✅ |
| NFR8 | 50 inbound messages/second | 8.5 AC1 | ✅ |
| NFR9 | No full-table scans on tenant data | 8.5 AC2 | ✅ |
| NFR10 | Isolation enforced at the database layer | 1.3 | ✅ |
| NFR11 | Credentials and keys encrypted/hashed at rest | 2.1 AC3–4, 7.1 AC2 | ✅ |
| NFR12 | Webhooks signature- and timestamp-verified | 2.4 AC1–2 | ✅ |
| NFR13 | Email HTML sanitized, strict CSP | 2.5 AC2–3, 8.4 AC1 | ✅ |
| NFR14 | Prompt-injection corpus passes every release | 8.4 AC2, 5.6 AC5 | ✅ |
| NFR15 | Audit events immutable to the app role | **1.5 AC6** asserts it in a test, not only in a grant | ✅ F8 fixed |
| NFR16 | TLS 1.2+, HSTS | 8.4 AC1 | ✅ |
| NFR17 | 99.9 % monthly availability | **Reclassified** as an operational SLO; observed via 8.3 | ✅ F11 fixed |
| NFR18 | No message lost to a transient failure | 2.7 AC5, **6.1 AC5** | ✅ — inbound **and** outbound halves |
| NFR19 | Model outage degrades to queued drafts | **5.4 AC6** — a simulated Gateway failure | ✅ F11 fixed |
| NFR20 | Point-in-time recovery, last 7 days | **1.2 AC7** — window set and a restore exercised | ✅ F10 fixed |
| NFR21 | GDPR export/erasure within 30 days | 8.4 AC3 | ✅ |
| NFR22 | Data region a tenant attribute | 8.4 AC5 + `region` column (F6) | ✅ |
| NFR23 | Every error actionable; no silent AI failure | 8.3 AC5, **5.1 AC4, 5.3, 5.4 AC6** | ✅ |
| NFR24 | WCAG 2.1 AA on authenticated screens | 1.6 AC4 (shell only) + FE Spec §11 | ⚠️ partial |
| NFR25 | Single-vendor serverless, no self-managed infra | Architecture §6.8 (F1 ruling) | ✅ |

---

## New findings — all resolved 2026-08-04

> Each finding below is followed by what was done. **All are now closed** — NFR4 was held open until Story 5.6 existed, and it was drafted on 2026-08-06 with the first-token target as an explicit criterion rather than a citation.

### F8 — FR53 has three consumers and no builder 🟡

> ✅ **Fixed:** Story 1.5 AC5 now owns the `audit()` helper explicitly and AC6 adds a test that the app role cannot `UPDATE`/`DELETE` `audit_events`, making NFR15 verified behaviour rather than a grant.

Three stories write audit events as a *secondary* acceptance criterion — 1.5 AC5 (membership changes), 3.4 AC5 (status and assignment), 7.1 AC5 (key creation and revocation). **No story owns the audit write path**, so no story's definition of done covers "the helper exists, is consistent, and is used everywhere FR53 says *every state change*".

`audit_events` exists in `0001` and NFR15's immutability is real — the table has `SELECT, INSERT` and nothing else. But that is schema, not application behaviour, and nothing asserts it in a test.

This is **the same shape as F3**: a cross-cutting capability assumed by several stories and owned by none. It is lower severity because the table exists and the helper is small, and it will get built incidentally by Story 1.5 — which is exactly the problem, since "incidentally, by whoever needed it first" is how it ends up inconsistent.

**Fix:** an AC in Story 1.5 that owns the helper explicitly, plus a test asserting the app role cannot `UPDATE` or `DELETE` `audit_events` (which `rls_policy_coverage.sql` could carry). **Owner: SM,** when drafting 1.5.

### F9 — FR13's latency numbers are asserted nowhere 🟡

> ✅ **Fixed:** Story 2.8 AC6 measures arrival-to-visible latency end to end against both FR13 targets.

FR13 requires ingest "within 2 minutes of arrival (webhook: within 10 seconds)". Story 2.4 AC4 requires the *endpoint* to respond within 2 seconds by handing off to a workflow — a different measurement. Story 2.8 builds the polling cron, and §12 schedules it every 2 minutes, which is where the number comes from.

**No acceptance criterion measures arrival-to-visible latency**, so the requirement is satisfied by construction and never checked. A cron that silently starts taking 4 minutes would violate FR13 with everything green.

**Fix:** an AC in Story 2.8 measuring end-to-end ingest latency, or in Story 8.5 alongside the other numeric targets. **Owner: SM.**

### F10 — NFR20 (point-in-time recovery) appears exactly once, in the NFR list 🔴

> ✅ **Fixed:** Story 1.2 AC7 sets a retention window of at least 7 days and exercises a restore once, in the story that provisions the instance.

Grep the entire PRD for "recovery", "backup", "restore", or "PITR" and NFR20 is the only hit. **No story, no acceptance criterion, no architecture section.** It is a data-loss requirement with no owner.

It is also nearly free now: Neon provides PITR, and the retention window is a setting on the instance. But "nearly free" only helps if somebody sets it — and the instance is about to be provisioned, which is precisely the moment to decide the window.

**Fix:** an AC in Story 1.2 (which provisions Neon) setting and verifying the retention window. **Owner: Architect + SM,** before Story 1.2 is drafted — this is the cheapest it will ever be.

### F11 — Five NFRs have no verifying acceptance criterion 🟡

> ✅ **Fixed:** NFR2 → Story 3.3 AC6; NFR19 → Story 5.4 AC6; NFR1 and NFR6 now say in the requirement that the front-end spec's CI budgets verify them; NFR17 reclassified as an operational SLO. **NFR4 → Story 5.6 AC2, closed 2026-08-06** — and closed with an assertion rather than a citation, which is the lesson F11 itself taught.

| NFR | Gap |
|---|---|
| NFR1 (LCP, INP) | Lives in Front-End Spec §12 as a CI budget; no PRD story asserts it |
| NFR2 (detail < 300 ms) | 3.1 AC5 measures the **list**; the detail view is unmeasured |
| NFR4 (playground first token < 1.5 s) | Nothing |
| NFR6 (client JS < 200 KB) | Front-End Spec §12 only |
| NFR17 (99.9 % availability) | Nothing — arguably an operational target, but then it should say so |
| NFR19 (model outage → queued drafts) | Nothing tests the degraded path |

NFR1 and NFR6 are genuinely covered — by the Front-End Spec, which the PRD's checklist did not consider. The honest correction is to PRD §7's claim rather than to the requirements: NFRs are reflected in acceptance criteria **or in the front-end spec's CI budgets**, and three of them are reflected nowhere.

**Fix:** point NFR1/NFR6 at the FE spec explicitly; add ACs for NFR2 and NFR19; reclassify NFR17 as an operational SLO rather than a testable requirement. **Owner: PM.**

### T-1 — The matrix disagreed with the PRD and both showed green *(2026-08-06)*

FR27 has always read **"re-index on demand and nightly, skip unchanged"** and this table has always mapped it to **Story 4.3**. PRD Epic 4 put the nightly cron in **Story 4.5**. Architecture §12 declared the route and named no story; §10.2 assigned the enumerator to 4.3.

So the matrix and the epic named different owners for the same half of one requirement, **for three days, with a ✅ next to it.** Nothing surfaced it, because this table asks *does some story deliver this FR* and the answer was yes. **A requirement split across two stories satisfies a requirement→story map even when the two stories disagree about which one does the work.**

Resolved by moving the cron to 4.3 AC6 (see the epic). The row above now names both halves explicitly, which is the cheap version of the fix: **when an FR contains the word "and", map each half.**

This is the matrix's third recorded blind spot, alongside gaps that live *between* two stories and citations that read like owners.

### T-2 — FR41 was green while three ways to send twice were undiscovered *(2026-08-06)*

FR41 — "each outbound message sent exactly once, even under concurrent send attempts or retries" — has mapped to Story 6.1 and shown ✅ since this table was built. Story 6.1 does deliver it: `FOR UPDATE SKIP LOCKED`, ten concurrent drains, each row sent once. **The mapping was never wrong.**

Drafting Epics 5 and 6 found three ways a customer receives two replies, **none of which FR41's mechanism touches**:

| Found in | The duplicate is created |
|---|---|
| Story 5.5 | **One table up.** Regenerate leaves two `proposed` drafts; auto-send drains both. Two *legitimate* outbound rows, each correctly sent once |
| Story 6.5 | **By the product replying to its own bounce**, which threads back in as a customer message and draws another reply |
| Story 6.4 | **By time.** An overnight queued auto-send fires at 9am after an agent already answered at 8am |

**A requirement→story map records that a story delivers the guarantee. It cannot record what the guarantee does not cover.** FR41 is about concurrency on one row, and all three of these are upstream, adjacent, or downstream of that row.

The row above now carries the dependency rather than a bare ✅. The general lesson is the matrix's fourth recorded blind spot: **an FR phrased as a guarantee should be read for its scope, not just its owner** — "exactly once" named a mechanism, and three failure modes lived outside it while the cell stayed green.

### T-3 — Four green rows and no cell for "and what runs it" *(2026-08-07)*

FR48 — "deliver signed webhooks … **with retries**" — mapped to Story 7.4 ACs 1–3 and showed ✅. Drafting 7.4 found that the retry half needs **a table, a cron, an enumerator, and an eighth `system.ts` export**, none of which existed. The matrix could not have known: it asks *which story delivers this FR*, and 7.4 does.

Three of the four Epic 7 rows moved on drafting, each for a different reason the matrix cannot express:

| Row | Was | Why it moved |
|---|---|---|
| FR46 | ✅ | "scope" was in the AC and in no schema |
| FR47 | ✅ | One of its eleven endpoints depends on a **later** epic |
| FR48 | ✅ | The retry half is an entire subsystem |

**The matrix maps requirement → story and has no column for what the story needs to exist first.** Delivery, scope, schema, and sequencing are four different questions, and a single ✅ answers only the first. Fourth recorded blind spot, alongside gaps between two stories, citations that read like owners, and guarantees read for their owner rather than their scope.

---

## Keeping it current

This table is only worth having if it stays true. It should be re-checked whenever an FR or a story is added or amended — the four findings above all came from requirements that were correct when written and drifted, or from ACs that quietly assumed somebody else's work.

The cheap version of that discipline: **when a story is drafted, cite the FR numbers it delivers in the story file.** Story 1.1's file does not, and neither does any epic. If they did, this table would generate itself and F8 would have been impossible to write by accident.
