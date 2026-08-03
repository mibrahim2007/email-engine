> **Shard of [PRD](../../Email%20Engine%20PRD.md) §6 Epic 6.**
> Derived file — edit the source document and re-shard, never this copy.

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

