> **Shard of [Architecture](../../Email%20Engine%20Architecture.md) §10.**
> Derived file — edit the source document and re-shard, never this copy.

## 10. Backend architecture

### 10.1 Function organization

```
apps/web/src/server/
├── db/            client, RLS session helper, repositories
├── services/      mailbox, ingest, thread, classify, retrieve, agent, compose, send
├── workflows/     process-inbound-email.ts, index-kb-source.ts, backfill-mailbox.ts
├── auth/          clerk helpers, requireTenant(), requireRole()
└── lib/           crypto, rate-limit, signatures, errors, logger
```

### 10.2 The tenant-scoped DB session

This is the most important twenty lines in the codebase:

```ts
// server/db/withTenant.ts
export async function withTenant<T>(
  tenantId: string,
  fn: (tx: Tx) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    // transaction-local: cannot leak across pooled connections
    await tx.execute(sql`SELECT set_config('app.tenant_id', ${tenantId}, true)`);
    return fn(tx);
  });
}
```

**Every** repository function takes a `tx` from `withTenant`. There is no exported raw `db` outside `server/db`. An ESLint rule enforces it (§15).

#### The one query that cannot (ruled 2026-08-04)

"Every" was not quite true, and the exception is load-bearing. §10.3's `requireTenant()` calls `getTenantByClerkOrg(orgId)` **before a tenant is known** — that is the query which *determines* the tenant, so it cannot run inside a session scoped to one. The same applies to the API-key path, which resolves a tenant from a hashed key.

**And it is worse than a naming problem.** `tenants` carries `USING (id = current_tenant_id())`. With no tenant set, `current_tenant_id()` returns NULL, `id = NULL` is NULL, and the policy denies. **The bootstrap lookup is blocked by the policy it exists to precede** — run it as `email_engine_app` with no tenant and it returns zero rows, so every login fails closed.

**Ruling: a `SECURITY DEFINER` function, not a second role and not an unpoliced table.**

```sql
CREATE FUNCTION tenant_by_clerk_org(p_clerk_org_id text)
RETURNS TABLE (id uuid, status text)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT t.id, t.status FROM tenants t WHERE t.clerk_org_id = p_clerk_org_id
$$;

REVOKE ALL ON FUNCTION tenant_by_clerk_org(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION tenant_by_clerk_org(text) TO email_engine_app;
```

Why this shape:

- **`SECURITY DEFINER` runs as the function owner**, so the policy does not block it — while the *table* stays forced for every other access path. The exception is one function wide, not one role wide.
- **It returns two columns, never the row.** An escape hatch that returned `tenants.*` would leak `settings` and `plan` for an arbitrary `clerk_org_id`. The caller needs an id and a status; it gets an id and a status.
- **`SET search_path` is mandatory, not stylistic.** A `SECURITY DEFINER` function without a pinned search path is the standard PostgreSQL privilege-escalation footgun.
- **Granting a second role `BYPASSRLS` was the alternative and is much worse** — it creates a credential that can read every tenant's mail, to solve a problem that needs one lookup.

**The escape hatch must be enumerable.** Give it a home and a guard:

| | |
|---|---|
| `server/db/system.ts` | The only module allowed to call these. Every export is a system query with a comment saying why it cannot be tenant-scoped |
| Permitted list | `tenantByClerkOrg`, `tenantByApiKeyHash`. **Two.** Adding a third is an architecture decision, not a refactor |
| Test | Asserts `system.ts`'s exported surface matches that list exactly, so it cannot grow quietly — the same reasoning as `allowBuilds` and the `region` CHECK: **constrain the exception, do not merely document it** |

Story 1.4 owns the function and the module; Story 1.3's ESLint rule must permit `system.ts` alongside `withTenant`.

#### Every cron needs the same exception, and the two-function list did not survive contact (ruled 2026-08-05)

Found checking Epic 2's stories against Epic 1's design. §12 declares four crons:

```json
{ "path": "/api/cron/poll-mailboxes", "schedule": "*/2 * * * *" },
{ "path": "/api/cron/drain-outbox",   "schedule": "* * * * *" },
{ "path": "/api/cron/reindex-kb",     "schedule": "0 3 * * *" },
{ "path": "/api/cron/rollup-usage",   "schedule": "15 * * * *" }
```

**Every one of them runs with no tenant and must find work belonging to all of them.** `mailboxes` carries `USING (tenant_id = current_tenant_id())`; with no tenant set that predicate is NULL and the policy denies. So `poll-mailboxes` enumerates **zero mailboxes**, polls nothing, and every tenant's mail silently stops arriving. The same is true of the other three.

