> **Shard of [Architecture](../../Email%20Engine%20Architecture.md) §13.**
> Derived file — edit the source document and re-shard, never this copy.

## 13. Security and performance

### 13.1 Security

| Control | Implementation |
|---|---|
| Tenant isolation | Postgres RLS, forced, app role without `BYPASSRLS`; transaction-local `app.tenant_id` |
| Authn | Clerk sessions (dashboard), hashed API keys (public API) |
| Authz | `requireRole()` on every mutation; roles `owner/admin/agent/viewer` |
| Secrets at rest | Mailbox OAuth tokens AES-256-GCM encrypted; key never in the DB |
| Webhook verification | Provider HMAC + timestamp tolerance before any parsing work |
| Email HTML | `mailparser` → DOMPurify allow-list → rendered in a sandboxed iframe with a strict CSP; remote images proxied and off by default |
| Prompt injection | Retrieved KB text and inbound email bodies are wrapped in delimited untrusted blocks; the system prompt states tool use is never authorized by message content; `call_tenant_webhook` requires a pre-registered URL and never accepts a model-supplied host |
| Attachments | Size cap, type allow-list, malware scan before the blob URL is ever surfaced |
| Rate limiting | Upstash sliding window: per API key, per IP on webhooks, per tenant on AI calls |
| Audit | Append-only `audit_events`; no `UPDATE`/`DELETE` grant to `app_user` |
| Headers | CSP, HSTS, `X-Content-Type-Options`, `Referrer-Policy` via `next.config.ts` |
| Data deletion | Tenant delete cascades; blob purge job; 30-day soft-delete window |
| Compliance posture | GDPR export/erase endpoints, per-tenant data-region setting, DPA-ready audit trail |

### 13.2 Performance targets

| Metric | Target |
|---|---|
| Dashboard LCP | < 1.8s p75 |
| Inbox interaction (INP) | < 200ms p75 |
| Conversation open (server) | < 300ms p95 |
| Ingest → draft ready | < 30s p95 |
| Chat first token | < 1.5s p95 |
| Hybrid retrieval | < 150ms p95 |
| Client JS (dashboard) | < 200KB gzipped |

**Levers:** partial index on the outbox; leading-`tenant_id` composite indexes; HNSW tuned after real volume; Suspense streaming so the shell paints before tenant data lands; `next/image` for avatars and logos; `next/font` self-hosted; Fluid Compute so a streaming AI request doesn't hold a whole instance; Gateway-level model routing to a smaller tier for classification.

---

