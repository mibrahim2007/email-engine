> **Shard of [PRD](../../Email%20Engine%20PRD.md) §6 Epic 7.**
> Derived file — edit the source document and re-shard, never this copy.

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
