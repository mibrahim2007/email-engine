# PO master checklist — validation report

| | |
|---|---|
| **Date** | 2026-08-03 |
| **Validated** | [PRD](../Email%20Engine%20PRD.md) v1.0 · [Architecture](../Email%20Engine%20Architecture.md) v1.0 (+§9.5, §6.7) · [Front-End Spec](../Email%20Engine%20Front-End%20Spec.md) v1.1 |
| **Verdict** | 🟡 **CONCERNS** — Epic 1 Story 1.1 is cleared to start; seven findings need owners, three of them before Story 1.2 |
| **Updated** | 2026-08-04 — **all seven original findings resolved.** F1 Neon ([§6.8](../Email%20Engine%20Architecture.md)) · F2 Story 1.3 rescoped · F3 FR55/FR56 + Story 1.7 · F4 search design settled · F5 containment not scanning ([§13.3](../Email%20Engine%20Architecture.md)) · F6 `region` column ([§6.8b](../Email%20Engine%20Architecture.md)) · F7 [traceability matrix](./prd/traceability.md) |
| **Open** | **F8–F11**, raised by the matrix. None blocks Epic 1. **F10 is the one to act on before Story 1.2** — NFR20's point-in-time recovery has no owner anywhere, and Neon provisioning is the cheapest moment it will ever have |
| **Sharding** | Complete — [prd](./prd/index.md) · [architecture](./architecture/index.md) · [front-end-spec](./front-end-spec/index.md) |

---

## Verdict in one paragraph

The plan is unusually complete: epics are correctly sequenced, acceptance criteria are testable, and the isolation guarantee is not merely specified but built and CI-guarded ahead of schedule. What the checklist surfaces is not weakness in the plan — it is **drift between the plan and what has already been built**. Epic 1 describes provisioning a Neon database with three extensions; the schema is live on a self-hosted PostgreSQL 17 with none. That single divergence accounts for three of the seven findings. The remaining four are genuine gaps: a notification channel four epics assume and none builds, malware scanning with a column but no requirement, full-text search with no supporting index, and an NFR with no schema representation.

**Story 1.1 (monorepo and deployment skeleton) depends on none of this and can start now.**

---

## Category results

| # | Category | Result |
|---|---|---|
| 1 | Project setup and initialization | ✅ Pass |
| 2 | Infrastructure and deployment sequencing | 🟡 Concerns — F1, F2 |
| 3 | External dependencies and integrations | 🟡 Concerns — F3 |
| 4 | UI/UX considerations | ✅ Pass — front-end spec closes the gap flagged in the PM's own §7 |
| 5 | User vs. agent responsibility | ✅ Pass |
| 6 | Feature sequencing and dependencies | 🟡 Concerns — F4, F5 |
| 7 | Risk management | ✅ Pass — tenant isolation is proven, not asserted |
| 8 | MVP scope alignment | 🟡 Concerns — F6 |
| 9 | Documentation and handoff | ✅ Pass — sharded, indexed, `core-config.yaml` written |
| 10 | Post-MVP considerations | ✅ Pass — §1.5 boundary is explicit and defended |

---

## Findings

### F1 — Epic 1 Story 1.2 describes a database that is not the one that exists ✅ RESOLVED 2026-08-03

> **Ruled: Neon is the target** — [Architecture §6.8](../Email%20Engine%20Architecture.md). NFR25 forbids self-managed infrastructure, and the two-day `pgvector` blocker is that requirement being violated in practice. The self-hosted instance is reclassified as scratch and will never hold tenant data. Story 1.2 is unblocked with AC2 corrected. **F4 is unblocked as a consequence, and two long-standing infrastructure items are dissolved.** *(This originally called for `0004_restore_extensions.sql` to revert the §6.6 substitutions. §6.8c retired that migration on 2026-08-04 — Neon starts empty, so the Drizzle schema defines the intended types directly and there is nothing to revert.)*
>
> *Original finding below, kept as the record.*

Story 1.2 AC1 provisions **Neon Postgres via the Vercel Marketplace**. AC2 enables **`pgcrypto`, `vector`, and `pg_trgm`**.

The schema is applied to a self-hosted PostgreSQL 17 where `pg_available_extensions` returns exactly one row, `plpgsql`. Architecture §6.6 documents the three substitutions this forced. So AC2 is unsatisfiable on the instance that exists, and AC1 names a provider that was not used.

`pgcrypto` is separately obsolete in AC2 — `gen_random_uuid()` has been core since PostgreSQL 13.

