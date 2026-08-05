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
