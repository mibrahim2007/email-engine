# Stories

One story in flight at a time, per Architecture §1.2. The Dev agent starts with a clean context holding exactly one story file plus the three `devLoadAlwaysFiles` shards.

## Epic 1 — Foundation and tenancy

| Story | Title | Status |
|---|---|---|
| [1.1](./1.1.md) | Monorepo and deployment skeleton | **Review** — Tasks 1–5 done and verified (typecheck/lint/test/build all green). Blocked on two human prerequisites: link the Vercel project, enable branch protection |
| [1.2](./1.2.md) | Database, schema, and migrations | **Drafted 2026-08-04** — cannot start until a Neon instance is provisioned. Raises an AC8/AC9 scope conflict for the PO |
| [1.3](./1.3.md) | The tenant-scoped session, and keeping RLS once Drizzle owns the schema | **Draft, not Approved** — drafted two ahead on 2026-08-04. ACs 1–3 are solid; **ACs 4–6 are provisional** because they depend on choices Story 1.2's implementation makes. Re-read against the real `packages/db` before approving |
| [1.4](./1.4.md) | Authentication and organizations | **Draft, not Approved** — drafted three ahead on 2026-08-05. Surfaced the bootstrap-lookup problem and its ruling (Architecture §10.2). Depends on 1.2 and 1.3 |
| [1.5](./1.5.md) | Roles and team management | **Draft, not Approved** — 2026-08-05. Owns the audit write path (F8). Identifies AC4's last-owner rule as a **race**, not a validation check |
| [1.6](./1.6.md) | Application shell | **Draft, not Approved** — 2026-08-05. Flags AC5 as presentation needing a separate route guard; adds axe-core to CI |
| [1.7](./1.7.md) | Notification foundation | **Draft, not Approved** — 2026-08-05. Resolves [F3](../po-validation-2026-08-03.md). Puts the in-app write inside the transaction and the email after commit |

## Epic 2 — Mailbox connection and ingest

| Story | Title | Status |
|---|---|---|
| [2.1](./2.1.md) | Mailbox model and connection framework | **Draft** — flags `ENCRYPTION_KEY` as the one secret with no reset path; owns `RawMessage` |
| [2.2](./2.2.md) | Gmail connection | **Draft** — 🔴 raises **Google OAuth restricted-scope verification** as a project-level gate absent from the PRD |
| [2.3](./2.3.md) | Microsoft 365 and IMAP connections | **Draft** — `UIDVALIDITY` is the IMAP analogue of an expiring history id |
| [2.4](./2.4.md) | Inbound webhook ingest | **Draft** — verify-before-parse is the security control, not an optimisation |
| [2.5](./2.5.md) | Parsing, sanitization, and attachments | **Draft** — sanitized-only storage is a one-way door |
| [2.6](./2.6.md) | Thread resolution | **Draft** — a wrong merge is a data-exposure incident RLS cannot prevent |
| [2.7](./2.7.md) | Ingest pipeline and exactly-once processing | **Draft** — `RETURNING` is what makes "without starting a workflow" true |
| [2.8](./2.8.md) | Polling cron and backfill | **Draft** — 🔴 **backfill races live ingest**; a customer emailing during onboarding never gets a reply |

## Epic 3 — Inbox UI

| Story | Title | Status |
|---|---|---|
| [3.1](./3.1.md) | Conversation list | **Draft** — carries FE Spec §12's rejection of a virtualiser; needs a scale fixture |
| [3.2](./3.2.md) | Filtering and search | **Draft** — **owns PO finding F4's migration**, settled 08-04 and unowned until now |
| [3.3](./3.3.md) | Conversation detail | **Draft** — builds the `conversation_events` timeline merge though its producers arrive in Epics 5–6 |
| [3.4](./3.4.md) | Status, assignment, contact panel | **Draft** — AC3's rollback is the requirement, not the optimism |
| [3.5](./3.5.md) | Manual reply | **Draft** — 🔴 **three of five ACs restate Epic 6 requirements**; Epic 3 cannot meet its own goal without the outbox |
| [3.6](./3.6.md) | Live updates and keyboard navigation | **Draft** — `⌘Enter` must fire from inside the textarea |

## Epic 4 — Knowledge base

| Story | Title | Status |
|---|---|---|
| [4.1](./4.1.md) | Knowledge source management | **Draft** — owns Epic 4's schema outright, resolving a three-document ownership gap; creates `content_hash`, specified in three places and existing in none |
| [4.2](./4.2.md) | Extraction and chunking | **Draft** — zero chunks is a terminal state, not a success; a scanned PDF would otherwise report `indexed` |
| [4.3](./4.3.md) | Embedding and indexing workflow | **Draft** — takes the nightly cron from 4.5; **the chunk swap must be atomic** or a crash mid-re-index leaves a working source `indexed` with zero chunks |
| [4.4](./4.4.md) | Hybrid retrieval | **Draft** — 🔴 **RLS post-filters the HNSW scan**; at NFR7's scale the semantic half returns ~0 rows and hybrid silently becomes keyword-only. **AC5 blocked on PRD §8 Q7** |
| [4.5](./4.5.md) | Knowledge search UI | **Draft** — the only surface where a human sees the two retrieval halves separately |