**This is a decision, not a bug.** Either:
- **(a)** the deployment target really is Neon, the current instance is a scratch environment, and Story 1.2 stands — in which case the as-built schema gets re-applied there and Architecture §6.6's substitutions are reverted; or
- **(b)** the self-hosted instance is the target, and Story 1.2 is rewritten to match, with `pgvector` installation becoming an infrastructure task rather than an `CREATE EXTENSION` line.

**Owner: Architect.** Needed before Story 1.2 is drafted. Everything downstream of retrieval depends on which answer is true.

---

### F2 — Epic 1 Story 1.3 is already substantially delivered ✅ RESOLVED 2026-08-04

> **Rescoped in the PRD.** ACs 1, 2, 4, 5, 6 shipped on 2026-08-03; the story now covers the application half — `withTenant()`, the two ESLint rules enforcing coding standards 1 and 2, and the real connection-path isolation run that `SET ROLE` could not provide.
>
> **The rescope found a risk the original story did not see.** RLS is currently guaranteed by hand-written SQL. From Story 1.2, Drizzle generates table DDL — and **a table Drizzle creates arrives without a policy**. Architecture §6.5 anticipated this (policies in `packages/db/migrations/policies/`, run after each generated migration) but no acceptance criterion established the pattern. New ACs 4 and 5 do, and point `rls_policy_coverage.sql` at the Drizzle-migrated schema so the safety net covers the new source of tables.
>
> *Original finding below.*

Five of its six acceptance criteria are done and running in CI as of today:

| AC | Status |
|---|---|
| 1 — every `tenant_id` table `ENABLE`d, `FORCE`d, `USING` + `WITH CHECK` | ✅ `0001`, verified 16/16 |
| 2 — app role not owner, no `BYPASSRLS` | ✅ `0002`, asserted in the coverage test |
| 3 — `withTenant()` transaction-local session | ❌ Application code, not written |
| 4 — two-tenant isolation suite, per table | ✅ `tests/rls_isolation.sql`, 10/10 |
| 5 — schema-walking test fails the build | ✅ `tests/rls_policy_coverage.sql` |
| 6 — runs on every PR and blocks merge | ✅ `.github/workflows/db.yml` |

The story should be rescoped to **AC3 alone** plus wiring the existing suites into the app's own CI, rather than re-implementing what exists. Left as written, the Dev agent will rebuild working, tested infrastructure.

**Owner: SM,** when drafting. Depends on F1 — if the answer is (a), most of this moves with the database.

---

### F3 — No epic builds the notification channel that four epics assume ✅ RESOLVED 2026-08-03

