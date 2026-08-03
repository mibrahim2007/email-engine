---
title: Email Engine — Product Requirements Document
type: project
status: active
created: 2026-08-01
updated: 2026-08-01
due:
area:
tags:
  - project
  - prd
  - saas
  - bmad
---

# 📋 Email Engine — Product Requirements Document

> **BMAD artifact:** PM. Consumes the project brief, produces the FRs, NFRs, and epic/story breakdown that the Architect turns into [[Email Engine Architecture]] and the SM turns into story files.

| | |
|---|---|
| **Version** | 1.0 |
| **Status** | Draft — pending PO master checklist |
| **Owner** | PM agent |
| **Downstream** | [[Email Engine Architecture]] (written), [[Email Engine Front-End Spec]] (written 2026-08-03) |

---

## 1. Goals and background context

### 1.1 Goals

- A support team connects a shared mailbox and sees AI-drafted, source-cited replies waiting for them within 30 seconds of an email arriving.
- Teams deflect at least 40% of routine email volume to fully automated replies without a measurable drop in customer satisfaction.
- A new tenant goes from signup to first AI draft in under 10 minutes, with no engineering involvement.
- Every automated reply is traceable — which knowledge chunks grounded it, which model produced it, who approved it.
- Tenant data isolation is provable, not asserted, so the product can be sold into security-reviewed accounts.

### 1.2 Background context

Support teams running shared mailboxes (`support@`, `billing@`, `orders@`) spend most of their day answering questions the company has already answered in writing. Existing helpdesks (Zendesk, Front, Help Scout) organize that work but don't reduce it; the AI features they've bolted on are macro-suggestion tools that don't read the company's own documentation. Meanwhile, generic AI chat widgets live on the website, not in the inbox — which is where B2B customers actually write.

Email Engine sits in the mailbox. It ingests every message, retrieves the tenant's own knowledge, drafts a grounded reply with citations, and either sends it or queues it for a human depending on a confidence threshold the tenant controls. The differentiator is not "AI writes emails" — it's the supervision surface: the human sees the confidence, the sources, and the tool calls, and can move the threshold as trust builds.

The wedge is teams of 3–20 handling 200–5,000 emails/month who have documentation but no capacity. They are too small for a Zendesk implementation project and too big for a shared Gmail inbox.

### 1.3 Target users

**Primary — Support lead ("Priya").** Runs a 4-person support team at a 60-person SaaS. Owns first-response-time and CSAT numbers. Wants volume reduced without her team losing visibility or the company sending something embarrassing. She is the buyer and the person who sets the auto-send threshold.

**Secondary — Support agent ("Marco").** Lives in the inbox 6 hours a day. Judges the product on whether the draft is good enough to send with one edit, and whether the keyboard shortcuts keep up with him. Will abandon it if reviewing drafts is slower than writing replies.

**Tertiary — Technical admin ("Dana").** Connects the mailbox, wires the order-lookup webhook, integrates the REST API with internal tooling. Needs the OAuth flow to work first try and the API to be boring.

### 1.4 Success metrics

| Metric | Target (90 days post-launch) |
|---|---|
| Deflection rate (auto-sent, no human touch, no follow-up complaint) | ≥ 40% of eligible conversations |
| Draft acceptance (sent with no edit or minor edit) | ≥ 70% |
| Median first-response time vs. tenant's pre-launch baseline | −60% |
| Time from signup to first AI draft | < 10 minutes p75 |
| Escalation precision (flagged for human *and* human agreed) | ≥ 85% |
| Weekly active agents / seats | ≥ 60% |
| Cross-tenant data incidents | 0 — non-negotiable |

### 1.5 MVP scope boundary

**In:** email ingest from Gmail/Outlook/IMAP/webhook, thread stitching, knowledge base, AI classification and drafting with citations, human review, auto-send with a threshold, outbound sending with correct threading, multi-user teams, public REST API, usage-based billing.

**Out (post-MVP, explicitly):**
- Live chat, SMS, WhatsApp, or social channels — email only.
- Full ticketing (SLAs, macros, custom workflows, CSAT surveys). This is a reply engine, not a helpdesk replacement.
- Multi-language reply generation beyond detect-and-escalate. Detection ships; non-English drafting does not.
- Voice/phone, mobile native apps, browser extension.
- Fine-tuning or per-tenant model training. Retrieval only.
- On-prem or BYO-cloud deployment.

### 1.6 Change log

| Date | Version | Change | Author |
|---|---|---|---|
| 2026-08-01 | 1.0 | Initial PRD | PM agent |

---

## 2. Requirements

### 2.1 Functional requirements

**Tenancy and identity**

- **FR1** — The system shall support multiple isolated tenants, where a tenant maps to a Clerk Organization and owns all mailboxes, conversations, knowledge, and settings created within it.
- **FR2** — A user shall be able to belong to multiple tenants and switch between them without re-authenticating.
- **FR3** — The system shall enforce four roles — `owner`, `admin`, `agent`, `viewer` — where `viewer` cannot mutate, `agent` cannot change tenant settings or billing, and `owner` cannot be removed by an `admin`.
- **FR4** — Owners and admins shall be able to invite, remove, and re-role members.
- **FR5** — No query, API call, or AI tool invocation shall be able to read or write data belonging to a tenant other than the one in the authenticated context.

**Mailbox connection**

- **FR6** — A tenant shall be able to connect a Gmail mailbox via OAuth, granting read and send scopes.
- **FR7** — A tenant shall be able to connect a Microsoft 365 mailbox via Microsoft Graph OAuth.
- **FR8** — A tenant shall be able to connect a generic mailbox via IMAP/SMTP credentials.
- **FR9** — A tenant shall be able to receive mail via a provider-forwarded inbound webhook without granting mailbox access.
- **FR10** — The system shall store mailbox credentials encrypted at rest and refresh OAuth tokens automatically before expiry.
- **FR11** — The system shall display connection health per mailbox and notify admins when a connection breaks.
- **FR12** — On connection, the system shall backfill the previous 30 days of mail without blocking live ingest.

