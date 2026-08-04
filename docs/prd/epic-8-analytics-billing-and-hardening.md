> **Shard of [PRD](../../Email%20Engine%20PRD.md) §6 Epic 8.**
> Derived file — edit the source document and re-shard, never this copy.

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