This is the bootstrap problem again at a different scale — and it means the escape hatch was never a list of two functions. **It is two categories:**

| Category | Shape | Members |
|---|---|---|
| **Bootstrap lookup** | External identifier → **one** tenant, before a session exists | `tenantByClerkOrg`, `tenantByApiKeyHash` |
| **Work enumeration** | Cron → **`(tenant_id, entity_id)` pairs across tenants** | `mailboxesDueForPoll`, `outboundDue`, `kbSourcesDueForReindex`, `tenantsDueForUsageRollup`, `tenantsDueForBlobPurge` |

**The discipline that makes category two safe is what it must not return.**

1. **Identifiers only, never entity data.** `mailboxesDueForPoll()` returns `(tenant_id, mailbox_id)` — **not** `credentials_encrypted`, not the address, not the cursor. An enumerator that returns rows is a cross-tenant read with a job title.
2. **The work happens inside `withTenant()`.** The cron enumerates, then loops, then re-enters a tenant-scoped session per tenant to do anything real. **Processing on the system connection would bypass RLS for the entire pipeline** — which is precisely the failure the whole design exists to prevent, arriving through the back door of a scheduled job.
3. **Same mechanism as the bootstrap lookup**: `SECURITY DEFINER`, pinned `search_path`, minimal return, `REVOKE FROM PUBLIC` then grant.
4. **A destructive enumerator needs a refusal path**, not just a correct query. `tenantsDueForBlobPurge` deletes; if its window arithmetic is wrong it destroys a live tenant's attachments and nothing downstream notices. It must refuse to proceed when the returned count exceeds a sanity threshold — see §12.
5. **The surface test still applies**, now over seven exports rather than two. Six enumerable, commented, deliberately-added functions is still a constrained exception; it is the *unbounded* version that would not be.

> **Why the list grew and the rule did not.** "Adding a third is an architecture decision" was the right rule and it worked exactly as intended — the third arrived, it was noticed, and it turned out to be four. **A cap that gets renegotiated when the reason is good is doing its job; a cap that gets quietly edged past is not.** What matters is that `system.ts` stays enumerable and every entry says why it cannot be tenant-scoped.

**Ownership:** Story 1.4 still builds the module and the two bootstrap functions. Each enumerator belongs to the story that introduces its cron — `mailboxesDueForPoll` to Story 2.8, `outboundDue` to 6.1, `kbSourcesDueForReindex` to 4.3, `tenantsDueForUsageRollup` to 8.2, `tenantsDueForBlobPurge` to 8.4 — and each must extend the surface test rather than loosen it.

### 10.3 Auth flow

Clerk middleware guards `(app)` and `/api/v1` differently:

```ts
// requireTenant(): the only way to get a tenantId
export async function requireTenant() {
  const { userId, orgId, orgRole } = await auth();
  if (!userId || !orgId) throw new UnauthorizedError();
  const tenant = await getTenantByClerkOrg(orgId);   // system-scoped read
  if (!tenant || tenant.status !== 'active') throw new ForbiddenError();
  return { tenant, userId, role: mapRole(orgRole) };
}
```

API-key requests resolve the tenant from the hashed key instead. Both paths converge on the same `{ tenant, role }` shape, so authorization logic is written once.

### 10.4 The agent

```ts
const result = await streamText({
  model: gateway(tenant.settings.model ?? DEFAULT_MODEL), // AI Gateway, no provider SDK
  system: buildSystemPrompt(tenant, conversation),
  messages: threadToMessages(conversation),
  tools: { searchKnowledgeBase, lookupCustomer, callTenantWebhook, escalateToHuman },
  stopWhen: stepCountIs(8),
  abortSignal: AbortSignal.timeout(60_000),
  experimental_telemetry: { isEnabled: true, metadata: { tenantId: tenant.id } },
});
```

Model choice is a tenant setting resolved against an allow-list per plan. The Gateway handles provider failover and reports token/cost per request, which flows into `usage_records`.

### 10.5 Error handling

One error taxonomy, thrown everywhere, translated at the boundary:

| Class | HTTP | Retryable |
|---|---|---|
| `ValidationError` | 400 | no |
| `UnauthorizedError` | 401 | no |
| `ForbiddenError` | 403 | no |
| `NotFoundError` | 404 | no |
| `ConflictError` | 409 | no |
| `RateLimitError` | 429 | yes, after `Retry-After` |
| `ProviderError` | 502 | yes |
| `InternalError` | 500 | no |

Workflows retry only `RateLimitError` and `ProviderError`. Everything else fails the step immediately and surfaces in the conversation timeline as a system event the user can see — silent AI failures are worse than visible ones.

---
