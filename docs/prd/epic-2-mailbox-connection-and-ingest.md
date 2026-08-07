> **Shard of [PRD](../../Email%20Engine%20PRD.md) §6 Epic 2.**
> Derived file — edit the source document and re-shard, never this copy.

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
6. The stored content type is the **true type read from magic bytes**, not the claimed MIME or the extension; a mismatch is recorded and the true type wins. *(FR57, added 2026-08-04.)*
7. Executable types are refused at ingest. Blob URLs are served `Content-Disposition: attachment` with `X-Content-Type-Options: nosniff`, and `scan_status` is written as `not_scanned` — never `pending`, which would imply a queue that does not exist.
8. A delivery status notification is identified during parsing and routed out of the pipeline **before classification**, never treated as a customer message. *(Added 2026-08-07 from Story 6.5: a bounce arrives as ordinary inbound mail, so §4.3 threads it into the original conversation, Epic 5 classifies it and drafts a reply, and auto-send mails `MAILER-DAEMON` — a loop built from five individually-correct stories. **Detection belongs here, not in the classifier**: `Content-Type: multipart/report; report-type=delivery-status` is a header, and it must not depend on a model call that can fail open.)*

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
6. **A test measures arrival-to-visible latency end to end** and asserts FR13's targets — under 2 minutes for polled mail, under 10 seconds for webhook mail. *(Added 2026-08-04 per traceability finding F9: the 2-minute figure was satisfied by the cron schedule and measured nowhere, so a cron degrading to 4 minutes would violate FR13 with every test green.)*

---