**Ingest and threading**

- **FR13** — The system shall ingest new inbound messages within 2 minutes of arrival (webhook: within 10 seconds).
- **FR14** — The system shall process each provider message exactly once, regardless of webhook redelivery or overlapping polls.
- **FR15** — The system shall parse MIME into plain text, sanitized HTML, and a snippet, and extract attachments to durable storage.
- **FR16** — The system shall group messages into conversations using standard email threading headers, falling back to subject and participant heuristics.
- **FR17** — The system shall strip quoted history from the displayed body while keeping it expandable.
- **FR18** — The system shall never render inbound HTML without sanitization, and shall block remote images by default.

**Inbox**

- **FR19** — Agents shall see a conversation list filterable by status, assignee, intent, mailbox, and free-text search, sorted by most recent activity.
- **FR20** — Agents shall be able to open a conversation and see the full message history with sender, timestamps, and attachments.
- **FR21** — Agents shall be able to change conversation status (`open`, `pending`, `resolved`, `spam`) and assign a conversation to a team member.
- **FR22** — The inbox shall reflect new messages and status changes made by teammates without a manual refresh.
- **FR23** — Agents shall be able to navigate and action the inbox by keyboard, including a command palette.
- **FR24** — Agents shall see a contact panel with the sender's history and custom fields.

**Knowledge base**

- **FR25** — Admins shall be able to add knowledge sources as a URL, an uploaded file (PDF, DOCX, MD, TXT, HTML), pasted text, or a structured FAQ pair.
- **FR26** — The system shall extract, chunk, and embed each source, and display indexing status and errors per source.
- **FR27** — The system shall re-index a source on demand and on a nightly schedule, skipping unchanged content.
- **FR28** — Admins shall be able to search the knowledge base directly and see which chunks match and with what score.
- **FR29** — Knowledge retrieval shall combine semantic and keyword search and return results scoped to the tenant.

**AI classification and drafting**

- **FR30** — The system shall classify every inbound message with intent, sentiment, urgency, detected language, and a human-required flag.
- **FR31** — The system shall generate a reply draft for every classified message that does not require a human, grounded in retrieved knowledge.
- **FR32** — Each draft shall carry a confidence score, the citations that grounded it, the model used, and the tool calls made.
- **FR33** — The AI agent shall be able to search the knowledge base, look up a contact, call a tenant-registered webhook, and escalate to a human.
- **FR34** — The system shall escalate rather than draft when the message is in an unsupported language, contains detected PII beyond a threshold, expresses strong negative sentiment, or the agent's own confidence is below a floor.
- **FR35** — Admins shall be able to configure a tenant persona: tone, formality, signature, prohibited topics, and standard disclaimers.
- **FR36** — Admins shall be able to test the bot in a playground that uses the identical agent, tools, and knowledge as production, and shows the tool-call trace.
- **FR37** — The system shall never allow content inside an inbound email or a retrieved document to authorize a tool call or override the system prompt.

**Review and sending**

- **FR38** — Agents shall be able to approve, edit-then-send, regenerate, or reject a draft, and the outcome shall be recorded.
- **FR39** — The system shall send outbound replies with correct threading headers so they appear in the customer's existing thread.
- **FR40** — The system shall apply the tenant's signature and branding to outbound mail.
- **FR41** — The system shall send each outbound message exactly once, even under concurrent send attempts or retries.
- **FR42** — Admins shall be able to enable auto-send and set a confidence threshold above which drafts send without human review.
- **FR43** — Admins shall be able to restrict auto-send to business hours and to apply a configurable delay before sending.
- **FR44** — The system shall detect bounces and delivery failures and surface them on the conversation.
- **FR45** — Agents shall be able to reply manually at any time, bypassing the AI entirely.

**API, webhooks, and integration**

- **FR46** — Admins shall be able to create, name, scope, and revoke API keys, with the key value shown once.
- **FR47** — The system shall expose a versioned REST API covering conversations, messages, drafts, knowledge sources, search, and usage.
- **FR48** — The system shall deliver signed webhooks for message received, draft created, reply sent, conversation escalated, and conversation resolved, with retries.
- **FR49** — Admins shall be able to register an outbound action webhook the AI agent may call, restricted to a pre-registered URL.

**Analytics, billing, admin**

- **FR50** — Tenants shall see volume, deflection rate, draft acceptance rate, first-response time, and escalation reasons over a selectable period.
- **FR51** — The system shall record per-tenant usage (messages processed, AI replies, tokens) and report it for billing.
- **FR52** — Tenants shall be able to subscribe, upgrade, downgrade, and view invoices, with plan limits enforced.
- **FR53** — The system shall write an append-only audit event for every state change, recording actor, action, entity, and time.
- **FR54** — Tenants shall be able to export all their data and request full deletion.

### 2.2 Non-functional requirements

**Performance**

- **NFR1** — Dashboard LCP under 1.8s at p75; inbox interaction (INP) under 200ms at p75.
- **NFR2** — Conversation detail server response under 300ms at p95.
- **NFR3** — Inbound message to draft-ready under 30s at p95.
- **NFR4** — Chat playground first token under 1.5s at p95.
- **NFR5** — Knowledge retrieval under 150ms at p95.
- **NFR6** — Client JavaScript for the dashboard under 200KB gzipped.

**Scale**

- **NFR7** — Support 500 tenants, 50,000 conversations per tenant, and 5,000 knowledge chunks per tenant without architectural change.
- **NFR8** — Sustain 50 inbound messages/second in aggregate with the ingest queue draining faster than it fills.
- **NFR9** — Query performance shall not degrade with tenant count — no full-table scans on tenant-partitioned data.

**Security**

