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

**Environment variables:** `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `AI_GATEWAY_API_KEY`, `CLERK_SECRET_KEY`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_WEBHOOK_SECRET`, `ENCRYPTION_KEY`, `RESEND_API_KEY`, `INBOUND_WEBHOOK_SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `BLOB_READ_WRITE_TOKEN`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `SENTRY_DSN`.

No provider AI keys — model access is entirely through the Gateway credential.

---