## Epic 5 — AI reply engine

| Story | Title | Status |
|---|---|---|
| [5.1](./5.1.md) | Classification | **Draft** — 🔴 classifying per message and storing per conversation lets a polite message **un-escalate** an angry one. `requires_human` ruled a latch. **AC5 blocked on new PRD Q9** |
| [5.2](./5.2.md) | Agent and tools | **Draft** — reconciles the 60s agent cap with NFR3's 30s budget: the cap is the abort, ~20s the budget, per-step durations recorded |
| [5.3](./5.3.md) | Draft generation with citations | **Draft** — ✅ **Q10 closed 2026-08-07**: `confidence` is computed groundedness. AC3 has a mechanism and a writable negative control |
| [5.4](./5.4.md) | Escalation rules | **Draft** — AC5's "agreed threshold" was already §1.4's 85% and cited nowhere; recall added; two triggers get a floor |
| [5.5](./5.5.md) | Draft review panel | **Draft** — 🔴 AC5's retained draft stays `proposed`, so Epic 6 auto-sends **two replies**. Adds `superseded` + a partial unique index |
| [5.6](./5.6.md) | Persona settings and playground | **Draft** — 🔴 "identical tools" lets the playground issue a **real refund**; ruled a non-dispatching sink. Closes traceability F11's NFR4 |

## Epic 6 — Sending and automation

| Story | Title | Status |
|---|---|---|
| [6.1](./6.1.md) | Outbox and exactly-once sending | **Draft** — 🔴 §8.2's claim runs with no tenant so the drain **sends nothing**, and `RETURNING *` is a cross-tenant read. 🔴 AC5 is unimplementable behind §4.1's uniform interface |
| [6.2](./6.2.md) | Reply threading and branding | **Draft** — threading needs the inbound header chain, not `thread_key`. **AC2 needs three real mailbox accounts** |
| [6.3](./6.3.md) | Auto-send with a confidence threshold | **Draft** — ✅ **Q10 closed**, and this story's AC4 is what decided it. Only Q1's default value remains |
| [6.4](./6.4.md) | Business hours, delay, and rules | **Draft** — 🔴 AC5's overnight queue freezes a decision for 14 hours; six preconditions now re-checked at claim. Adds `tenants.timezone` |
| [6.5](./6.5.md) | Bounce and failure handling | **Draft** — 🔴 **a bounce is an inbound email**, so Epic 2 threads it, Epic 5 drafts a reply, and auto-send mails `MAILER-DAEMON`. **Requires a scope change to Story 2.5 — for the PO** |

> ### ⚠ Open for the PO — Story 2.5's scope
> Story 6.5 rules that DSN detection belongs in **Story 2.5's parse step**, before classification, because "is this a bounce" is answerable from a `Content-Type` header and must not depend on a model call that can fail open. 2.5 is `Draft, not Approved`, so the change is cheap — **recorded here rather than appended to 2.5 quietly**, which is how scope inflates (Story 1.2's lesson).

## Epic 7 — Public API and webhooks

| Story | Title | Status |
|---|---|---|
| [7.1](./7.1.md) | API key management | **Draft** — AC1 names a `scope` column that does not exist and §10.3 already assumes keys carry a role; adds both. 🔴 AC4's two counters are writes on **every** authenticated request |
| [7.2](./7.2.md) | REST API | **Draft** — 🔴 idempotency in Redis and exactly-once in Postgres leave a crash window that **sends two replies**. `GET /v1/usage` deferred to Epic 8 with a `501` |
| [7.3](./7.3.md) | Rate limiting | **Draft** — 🔴 AC1's AI limiter has no HTTP caller; rejecting drops customer email (NFR18/19). Ruled to queue, and **moved to Story 5.4** |
| [7.4](./7.4.md) | Outbound webhooks and tenant actions | **Draft** — 🔴 AC3 is a second outbox with no table, cron, or enumerator. 🔴 AC5 validates response **shape**, not content — a third untrusted channel |

> ### ⚠ Open for the PO — two scope changes Epic 7 raises
> - **Story 2.5** gains DSN detection in the parse step (from Story 6.5), so a bounce never reaches classification.
> - **Story 5.4** gains the per-tenant AI rate limit (from Story 7.3). It belongs there because that story already built the degraded-path surface — a conversation that appears, flagged, with a stated reason — and the limit must **queue rather than reject**, or NFR18 and NFR19 are both violated on a tenant's busiest day.
>
> Both target stories are `Draft, not Approved`, so both are cheap now. **Recorded here rather than appended quietly** — Story 1.2's lesson.