- **NFR10** — Tenant isolation shall be enforced at the database layer, such that an application-code error cannot cross tenants.
- **NFR11** — Mailbox credentials and API keys shall be encrypted or hashed at rest; plaintext shall never be logged or returned after creation.
- **NFR12** — All inbound webhooks shall be signature- and timestamp-verified before any processing.
- **NFR13** — Rendered email HTML shall be sanitized against an allow-list and sandboxed with a strict CSP.
- **NFR14** — The system shall resist prompt injection from email bodies and retrieved documents; a documented adversarial corpus shall pass on every release.
- **NFR15** — Audit events shall be immutable to the application role.
- **NFR16** — All traffic shall be TLS 1.2+; HSTS enforced.

**Reliability**

- **NFR17** — 99.9% monthly availability for the dashboard and ingest path.
- **NFR18** — No inbound message shall be lost due to a transient provider or model failure; every pipeline step shall be retryable and idempotent.
- **NFR19** — A model provider outage shall degrade to queued drafts and human review, not to dropped mail.
- **NFR20** — Database point-in-time recovery to any moment in the last 7 days.

**Compliance and operability**

- **NFR21** — GDPR-supporting export and erasure within 30 days of request.
- **NFR22** — Data region shall be a tenant-level attribute, even if only one region is offered at launch.
- **NFR23** — Every error surfaced to a user shall be actionable; silent AI failures are prohibited — a failed draft shall appear in the conversation timeline.
- **NFR24** — WCAG 2.1 AA for all authenticated screens.
- **NFR25** — The system shall run on a single-vendor serverless platform with no self-managed infrastructure.

---

## 3. User interface design goals

### 3.1 UX vision

The inbox should feel like a fast email client that happens to have already written the reply — not like a dashboard with an AI panel bolted on. The primary loop is *read the draft, glance at the confidence and sources, hit send*. Everything else is secondary chrome. If reviewing a draft takes longer than writing a reply from scratch, the product has failed regardless of model quality.

Trust is built by exposure, not by claims: the confidence score, the cited sources, and the tool trace are always one click away. Agents move the auto-send threshold up because they've watched it work, not because we told them to.

### 3.2 Key interaction paradigms

- **Keyboard-first.** `j`/`k` to move, `Enter` to open, `e` to resolve, `a` to assign, `⌘Enter` to send, `⌘K` for the command palette. A power agent should never touch the mouse in the review loop.
- **Progressive disclosure of AI.** The draft is text in a compose box. Confidence is a small meter. Citations are hover-cards. The tool trace lives behind a disclosure. Nothing about the machinery is in the way of sending.
- **Optimistic everything.** Status changes, assignment, and resolution apply instantly and reconcile in the background.
- **Escalation is a first-class state,** not an error. When the AI declines to draft, it says why, in one plain sentence, in the conversation.

### 3.3 Core screens

| Screen | Purpose |
|---|---|
| **Inbox** | Filterable conversation list; the default landing page |
| **Conversation** | Thread + contact panel + draft review panel |
| **Playground** | Test the bot conversationally; see tool calls |
| **Knowledge** | Source list, upload, index status, direct search |
| **Analytics** | Volume, deflection, response time, escalation reasons |
| **Settings → Mailboxes** | Connect, health, backfill status |
| **Settings → Persona** | Tone, signature, prohibited topics, auto-send threshold |
| **Settings → Team** | Members, roles, invites |
| **Settings → API keys** | Create, revoke, webhook subscriptions |
| **Settings → Billing** | Plan, usage, invoices |
| **Onboarding** | Connect mailbox → add knowledge → see first draft |

### 3.4 Accessibility

WCAG 2.1 AA. Radix primitives via shadcn/ui give keyboard and ARIA behavior; the obligation is on custom composites. Confidence must never be communicated by color alone — the meter carries a numeral and a label. All interactive targets ≥ 44px on touch. Focus order in the conversation view goes thread → draft → send, matching the task.

### 3.5 Branding

Clean, dense, product-neutral — closer to Linear than to Salesforce. Tenants can override brand color and logo for their own dashboard; those overrides apply as runtime CSS custom properties, never a rebuild. Outbound email branding (signature, logo, footer) is separately configurable and is what the tenant's customers actually see.

### 3.6 Target platforms

Responsive web, desktop-first. The review loop is a desktop task; the mobile breakpoint targets triage — read, resolve, assign, escalate — not composing. No native apps in MVP.

---

## 4. Technical assumptions

These are decisions the PM is making as constraints on the Architect. The rationale and the detailed design live in [[Email Engine Architecture]].

- **Repository structure:** Monorepo (Turborepo, npm workspaces). Shared types between the app, workflows, and DB are the deciding factor.
- **Service architecture:** Serverless, event-driven monolith on Vercel. No microservices at this scale; the async pipeline is separated by durable workflows, not by services.
- **Database:** PostgreSQL. Required for row-level security, `pgvector`, and partial indexes. Tenant isolation is a DB responsibility, not an application one.
- **AI access:** Through Vercel AI Gateway only. **No direct provider SDKs and no per-provider API keys in the deployment.** Model choice must be configuration, and provider failover must not require a code change.
- **Frontend:** Next.js App Router with React Server Components; Tailwind CSS v4 and shadcn/ui. Components are owned in-repo, not consumed as a dependency.
- **Auth:** Clerk with Organizations. Building tenant-aware auth is not a differentiator.
- **Testing requirements:** Full pyramid. Two suites are merge blockers: tenant isolation (RLS) and send-exactly-once. AI quality is measured by a nightly eval set that reports regressions but does not block merges.
- **Deployment:** Vercel, preview deployment per PR with a database branch. Migrations must be backward-compatible with the previous deploy (expand/contract).

---

## 5. Epic list

Each epic ends with something deployable and demonstrable. Sequencing is deliberate: tenancy before data, ingest before UI, UI before AI, AI before automation. No epic depends on a later one.

| # | Epic | Ends with |
|---|---|---|
| **1** | Foundation and tenancy | Two orgs sign up and provably cannot see each other's data |
| **2** | Mailbox connection and ingest | Connected mailbox's email appears in the app within 2 minutes |
| **3** | Inbox UI | A human can work the inbox end-to-end without any AI |
| **4** | Knowledge base | KB search returns relevant, tenant-scoped, scored chunks |
| **5** | AI reply engine | Every inbound email gets a reviewable, cited draft |
| **6** | Sending and automation | High-confidence replies send themselves; the rest wait |
| **7** | Public API and webhooks | A customer can drive the platform without the UI |
| **8** | Analytics, billing, hardening | The product can take money and be operated |

