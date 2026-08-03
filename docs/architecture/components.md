> **Shard of [Architecture](../../Email%20Engine%20Architecture.md) §4.**
> Derived file — edit the source document and re-shard, never this copy.

## 4. Components

### 4.1 `mailbox-connector`
Owns OAuth with Gmail / Microsoft Graph and IMAP credentials. Stores refresh tokens encrypted (AES-256-GCM, key in `ENCRYPTION_KEY`), refreshes on demand, exposes a uniform `fetchSince(cursor)` / `send(message)` interface so the rest of the system never branches on provider.

**Interface:** `connect(tenantId, provider, code)`, `refresh(mailboxId)`, `fetchSince(mailboxId, cursor)`, `send(mailboxId, outboundId)`, `revoke(mailboxId)`

### 4.2 `ingest`
Two entry points, one exit. Webhook (`/api/webhooks/inbound`) verifies the provider signature; Cron polls IMAP/Graph mailboxes on a per-tenant cadence. Both normalize to a `RawMessage` and enqueue one workflow run. Deduplication is a DB constraint, not a check-then-insert.

### 4.3 `thread-resolver`
Stitches messages into conversations using `Message-ID` / `In-Reply-To` / `References`, falling back to normalized-subject + participant-set matching within a 30-day window. Gets its own module because the heuristics will be tuned for the life of the product.

### 4.4 `classifier`
Structured-output call (`generateObject`) returning `{ intent, sentiment, urgency, language, requires_human, pii_detected }`. Runs on a small/fast model tier. Its output routes the message and is stored for analytics.

### 4.5 `retriever`
Hybrid search over `kb_chunks`: `pgvector` cosine similarity ∪ Postgres full-text `ts_rank`, merged with Reciprocal Rank Fusion, then trimmed to a token budget. Always tenant-scoped by RLS. Returns chunks *with* source URLs so replies can cite.

### 4.6 `agent`
The reply brain. Assembles system prompt + tenant persona + thread history + retrieved context, then runs a tool-calling loop:

| Tool | Does |
|---|---|
| `search_knowledge_base` | Semantic + keyword over the tenant's KB |
| `lookup_customer` | Contact record, past conversations, custom fields |
| `call_tenant_webhook` | Tenant-defined action (order status, refund) via signed HTTP |
| `escalate_to_human` | Sets `requires_human`, stops the loop, notifies |
| `propose_reply` | Terminal — emits the draft body + citations + confidence |

Hard caps: 8 tool steps, 60s wall clock, token budget per tenant plan.

### 4.7 `composer`
Renders the draft to HTML + plaintext, applies the tenant's signature and brand, threads headers correctly (`In-Reply-To`, `References`), strips quoted history from the reply body, and writes an `outbound_messages` row in `pending` state.

### 4.8 `sender`
Drains the outbox. Claims a row with `UPDATE ... WHERE state='pending' RETURNING` (single-statement claim, no race), calls the connector, records the provider id, moves to `sent`. Failures go to `failed` with a retry count; a permanent bounce moves to `dead` and notifies.

### 4.9 `chat-api`
Streams the interactive dashboard chatbot (`/api/chat`) with the same agent and tools, so behavior in the "test your bot" playground matches production email behavior exactly.

### 4.10 `dashboard`
RSC-rendered inbox, conversation view, KB manager, mailbox settings, analytics, team, billing.

---