> **Resolved by the PM: the four cases are not one requirement, and splitting them makes three of them cheap.**
>
> | Case | Resolution |
> |---|---|
> | Assignment → assignee (Epic 3) | **In-app** — routine, high volume, the assignee is in the app |
> | Mailbox connection broken → admins (Epic 2, FR11) | **In-app + email.** In-app alone fails the requirement's purpose: FR11 exists *because* nobody is looking. If they were, the health indicator would already tell them |
> | Outbound message `dead` → admins (Epic 6) | **In-app + email** — same shape |
> | Escalation → "a channel" (Epic 5) | **Already built.** FR48 delivers a signed `conversation.escalated` webhook; a tenant wanting Slack wires that. No feature needed — the AC was amended to stop implying one |
>
> New **FR55** (in-app notification centre) and **FR56** (operational email, two conditions only, deduplicated). New **Story 1.7** in Epic 1 — placed there because Epic 2 Story 2.2 is the first consumer and no story may depend on a later epic. Slack/Teams/push are now named explicitly in §1.5's out-of-scope list rather than implied into existence by an acceptance criterion.
>
> **Resend was already in the stack** (§3, `RESEND_API_KEY` already in §12's env list), so FR56 adds no vendor, credential, or architectural decision.
>
> *Original finding below, kept as the record.*

"Notifies admins" or "notifies the assignee" appears as an acceptance criterion in four places:

| Where | AC |
|---|---|
| Epic 2, Story 2.2 | A revoked grant "notifies admins" |
| Epic 3, Story 3.4 | Assignment "notifies the assignee" |
| Epic 5, Story 5.4 | Escalation "optionally notifies a channel" |
| Epic 6, Story 6.1 | Dead outbox rows notify admins |

**No story anywhere builds a notification mechanism,** and no FR describes one. There is no email-to-team path, no in-app inbox, no Slack integration in scope. FR11 requires the outcome without any story delivering the means.

The first consumer is Epic 2, so this cannot wait. Cheapest MVP-consistent resolution: in-app only, backed by `conversation_events` for the conversation-scoped cases and a small `notifications` table for the account-scoped ones — deferring email/Slack to post-MVP explicitly rather than by accident.

**Owner: PM,** before Epic 2 is drafted.

---

### F4 — Epic 3's free-text search has no index behind it 🟢 Unblocked by F1, design settled

> **F1's ruling settles the open half of this.** With Neon, `pg_trgm` is available — so the answer is both: `tsvector` + GIN on `messages` for full-text search over subject and body (core, and always the right call for that), **and** `pg_trgm` restored on `contacts.name` for the fuzzy match §6.3 originally specified. Still needs a migration before Epic 3; folded into `0005` with F6.
>
> *Original finding below.*

Story 3.2 AC2 requires free-text search over "subject, sender, and body with trigram-assisted matching", and AC5 sets a 500ms p95 at target scale (50,000 conversations per tenant).

The as-built schema has **no full-text index on `messages` or `conversations`**. The only `tsvector` is on `kb_chunks`, and `pg_trgm` is unavailable. `idx_msg_conv_received` supports the thread view, not search. At 50,000 conversations this AC would be a sequential scan per keystroke.

Needs either a generated `tsvector` column plus GIN on `messages` — both core, so available today — or `pg_trgm`, which returns to F1. The tsvector route is the one that works on either database, which makes it the safer choice while F1 is open.

**Owner: Architect,** before Epic 3. A migration `0004`, not an application change.

---

### F5 — Attachment malware scanning: a column, an open question, and no requirement ✅ RESOLVED 2026-08-04

> **Ruled: no scanning in MVP. Containment ships instead** — [Architecture §13.3](../Email%20Engine%20Architecture.md), PRD FR57.
>
> **The finding was understated.** §13.1's security table did not merely omit scanning — it *promised* it: "malware scan before the blob URL is ever surfaced." A control asserted in the document a buyer's security reviewer reads, with no FR requiring it and no story building it, is worse than a gap. §13.1 is corrected.
>
> Every scanning option conflicts with a requirement already held: self-hosted ClamAV violates **NFR25**, the requirement that settled F1 one day earlier; a third-party API forwards customers' invoices and contracts to a fourth party, which makes **NFR21** and §1.1's security-review positioning worse rather than better.
>
> The residual risk is narrow because the file never executes anywhere we control — never rendered inline, never parsed by the AI (§6.4 reads `kb_chunks` only), served download-only from a separate origin to the tenant's own agents. What ships is true-type detection from magic bytes, executables refused at ingest, `Content-Disposition: attachment` + `nosniff`, an interface that **says** attachments are unscanned, and `scan_status` defaulting to `not_scanned` rather than `pending` — a default that claimed a queue existed.
>
> Post-MVP re-entry is designed: the states already cover a scanner, and the rule is fixed — the blob URL is withheld until `clean`. No schema change needed.
>
> Closes PRD §8 Q5 and Architecture §17's vendor decision. Both asked *which vendor*; the answer is none.
>
> *Original finding below, kept as the record.*

The schema carries `attachments.scan_status` defaulting to `'pending'`. PRD §8 question 5 names "attachment malware scanning vendor" as gating Epic 2. But there is **no FR for malware scanning and no story with an acceptance criterion covering it** — the capability exists only as a column and a question.

Rows will accumulate at `'pending'` forever and nothing will fail, which is the quiet kind of gap.

Either write the FR and the story, or make the deferral explicit: scanning is post-MVP, `scan_status` stays `'pending'`, and attachments are served with a warning. The second is defensible for an MVP; the current state is not, because it looks handled.

**Owner: PM + Architect,** before Epic 2.

---

### F6 — NFR22 (data region) has no representation in the schema ✅ RESOLVED 2026-08-04

> **Ruled: a real `region text NOT NULL DEFAULT 'us-east'` column, not a `settings` jsonb key** — [Architecture §6.8b](../Email%20Engine%20Architecture.md). Everything else in `settings` is tenant preference the application reads; region determines where rows may physically live and will constrain connection routing. A compliance answer that depends on a jsonb key nobody can constrain or index is not an answer. Lands in the Drizzle schema in Story 1.2.
>
> *Original finding below.*

NFR22: "Data region shall be a tenant-level attribute, even if only one region is offered at launch." Epic 8's AC repeats it: "Data region is a tenant attribute."

The `tenants` table has no region column. It could live in `settings` jsonb, but nothing says so, and a jsonb key is not what "attribute" implies to whoever implements Epic 8.

Cheap to fix now and awkward later — `0003` just went in, so `0004` can carry a `region text NOT NULL DEFAULT 'us-east'` alongside F4's search index. Deciding it now costs one line.

**Owner: Architect,** with F4.

---

### F7 — FR→story traceability is asserted, not demonstrated ✅ RESOLVED 2026-08-04

> **Built: [`docs/prd/traceability.md`](./prd/traceability.md).** All 57 FRs and 25 NFRs against 45 stories, from reading every acceptance criterion rather than keyword-matching.
>
> **The PM's FR claim holds — 57 of 57 have a delivering story.** The NFR claim does not entirely: five NFRs have no verifying AC, and one has nothing anywhere.
>
> **Four new findings, F8–F11.** All are requirements whose *verification* is missing rather than whose delivery is — which is the class of gap reading alone does not catch, and the reason this table was worth building:
>
> | | | |
> |---|---|---|
> | **F8** | FR53 (audit events) has three consumers and no builder | 🟡 Same shape as F3 |
> | **F9** | FR13's ingest latency numbers are asserted nowhere | 🟡 |
> | **F10** | **NFR20 (point-in-time recovery) appears once, in the NFR list** — no story, no AC, no architecture section | 🔴 Cheapest to fix at Neon provisioning |
> | **F11** | Five NFRs have no verifying AC; two are covered by the front-end spec the checklist did not consider | 🟡 |
>
> *Original finding below.*

PRD §7 records "Every FR maps to at least one story ✅". The epics do not cite FR numbers anywhere, so the mapping exists in the PM's reasoning rather than in the artifact, and cannot be re-verified by anyone else — including the PO.

Spot-checking a sample (FR11, FR24, FR29, FR46, FR54) found stories for all five, so the claim is *probably* sound. But F3 and F5 are both cases where a requirement has no delivering story, and both were found by reading rather than by tracing — which is precisely what a matrix would have surfaced immediately.

Recommend a traceability table in `docs/prd/`, generated once and checked when epics change.

**Owner: PO.** Not blocking.

---

## Sequencing verdict

Epic order holds. Each epic's technical foundations are laid by an earlier one, with the exception of the notification channel (F3), which is assumed by four and built by none.

```
Epic 1  Foundation ──────────────────▶ Story 1.1 drafted; 1.7 added for F3
Epic 2  Ingest      ── clear (F5 resolved 08-04)
Epic 3  Inbox UI    ── needs F4's migration (design settled)
Epic 4  Knowledge   ── needs a provisioned Neon instance
Epic 5  AI replies  ── needs Epic 4 + Q7 (recall bar)
Epic 6  Sending     ── needs Q1 (auto-send default)
Epic 7  Public API  ── clean
Epic 8  Analytics   ── needs F6, Q2, Q4
```

*(Updated 2026-08-03.)* **Epic 4's gate is now a provisioning step rather than an open question.** F1 ruled for Neon, which ships `pgvector`, so FR29's hybrid retrieval is implementable the moment an instance exists — a Vercel Marketplace click. Epic 1 gained Story 1.7 (notification foundation) from F3, which lands before Epic 2's first consumer.

*(Updated 2026-08-04.)* **No finding blocks any epic.** The three remaining are F2 (rescope Story 1.3 before drafting), F6 (a data-region column, needed by Epic 8), and F7 (the traceability matrix, process only). The real gates are now operational rather than editorial: **a provisioned Neon instance**, and PRD §8 questions 1 and 7 before Epics 5 and 6.

---

## Cleared to proceed

**Epic 1, Story 1.1 — Monorepo and deployment skeleton.** No dependency on any finding above. The SM can draft it now.

Story 1.2 should not be drafted until F1 is answered. Story 1.3 should not be drafted until F2 is rescoped.

---

## Sharding record

| Target | Files | Source |
|---|---|---|
| [`docs/prd/`](./prd/index.md) | 17 | PRD §1–§9, one file per epic |
| [`docs/architecture/`](./architecture/index.md) | 15 | Architecture §2–§15 |
| [`docs/front-end-spec/`](./front-end-spec/index.md) | 14 | Front-End Spec §1–§14 |

Shards are exact line slices — verified contiguous, no gaps or overlaps, every file starting on a heading. They are derived artifacts: edit the source and re-shard.

`.bmad-core/core-config.yaml` written, with `devLoadAlwaysFiles` set to the three lean shards Architecture §1.3 specifies.

**Two amendments to §1.3's plan:** it lists twelve architecture shards and omits §2 (high-level architecture) and §12 (deployment), both of which are referenced by shards that *are* listed. Added, making fourteen. §1.3 also predates the front-end spec, which is sharded here on the same terms.