---

## 6. Epic details

> Story format: `As a <role>, I want <capability>, so that <benefit>.` Acceptance criteria are testable and numbered. The SM expands each story into a self-contained story file with the relevant architecture excerpts embedded.

### Epic 1 — Foundation and tenancy

**Goal:** stand up the deployable skeleton and the isolation guarantee everything else rests on. Nothing ships after this epic that could leak data across tenants.

---

**Story 1.1 — Monorepo and deployment skeleton**
*As a developer, I want a deployable monorepo with CI, so that every later story lands in a working pipeline.*

1. Turborepo monorepo with `apps/web` and `packages/{db,email,ai,ui,config}` per the architecture's source tree.
2. Next.js App Router app builds, typechecks, and lints with zero errors.
3. `/api/health` returns `{ status, version, commit }` and is reachable on a deployed URL.
4. Pushing to a branch produces a Vercel preview deployment.
5. CI runs typecheck, lint, and unit tests on every PR and blocks merge on failure.

---

**Story 1.2 — Database, schema, and migrations**
*As a developer, I want Postgres provisioned with a migration workflow, so that schema changes are versioned and reviewable.*

1. Neon Postgres provisioned via Vercel Marketplace; `DATABASE_URL` and unpooled variant set in all three environments.
2. `pgcrypto`, `vector`, and `pg_trgm` extensions enabled.
3. Drizzle schema defines `tenants`, `users`, `memberships` with the fields in the architecture data models.
4. `drizzle-kit generate` produces a checked-in migration; `migrate` applies cleanly to an empty database.
5. CI fails if the committed schema and migrations have drifted.
6. A seed script creates two tenants with distinct users for local development.

---

**Story 1.3 — Row-level security and the isolation test suite**
*As a security-conscious buyer, I want tenant isolation enforced by the database, so that an application bug cannot expose another customer's mail.*

1. Every table with a `tenant_id` column has RLS `ENABLED` and `FORCED`, with a policy carrying both `USING` and `WITH CHECK`.
2. The application connects as a role that is not the table owner and lacks `BYPASSRLS`.
3. `withTenant()` opens a transaction and sets `app.tenant_id` transaction-locally; no repository function accepts a connection obtained any other way.
4. An automated suite seeds two tenants and asserts, per table, that tenant A's session cannot `SELECT`, `UPDATE`, `DELETE`, or `INSERT` against tenant B's rows.
5. A schema-walking test fails the build if any table with a `tenant_id` column lacks a forced policy.
6. This suite runs on every PR and blocks merge.

---

**Story 1.4 — Authentication and organizations**
*As a user, I want to sign up and belong to an organization, so that my team shares a workspace.*

1. Clerk sign-up, sign-in, and sign-out work; unauthenticated access to `(app)` routes redirects to sign-in.
2. Creating a Clerk Organization creates a corresponding `tenants` row via a verified webhook, idempotently.
3. `requireTenant()` resolves the tenant from the session's `org_id` and rejects a session with no active organization.
4. A user in two organizations can switch between them and the data shown changes accordingly.
5. Clerk webhook signature verification rejects unsigned or stale payloads.

---

**Story 1.5 — Roles and team management**
*As an owner, I want to invite teammates with roles, so that access matches responsibility.*

1. Roles `owner`, `admin`, `agent`, `viewer` are stored on membership and mapped from Clerk organization roles.
2. `requireRole()` guards every mutation; a `viewer` receives 403 on any write.
3. Owners and admins can invite by email, remove members, and change roles from the Team settings screen.
4. The last remaining `owner` cannot be removed or demoted.
5. Every membership change writes an audit event.

---

**Story 1.6 — Application shell**
*As a user, I want a consistent navigation shell, so that the product feels like one application.*

1. `(app)` layout renders sidebar, organization switcher, user menu, and content area.
2. shadcn/ui is initialized in `packages/ui`; Tailwind v4 theme tokens are defined CSS-first with light and dark values.
3. Dark mode follows the system preference and can be toggled, persisting across sessions.
4. The shell is responsive to 768px and passes an automated accessibility scan with no critical violations.
5. Navigation items reflect the current user's role — billing is hidden from `agent` and `viewer`.

---

### Epic 2 — Mailbox connection and ingest

**Goal:** get real mail into the system, exactly once, correctly threaded and safely parsed. No AI, no UI beyond connection status.

---

**Story 2.1 — Mailbox model and connection framework**
*As a developer, I want a provider-agnostic mailbox interface, so that ingest logic never branches on provider.*

1. `mailboxes` table and RLS policy exist per the architecture.
2. A `MailboxConnector` interface defines `connect`, `refresh`, `fetchSince`, `send`, and `revoke`.
3. Credentials are encrypted with AES-256-GCM before storage; the key comes from `ENCRYPTION_KEY` and is never persisted in the database.
4. Credentials never appear in logs, error messages, or API responses.
5. Connection health (`sync_state`, `last_synced_at`, last error) is readable per mailbox.

---

**Story 2.2 — Gmail connection**
*As an admin, I want to connect a Gmail mailbox, so that the platform can read and reply to our support mail.*

1. OAuth flow requests read and send scopes and completes to a connected mailbox record.
2. Refresh tokens are stored encrypted and refreshed automatically before expiry.
3. `fetchSince(cursor)` returns new messages using the Gmail history id as the cursor.
4. Revoking the connection removes stored credentials and marks the mailbox inactive.
5. A revoked or expired grant sets an error state and notifies admins rather than failing silently.

---

**Story 2.3 — Microsoft 365 and IMAP connections**
*As an admin, I want to connect Outlook or a generic IMAP mailbox, so that we aren't required to use Gmail.*

