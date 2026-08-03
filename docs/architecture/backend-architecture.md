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

