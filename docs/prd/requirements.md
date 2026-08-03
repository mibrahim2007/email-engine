> **Shard of [PRD](../../Email%20Engine%20PRD.md) §2.**
> Derived file — edit the source document and re-shard, never this copy.

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