1. Microsoft Graph OAuth completes and supports fetch and send with delta-token cursors.
2. IMAP connection accepts host, port, TLS mode, username, and password, and validates by connecting before saving.
3. IMAP fetch uses UIDs as the cursor and does not re-fetch previously seen messages.
4. All three providers pass the same connector conformance test suite.
5. Connection failures produce a specific, actionable error message, not a generic failure.

---

**Story 2.4 — Inbound webhook ingest**
*As an admin, I want to forward mail to a webhook address, so that I can use the product without granting mailbox access.*

1. `/api/webhooks/inbound` verifies the provider HMAC signature and timestamp before any parsing.
2. An unsigned, mis-signed, or stale payload is rejected with 401 and no side effects.
3. A verified payload is normalized to the same internal shape as polled messages.
4. The endpoint responds within 2 seconds by handing off to a workflow rather than processing inline.
5. The tenant is resolved from the routing address; an unknown address is rejected without creating data.

---

**Story 2.5 — Parsing, sanitization, and attachments**
*As an agent, I want email content rendered safely and readably, so that I can read it without risking the browser.*

1. MIME is parsed into `body_text`, `body_html_sanitized`, and a snippet.
2. HTML is sanitized against an allow-list; scripts, event handlers, and external stylesheets are removed.
3. A documented XSS corpus produces no script execution and no external resource load.
4. Remote images are blocked by default with an explicit "show images" affordance.
5. Attachments are uploaded to Blob storage with content type, size, and checksum recorded; oversized or disallowed types are rejected with a recorded reason.

---

**Story 2.6 — Thread resolution**
*As an agent, I want replies grouped into one conversation, so that I read a thread, not scattered messages.*

1. Messages are grouped using `Message-ID`, `In-Reply-To`, and `References`.
2. When headers are missing or broken, normalized subject plus participant set within a 30-day window is used as a fallback.
3. A fixture corpus of real-world reply chains from Gmail, Outlook, Apple Mail, and mobile clients threads correctly.
4. Conversation `last_message_at` and `subject` update as messages arrive.
5. A new conversation is created when no match is found, never a wrong-thread merge.

---

**Story 2.7 — Ingest pipeline and exactly-once processing**
*As an operator, I want each message processed exactly once, so that customers never receive duplicate handling.*

1. `UNIQUE (tenant_id, provider_message_id)` enforces deduplication at the database level.
2. Insert uses `ON CONFLICT DO NOTHING`; a duplicate returns success without starting a workflow.
3. Delivering the same webhook payload five times concurrently produces exactly one message row and one workflow run.
4. Poll and webhook arriving for the same message produce one row.
5. The ingest workflow is idempotent per step and resumes correctly after a simulated crash mid-pipeline.

---

**Story 2.8 — Polling cron and backfill**
*As an admin, I want history and continuous sync, so that the product is useful the moment I connect.*

1. A cron runs every 2 minutes and polls all active mailboxes, respecting per-provider rate limits.
2. Connecting a mailbox starts a backfill workflow covering the previous 30 days.
3. Backfill is throttled so it never starves live ingest, and reports progress in the UI.
4. Backfilled messages are marked as historical and do not trigger drafting or notifications.
5. A mailbox failing repeatedly is backed off exponentially and flagged, not polled in a tight loop.

---

### Epic 3 — Inbox UI

**Goal:** a support team could use the product today with zero AI. This epic proves the data model and the interaction speed before any model cost is incurred.

---

**Story 3.1 — Conversation list**
*As an agent, I want a fast list of conversations, so that I can see what needs attention.*

1. The inbox renders as a Server Component, sorted by `last_message_at` descending.
2. Each row shows sender, subject, snippet, status, assignee avatar, message count, and relative time.
3. Cursor pagination loads more without a full page reload; the list handles 50,000 conversations without degradation.
4. Empty, loading, and error states are designed, not default.
5. Server response for the first page is under 300ms at p95 against seeded production-scale data.

---

**Story 3.2 — Filtering and search**
*As an agent, I want to narrow the list, so that I can work a queue instead of an ocean.*

1. Filters for status, assignee, mailbox, and date range combine and are reflected in the URL.
2. Free-text search covers subject, sender, and body with trigram-assisted matching.
3. Filter state survives refresh and back-navigation.
4. Saved views ("Unassigned", "Mine", "Needs human") are one click from the sidebar.
5. Search returns in under 500ms at p95 at target scale.

---

**Story 3.3 — Conversation detail**
*As an agent, I want to read a full thread, so that I have the context to reply.*

1. Messages render chronologically with sender, recipients, timestamp, and direction clearly distinct.
2. Quoted history is collapsed by default and expandable inline.
3. Sanitized HTML renders inside a sandboxed iframe with a strict CSP.
4. Attachments are listed with type icons and download via signed, expiring URLs.
5. The view is dynamic and never served from cache.

---

**Story 3.4 — Status, assignment, and contact panel**
*As an agent, I want to triage a conversation, so that work is distributed and tracked.*

1. Status can be changed to `open`, `pending`, `resolved`, or `spam` from the list and the detail view.
2. A conversation can be assigned to any member; assignment notifies the assignee.
3. Changes apply optimistically and reconcile; a failure rolls back visibly with an explanation.
4. The contact panel shows the sender's name, company, custom fields, and prior conversations.
5. Every status and assignment change writes an audit event.

---

**Story 3.5 — Manual reply**
*As an agent, I want to write and send a reply myself, so that I am never blocked by the AI.*

1. A composer supports plain text with basic formatting and renders both HTML and text parts.
2. The reply threads correctly into the customer's existing thread.
3. The tenant signature is appended and previewable.
4. Send is disabled while in flight and shows an unambiguous result.
5. A sent reply appears in the thread immediately and sets `first_response_at` if unset.

---

**Story 3.6 — Live updates and keyboard navigation**
*As an agent, I want the inbox to keep up with me and my team, so that I never work from a stale view.*