## Epic 8 — Analytics, billing, and hardening

| Story | Title | Status |
|---|---|---|
| [8.1](./8.1.md) | Analytics dashboard | **Draft** — 🔴 §1.4's deflection rate includes "no follow-up complaint", which nothing could measure. Story 5.1's per-message classification makes it computable |
| [8.2](./8.2.md) | Usage metering and billing | **Draft** — 🔴 an hourly rollup accumulating into a monthly bucket **overbills on retry**; ruled aggregate-not-accumulate. Turns on `GET /v1/usage` |
| [8.3](./8.3.md) | Observability and error handling | **Draft** — 🔴 AC2's "no PII" is violated by Sentry's defaults, and the most diagnostic errors carry the most personal payloads |
| [8.4](./8.4.md) | Security hardening and compliance | **Draft** — 🔴 the 30-day soft-delete window had **no column**, so `purge-blobs` had no predicate. **AC4 needs a booked pen test — weeks** |
| [8.5](./8.5.md) | Load testing and evals | **Draft** — owns the evidence PRD Q10 deferred option C to; splits the load test into a stubbed ingest run and a priced full-path one |

**Forty-six stories drafted — all eight epics.** Drafting is complete. Story 1.1 is at Review; the other forty-five are Draft, none Approved, each naming what it waits on. Every PO finding is resolved, so no epic is blocked editorially — **F4's migration is owned by Story 3.2.**

> ### ⚠ Whole-corpus pass, 2026-08-07 — three findings, all applied
> Run once, after all forty-six existed. **Eleven of eighteen tables had no creating story** — `messages` (referenced by 23 stories) and `drafts` (20) among them — because `migrations/0001` creates all sixteen correctly and §6.8c never applies it to Neon. Every epic's first story now owns its epic's schema (§6.7d). **Stories 2.4 and 2.7 depended on each other**, so neither could be approved first; "dedup" named a constraint and a pipeline guarantee, and splitting the noun broke the cycle. **One scale fixture had two builders** — Story 3.1's and Story 8.5's — under two names, four epics apart.
>
> All three needed every story to exist to be visible, and none was findable by reading.

> ### What drafting produced
> **Every epic yielded at least one defect that would have shipped green**, and the ones that mattered most were found by comparing an epic's *requirements* to an earlier epic's *design* — a comparison no pass inside a single epic can make. The severe ones, in order of how quietly they would have failed:
>
> | | Would have |
> |---|---|
> | RLS post-filters the HNSW scan (4.4) | Silently reduced hybrid retrieval to keyword-only at 500 tenants, **while making the latency target easier to hit** |
> | A bounce is an inbound email (6.5) | Had the product **auto-reply to `MAILER-DAEMON`** in a loop |
> | Regenerate leaves two live drafts (5.5) | Sent **two replies** to one customer, with every exactly-once guarantee satisfied |
> | A polite follow-up un-escalates (5.1) | Dropped an angry customer out of the escalation queue, unread |
> | The playground dispatches for real (5.6) | Let an admin **issue a refund** by testing the bot |
> | An accumulating rollup (8.2) | **Overbilled** every tenant after any retry |

## Story lifecycle

```
SM drafts → Approved → Dev implements → Review → QA gate → PO marks Done → SM drafts next
```

A story file is **self-contained**: the SM embeds the relevant architecture excerpts into it so the Dev agent never has to go hunting. If the Dev agent needs to open `Email Engine Architecture.md`, the story was drafted badly.

## Before drafting or reviewing

Run [`docs/drafting-checklist.md`](../drafting-checklist.md). Every check in it found a real defect on this project and names the finding that earned it — it is a record of what has actually gone wrong here, not a generic quality list.

The two that have paid off most often: **if more than two stories describe a thing, ask which one builds it** (F3, F8, SB-1), and **read every acceptance criterion for a race** (Story 1.5 AC4, front-end spec send-undo).

## Drafting convention — cite the FRs

> **Every story file carries a `Delivers` row naming the FR numbers it satisfies** (or stating plainly that it delivers none, as 1.1 does).
>
> Adopted 2026-08-04 on the [traceability matrix](../prd/traceability.md)'s own recommendation. The matrix exists because the epics cite no FR numbers, which is how **F3** (four stories notifying, none building notification) and **F8** (three stories writing audit events, none building the audit path) both survived three careful readings. A capability that appears only as somebody else's secondary acceptance criterion has no owner — and citing FRs makes that visible while the story is being drafted, rather than months later in a table.
