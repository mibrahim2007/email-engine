> **Shard of [Architecture](../../Email%20Engine%20Architecture.md) §12.**
> Derived file — edit the source document and re-shard, never this copy.

## 12. Deployment

| Environment | Branch | URL | Database |
|---|---|---|---|
| Development | local | `localhost:3000` | Neon branch `dev-{user}` |
| Preview | any PR | `email-engine-{hash}.vercel.app` | Neon branch per PR, auto-deleted on merge |
| Production | `main` | `app.emailengine.io` | Neon `main` |

**Pipeline:** PR → typecheck, lint, unit tests, `drizzle-kit check` (drift), RLS policy test → preview deploy → Playwright against the preview URL → merge → migrations run in a pre-deploy job → production deploy → smoke test → auto-rollback on failed smoke.

**Migration rule:** every migration must be backward-compatible with the previous deploy (expand/contract). Add a column and backfill in one release; start writing to it in the next; drop the old one in a third. Never in one.

**Cron (`vercel.json`):**

```json
{
  "crons": [
    { "path": "/api/cron/poll-mailboxes", "schedule": "*/2 * * * *" },
    { "path": "/api/cron/drain-outbox",   "schedule": "* * * * *" },
    { "path": "/api/cron/reindex-kb",     "schedule": "0 3 * * *" },
    { "path": "/api/cron/rollup-usage",   "schedule": "15 * * * *" },
    { "path": "/api/cron/purge-blobs",    "schedule": "30 4 * * *" }
  ]
}
```

> **`purge-blobs` was added 2026-08-05.** §13.1 has always specified *"tenant delete cascades; blob purge job; 30-day soft-delete window"* and Story 8.4 AC3 requires deletion to cascade to blobs within 30 days — but **no cron declared it**, so nothing would have run it. FR54 and NFR21 would have been satisfied in the database and quietly unmet in storage.
>
> **It is the most dangerous of the five and needs the opposite failure mode from the others.** `poll-mailboxes` enumerating nothing means no mail arrives — bad, loud once noticed, and reversible. **`purge-blobs` enumerating wrongly means a live tenant's attachments are deleted**, which is not reversible and which nothing downstream would flag. Its enumerator must return only tenants whose soft-delete window has *definitively* elapsed, and it should refuse to run at all if the count exceeds a sanity threshold rather than proceeding.
>
> Its enumerator, `tenantsDueForBlobPurge`, follows §10.2's category-two rules and is owned by Story 8.4 — making **six** crons' worth of enumerators plus the two bootstrap lookups.

> **`reindex-kb` is the second destructive cron, and it was not read that way.** *(Added 2026-08-06, drafting Story 4.3.)* Its schedule suggests maintenance, but re-indexing **replaces a source's chunks** — so it carries `purge-blobs`'s blast radius on a nightly cadence, and the §13.1 question "which way does this job fail" has to be asked of it too.
>
> The naive shape is `DELETE` the old chunks then insert the new ones. **A crash between the two leaves the source with zero chunks and `status = 'indexed'`** — and unlike a source that never worked, this one worked yesterday. Nothing alerts: retrieval returns fewer rows, RRF still returns something, drafts still generate with plausible confidence. **The product does not break, it quietly gets worse.**
>
> **Ruling: embed into a new chunk set first, promote in one transaction, discard on any failure — never delete before the replacement exists.** Plus the refusal path §12 already requires of destructive enumerators: a re-index that would take a populated source to zero does not promote, it keeps the old chunks and reports `empty`. A URL that has started returning a login page is the ordinary case. Owned by Story 4.3; its enumerator `kbSourcesDueForReindex` follows §10.2's category-two rules.

> **The nightly eval set is not a Vercel cron.** PRD Story 8.5 AC3 and §14 describe a nightly eval that reports regressions without blocking merges. It runs on a CI schedule, has no tenant context to establish, and touches no tenant data — **listing it here would give it a scoping problem it does not have.** Stated so nobody adds it.

**Environment variables:** `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `CLERK_SECRET_KEY`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_WEBHOOK_SECRET`, `ENCRYPTION_KEY`, `RESEND_API_KEY`, `INBOUND_WEBHOOK_SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `BLOB_READ_WRITE_TOKEN`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `SENTRY_DSN`.

No provider AI keys — model access is entirely through the Gateway.

> [!important] AI Gateway auth: OIDC on Vercel, not a static key (amended 2026-08-04)
> `AI_GATEWAY_API_KEY` was previously listed above and has been **removed from the deployment set**. On Vercel, `VERCEL_OIDC_TOKEN` is provisioned automatically with no secret to store, rotate, or leak.
>
> The decisive reason is not hygiene, it is offboarding: **Vercel deactivates an API key when the team member who created it leaves.** A key is bound to a person; a production service whose entire value proposition is that mail does not silently stop must not be. See [[Vercel AI Gateway]].
>
> The AI SDK resolves `AI_GATEWAY_API_KEY || VERCEL_OIDC_TOKEN`, so **setting the variable opts out of OIDC** — it must stay unset in Preview and Production. Keep it for CI and any non-Vercel environment, where OIDC is unavailable.

---