1. New messages and teammate changes appear within 10 seconds without a manual refresh.
2. `j`/`k`/`Enter`/`e`/`a`/`⌘Enter` shortcuts work as specified, with a discoverable shortcut sheet.
3. `⌘K` opens a command palette for navigation, search, and conversation actions.
4. Polling pauses when the tab is hidden and resumes on focus.
5. Keyboard focus order matches visual order and all actions are reachable without a mouse.

---

### Epic 4 — Knowledge base

**Goal:** the tenant's own documentation becomes searchable, scoped, and citable. Retrieval quality is validated before any drafting depends on it.

---

**Story 4.1 — Knowledge source management**
*As an admin, I want to add our documentation, so that the bot answers from our content rather than guessing.*

1. Sources can be created as URL, uploaded file (PDF, DOCX, MD, TXT, HTML), pasted text, or FAQ pair.
2. `kb_sources` and `kb_chunks` tables exist with RLS policies and the `vector(1536)` column.
3. Sources list shows title, type, status, chunk count, and last indexed time.
4. A source can be deleted, cascading to its chunks and removing embeddings.
5. Upload validates size and type before storage and reports rejection reasons clearly.

---

**Story 4.2 — Extraction and chunking**
*As a developer, I want documents split into retrievable units, so that retrieval returns focused context.*

1. Text is extracted from each supported format, preserving heading structure where available.
2. Chunks target ~500 tokens with ~15% overlap and do not split mid-heading-section.
3. Token counts are recorded per chunk.
4. Extraction failures set an error status with a readable message rather than leaving the source pending.
5. A fixture corpus of messy real-world documents chunks without crashing or producing empty chunks.

---

**Story 4.3 — Embedding and indexing workflow**
*As an admin, I want indexing to happen reliably in the background, so that adding a large document doesn't block me.*

1. Indexing runs as a durable workflow with per-step checkpoints.
2. Embeddings are generated in batches through the AI Gateway and written with their chunks.
3. Indexing status and progress are visible in the UI and update as the workflow proceeds.
4. A failed embedding batch retries without re-extracting or re-chunking.
5. Re-indexing skips chunks whose content hash is unchanged.

---

**Story 4.4 — Hybrid retrieval**
*As a developer, I want retrieval that handles both paraphrase and exact terms, so that product names and error codes are findable.*

1. Semantic search uses an HNSW index on cosine distance; keyword search uses a GIN index on `tsvector`.
2. Results are merged with Reciprocal Rank Fusion and trimmed to a token budget.
3. Results are tenant-scoped by RLS with no `tenant_id` predicate in the query.
4. Retrieval returns in under 150ms at p95 with 5,000 chunks per tenant.
5. A labeled relevance set achieves the agreed recall@8 target before Epic 5 begins.

---

**Story 4.5 — Knowledge search UI**
*As an admin, I want to search the knowledge base myself, so that I can tell whether the bot will find the right answer.*

1. A search box returns ranked chunks with content preview, source, and score.
2. Each result links to its source and shows why it matched (semantic, keyword, or both).
3. Zero-result queries suggest what to add.
4. Nightly re-index runs on a cron and reports changes.
5. Admins can trigger re-index of a single source on demand.

---

### Epic 5 — AI reply engine

**Goal:** every inbound email gets a grounded, cited, reviewable draft. Nothing sends automatically yet — this epic is about draft quality and the supervision surface.

---

**Story 5.1 — Classification**
*As an agent, I want incoming mail categorized, so that I can prioritize and the system can route.*

1. Every inbound message is classified into intent, sentiment, urgency, language, PII detected, and requires-human.
2. Classification uses structured output with a validated schema and runs on a fast model tier.
3. Results are persisted on the conversation and shown as badges in the inbox.
4. Classification failure marks the message for human handling rather than blocking the pipeline.
5. Accuracy against a labeled set meets the agreed threshold before drafting is enabled.

---

**Story 5.2 — Agent and tools**
*As a developer, I want a tool-calling agent, so that replies can use knowledge and data rather than only the prompt.*

1. The agent exposes `search_knowledge_base`, `lookup_customer`, `call_tenant_webhook`, and `escalate_to_human`.
2. The loop is capped at 8 tool steps and 60 seconds of wall clock.
3. All model access goes through Vercel AI Gateway; no provider SDK is present in the dependency tree.
4. Tool inputs and outputs are recorded for every run.
5. Exceeding a cap ends the run cleanly with an escalation, not a partial or hung draft.

---

**Story 5.3 — Draft generation with citations**
*As an agent, I want a draft with its sources, so that I can verify it in seconds instead of re-researching.*

1. Drafts are generated for classified messages that do not require a human.
2. Each draft records body text and HTML, confidence, citations, model, and tool calls.
3. Every factual claim maps to a retrieved chunk; ungrounded claims lower the confidence.
4. The draft respects the tenant persona — tone, formality, prohibited topics, disclaimers.
5. Drafts appear within 30 seconds of message arrival at p95.

---

**Story 5.4 — Escalation rules**
*As a support lead, I want the bot to know when to stop, so that it never handles something it shouldn't.*

1. Escalation triggers on unsupported language, PII above threshold, strong negative sentiment, low confidence, and explicit human requests.
2. An escalated conversation is flagged, sorted up, and optionally notifies a channel.
3. The escalation reason is stated in one plain sentence in the conversation timeline.
4. Admins can configure which triggers are active and their thresholds.
5. Escalation precision against a labeled set meets the agreed threshold.

---

**Story 5.5 — Draft review panel**
*As an agent, I want to review and act on a draft quickly, so that reviewing is faster than writing.*

1. The panel shows the draft in an editable composer with confidence displayed as a number and a label, not color alone.
2. Citations are inspectable via hover-card showing the source chunk and a link.
3. Approve, edit-and-send, regenerate, and reject are single actions; `⌘Enter` sends.
4. Every outcome is recorded with the actor, the final body, and the edit distance from the original.
5. Regenerate produces a new draft with the prior one retained in history.

---

**Story 5.6 — Persona settings and playground**
*As an admin, I want to shape and test the bot's voice, so that I trust it before it speaks for us.*

