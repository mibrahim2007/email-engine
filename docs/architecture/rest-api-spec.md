> **Shard of [Architecture](../../Email%20Engine%20Architecture.md) §7.**
> Derived file — edit the source document and re-shard, never this copy.

## 7. REST API spec

Public API at `/api/v1`, authenticated by tenant API key (`Authorization: Bearer sk_live_…`) hashed in `api_keys`. The dashboard does **not** use this API — it uses Server Components and Server Actions. Keeping them separate stops internal UI needs from warping the public contract.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/v1/conversations` | List. Filters: `status`, `assignee`, `intent`, `q`, cursor pagination |
| `GET` | `/v1/conversations/:id` | Detail with messages |
| `PATCH` | `/v1/conversations/:id` | Status, assignee, tags |
| `POST` | `/v1/conversations/:id/reply` | Queue an outbound reply |
| `POST` | `/v1/conversations/:id/draft` | Force an AI draft, returns `{ body, confidence, citations }` |
| `GET` | `/v1/messages/:id` | Single message + attachments |
| `GET/POST/DELETE` | `/v1/kb/sources` | Knowledge base CRUD; POST triggers indexing |
| `POST` | `/v1/kb/search` | Hybrid search, returns chunks + scores |
| `GET/POST` | `/v1/mailboxes` | List / connect |
| `POST` | `/v1/webhooks` | Register tenant webhook subscriptions |
| `GET` | `/v1/usage` | Current period metering |

**Webhook events out to tenants:** `message.received`, `draft.created`, `reply.sent`, `conversation.escalated`, `conversation.resolved`. HMAC-SHA256 signed with the tenant secret, `t=` timestamp in the header, 5-minute tolerance, exponential-backoff retries for 24h.

**Conventions:** cursor pagination (`?cursor=&limit=`, max 100), `application/problem+json` errors, `X-RateLimit-*` headers, `Idempotency-Key` honored on all POSTs for 24h.

> [!important] Idempotency is a Postgres constraint, not a Redis record — ruled 2026-08-07 (Story 7.2)
> `POST /v1/conversations/:id/reply` is protected by two guarantees that **do not meet**: `Idempotency-Key` in Upstash, and exactly-once sending in `outbound_messages`. The natural implementation checks Redis, inserts the outbound row, then writes the Redis record — and **a crash between the last two leaves a queued reply with no idempotency record**, so the client's retry (exactly what a client does after a timeout) enqueues a second. Two legitimate rows, each sent exactly once, and the customer gets two replies. Writing Redis first is worse: a crash before the insert records an operation that never happened and the reply is silently never sent.
>
> Redis cannot join a Postgres transaction, so **no ordering of two writes closes it.** The row and its idempotency record must be *one* write:
>
> ```sql
> ALTER TABLE outbound_messages ADD COLUMN idempotency_key text;
> CREATE UNIQUE INDEX idx_outbound_idem
>   ON outbound_messages (tenant_id, idempotency_key)
>   WHERE idempotency_key IS NOT NULL;
> ```
>
> A retry hits the unique violation, the handler looks up the existing row and returns the original response. **Redis keeps the read-side cache** — a 24h `(tenant, key) → response` record whose loss costs latency, never correctness, which is the right job for a store that cannot be in the transaction. Same treatment for every POST that creates a durable row. **Namespace by tenant**: clients use sequential integers more often than anyone expects.
>
> Fourth instance of *a guarantee protects the table it is written on and nothing above it*, after the duplicate draft (§6.7a), the bounce loop (§8.1) and the overnight queued send (§12).

> [!warning] `GET /v1/usage` ships in Epic 8, not Epic 7 — ruled 2026-08-07 (Story 7.2)
> `usage_records` exists from `0001` and **nothing writes to it until Story 8.2's rollup cron.** Shipped in Epic 7 the endpoint would be live, documented in the published OpenAPI spec, passing its integration test (an empty list is a valid response) and **wrong** — for however long Epic 8 takes.
>
> Same shape as SB-1, where five stories described `users` as a mirror of Clerk identity and none populated it. Here the table is real, the endpoint is real, the test passes, and the data does not exist.
>
> **It returns `501` with a `problem+json` body naming the epic, and is absent from the OpenAPI spec rather than documented as returning nothing.** A published contract that returns an honest error beats one that returns an empty truth. Story 8.2 owns turning it on.

---
