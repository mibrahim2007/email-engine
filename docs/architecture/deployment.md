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
    { "path": "/api/cron/rollup-usage",   "schedule": "15 * * * *" }
  ]
}
```

**Environment variables:** `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `CLERK_SECRET_KEY`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_WEBHOOK_SECRET`, `ENCRYPTION_KEY`, `RESEND_API_KEY`, `INBOUND_WEBHOOK_SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `BLOB_READ_WRITE_TOKEN`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `SENTRY_DSN`.

No provider AI keys — model access is entirely through the Gateway.

> [!important] AI Gateway auth: OIDC on Vercel, not a static key (amended 2026-08-04)
> `AI_GATEWAY_API_KEY` was previously listed above and has been **removed from the deployment set**. On Vercel, `VERCEL_OIDC_TOKEN` is provisioned automatically with no secret to store, rotate, or leak.
>
> The decisive reason is not hygiene, it is offboarding: **Vercel deactivates an API key when the team member who created it leaves.** A key is bound to a person; a production service whose entire value proposition is that mail does not silently stop must not be. See [[Vercel AI Gateway]].
>
> The AI SDK resolves `AI_GATEWAY_API_KEY || VERCEL_OIDC_TOKEN`, so **setting the variable opts out of OIDC** — it must stay unset in Preview and Production. Keep it for CI and any non-Vercel environment, where OIDC is unavailable.

---