1. Persona settings cover tone, formality, signature, prohibited topics, and standard disclaimers.
2. The playground streams responses using the identical agent, tools, and knowledge as production.
3. The tool-call trace is visible per response, including retrieved chunks and scores.
4. Persona changes take effect in the playground immediately without a deploy.
5. A prompt-injection corpus in the playground produces no unauthorized tool call and no data disclosure.

---

### Epic 6 — Sending and automation

**Goal:** close the loop. This is the first epic where the system can act on the outside world, so exactly-once and reversibility dominate the acceptance criteria.

---

**Story 6.1 — Outbox and exactly-once sending**
*As an operator, I want guaranteed single delivery, so that a customer never receives the same reply twice.*

1. `outbound_messages` records state, attempts, error, provider id, and scheduled time, with a partial index on pending rows.
2. A cron drains the outbox, claiming rows with `FOR UPDATE SKIP LOCKED` in a single statement.
3. Ten concurrent drains against 50 pending rows send each exactly once — verified by an automated test.
4. Failures back off exponentially and move to `dead` after five attempts, notifying admins.
5. A claimed row that crashes mid-send is recoverable without double-sending.

---

**Story 6.2 — Reply threading and branding**
*As a customer of a tenant, I want replies to land in my existing thread and look like the company, so that the exchange feels normal.*

1. Outbound messages set `In-Reply-To` and `References` correctly from the inbound thread.
2. Replies appear threaded in Gmail, Outlook, and Apple Mail — verified manually against real accounts.
3. The tenant signature, logo, and footer are applied and previewable.
4. Both HTML and plaintext parts are generated and consistent.
5. Quoted history is included in the standard, expected format.

---

**Story 6.3 — Auto-send with a confidence threshold**
*As a support lead, I want to automate the replies I trust, so that volume drops without risk.*

1. Auto-send is off by default and requires explicit enablement per tenant.
2. A configurable threshold determines which drafts send without review.
3. Auto-sent replies are clearly marked in the thread and in analytics.
4. Enabling auto-send requires acknowledging a plain-language explanation of what will happen.
5. Auto-send can be disabled instantly, and any pending auto-sends are cancelled on disable.

---

**Story 6.4 — Business hours, delay, and rules**
*As a support lead, I want control over when the bot speaks, so that automation matches how we operate.*

1. Auto-send can be restricted to configured business hours in the tenant's timezone.
2. A configurable delay is applied before auto-send, during which a human can intercept and cancel.
3. Specific intents can be excluded from auto-send entirely.
4. Volume caps limit auto-sends per hour per tenant.
5. Outside business hours, drafts queue and send at open rather than being discarded.

---

**Story 6.5 — Bounce and failure handling**
*As an agent, I want to know when a reply didn't arrive, so that I can follow up.*

1. Bounces and delivery failures are detected and attached to the conversation.
2. Hard bounces mark the contact address invalid and suppress further sends to it.
3. Soft bounces retry per policy before being surfaced.
4. Delivery failures are visible in the conversation timeline, not only in logs.
5. A provider outage queues sends rather than dropping or erroring them.

---

### Epic 7 — Public API and webhooks

**Goal:** the platform becomes programmable, so tenants integrate it with their own systems.

---

**Story 7.1 — API key management**
*As a technical admin, I want scoped API keys, so that our integrations authenticate safely.*

1. Keys can be created with a name and scope; the plaintext value is shown exactly once.
2. Keys are stored hashed; the plaintext is never retrievable or logged.
3. Keys can be revoked immediately, and revocation takes effect on the next request.
4. Last-used time and request count are displayed per key.
5. Every key creation and revocation writes an audit event.

---

**Story 7.2 — REST API**
*As a technical admin, I want a versioned API, so that I can build against a stable contract.*

1. `/api/v1` implements the endpoints in the architecture's API spec.
2. Authentication accepts a bearer API key and resolves the tenant; RLS applies identically to API and UI paths.
3. Responses use cursor pagination and `application/problem+json` errors.
4. `Idempotency-Key` is honored on all POST endpoints for 24 hours.
5. An OpenAPI spec is generated and published, and integration tests exercise every endpoint.

---

**Story 7.3 — Rate limiting**
*As an operator, I want request limits, so that one tenant cannot degrade the platform.*

1. Sliding-window limits apply per API key, per IP for webhooks, and per tenant for AI calls.
2. `X-RateLimit-Limit`, `-Remaining`, and `-Reset` headers are returned on every API response.
3. Exceeding a limit returns 429 with `Retry-After`.
4. Limits are configurable per plan.
5. Limit breaches are logged and visible to operators.

---

**Story 7.4 — Outbound webhooks and tenant actions**
*As a technical admin, I want events pushed to us and our systems callable by the bot, so that the platform fits our stack.*

1. Subscriptions can be registered per event type with a URL and generated secret.
2. Payloads are HMAC-SHA256 signed with a timestamp and a 5-minute tolerance.
3. Failed deliveries retry with exponential backoff for 24 hours; delivery history is visible.
4. `call_tenant_webhook` invokes only pre-registered URLs and never a model-supplied host.
5. Tenant action responses are validated against a schema before entering the model context.

---

### Epic 8 — Analytics, billing, and hardening

**Goal:** the product can be sold, measured, and operated.

---

**Story 8.1 — Analytics dashboard**
*As a support lead, I want to see whether this is working, so that I can justify and tune it.*

1. Volume, deflection rate, draft acceptance rate, first-response time, and resolution time render over a selectable period.
2. Escalation reasons are broken down by trigger.
3. Metrics are tenant-scoped and comparable against the prior period.
4. Data can be exported as CSV.
5. Analytics queries return in under 1s at p95 at target scale.

---

**Story 8.2 — Usage metering and billing**
*As a business, I want usage-based billing, so that revenue tracks value delivered.*

1. Messages processed, AI replies, and tokens are recorded per tenant per period.
2. Usage is reported to Stripe on an hourly rollup.
3. Plans define seat counts, message limits, model tiers, and feature access.
4. Subscribe, upgrade, downgrade, and invoice history work end-to-end.
5. Exceeding a plan limit degrades gracefully with clear notice, rather than failing silently or hard-stopping ingest.

