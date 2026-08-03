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

---