---

**Story 8.3 — Observability and error handling**
*As an operator, I want to see what the system is doing, so that I can fix it before customers report it.*

1. Structured logs carry tenant id, conversation id, and workflow run id on every entry.
2. Errors report to Sentry with tenant context and no PII in the payload.
3. Dashboards cover ingest lag, draft latency, send success rate, model cost per tenant, and error rate.
4. Alerts fire on ingest lag, send failure rate, and error rate thresholds.
5. Every user-facing error is actionable, and failed drafts appear in the conversation timeline rather than vanishing.

---

**Story 8.4 — Security hardening and compliance**
*As a buyer's security reviewer, I want the controls documented and tested, so that I can approve the purchase.*

1. Security headers (CSP, HSTS, `X-Content-Type-Options`, `Referrer-Policy`) are set and verified by test.
2. The prompt-injection corpus passes on every release.
3. Data export and deletion endpoints work, with deletion cascading to blobs within 30 days.
4. A penetration test is completed and findings are remediated or accepted with rationale.
5. Data region is a tenant attribute, and the audit trail satisfies a standard DPA review.

---

**Story 8.5 — Load testing and evals**
*As an operator, I want proof the system holds up, so that launch is not the first real test.*

1. A load test sustains 50 inbound messages/second with ingest draining faster than it fills.
2. Query performance is verified with 500 tenants and 50,000 conversations per tenant.
3. A nightly eval set of ~150 labeled cases per tenant archetype scores intent accuracy, citation groundedness, and escalation precision.
4. Eval regressions open an issue automatically and do not block merges.
5. Results are tracked over time so model or prompt changes are visibly attributable.

---

## 7. Checklist results

**PO master checklist:** not yet run. Blocks the transition from planning to the development cycle.

Pre-flight self-assessment by the PM:

| Check | Status |
|---|---|
| Every FR maps to at least one story | ✅ |
| Every story has testable acceptance criteria | ✅ |
| Epics are independently deployable and correctly sequenced | ✅ |
| No story depends on a later epic | ✅ |
| NFRs are reflected in acceptance criteria, not only stated | ✅ |
| MVP scope boundary is explicit | ✅ |
| Open decisions are recorded and owned | ⚠️ — see §8, and PO findings F1/F3/F5 |
| Architecture exists and is consistent with these epics | ✅ [[Email Engine Architecture]] |
| Front-end spec exists | ✅ [[Email Engine Front-End Spec]] — written 2026-08-03, after the architecture rather than before it; its five deltas are ruled on in Architecture §9.5 |

> [!warning] PO validation, 2026-08-03 — 🟡 **CONCERNS**
> The master checklist has been run: [`docs/po-validation-2026-08-03.md`](./docs/po-validation-2026-08-03.md). Both documents are sharded and `.bmad-core/core-config.yaml` is written.
>
> **Epic 1 Story 1.1 is cleared to start.** Seven findings need owners — three before Story 1.2 is drafted. The largest, **F1**, is that Story 1.2 provisions a Neon database with three extensions while the applied schema lives on a self-hosted PostgreSQL 17 with none; that divergence also gates Epic 4 and everything retrieval touches. **F3** (no epic builds the notification channel four epics assume) and **F4** (free-text search has no index behind it) are the other two.

---

## 8. Open questions

Carried from [[Email Engine Architecture]] §17, plus product-side items. Each needs an owner and a decision date before the epic that depends on it starts.

| # | Question | Blocks | Owner |
|---|---|---|---|
| 1 | Auto-send default — conservative (0.9, off) or ship on at 0.85? | Epic 6 | PM, after Epic 5 eval data |
| 2 | Data residency — single region now, or tenant→region routing designed up front? | Epic 8 | Architect |
| 3 | Model choice — tenant-selectable or a plan attribute we control? | Epic 5, pricing | PM |
| 4 | Pricing shape — per seat, per message, or hybrid? | Epic 8 | PM |
| 5 | Attachment malware scanning vendor | Epic 2 | Architect |
| ~~6~~ | ~~Does MVP need a shared team view of who is currently viewing a conversation?~~ **Resolved 2026-08-03: no** — assignment plus a send-time conflict check. Reasoning and revisit criteria in [[Email Engine Front-End Spec]] §13. | ~~Epic 3~~ | UX Expert ✓ |
| 7 | Retrieval quality bar — what recall@8 gates Epic 5? | Epic 4 → 5 | Architect + PM |

---

## 9. Next steps

**UX Expert prompt** — ✅ done 2026-08-03, [[Email Engine Front-End Spec]] v1.0

> Using this PRD — particularly §3 (UI design goals) and Epics 3, 5, and 6 — produce `docs/front-end-spec.md`. Prioritize the conversation-plus-draft-review screen: it is the product's core loop and must make reviewing faster than writing. Specify the confidence and citation affordances precisely, including their non-color accessibility treatment. Map every screen to shadcn/ui primitives and note where a custom composite is required.

Delivered against all four asks. Because it was written *after* the architecture, it conforms to Architecture §9 rather than driving it, and surfaces five deltas the Architect must rule on before Epic 3 stories are drafted — see Front-End Spec §14. Open question 6 is resolved there.

**Architect prompt**

> [[Email Engine Architecture]] v1.0 already exists and was written against this PRD. Re-validate it against the final FR/NFR list, resolve open questions 2, 5, and 7, and confirm every epic in §5 has the technical foundations it needs in the epic that precedes it. Then shard the architecture into `docs/architecture/` per its §1.3.

**PO prompt**

> Run the master checklist against this PRD and the architecture. Confirm the sequencing holds, then shard both documents and hand Epic 1 Story 1.1 to the SM.

---

## Related

- [[Email Engine Architecture]] — the technical design serving this PRD
- [[BMAD Method]] — agent roles, sharding, story lifecycle
- [[Projects MOC]] · [[Home]]
