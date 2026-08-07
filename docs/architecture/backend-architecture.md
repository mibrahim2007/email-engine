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
| **Work enumeration** | Cron → **`(tenant_id, entity_id)` pairs across tenants** | `mailboxesDueForPoll`, `outboundClaimDue`, `kbSourcesDueForReindex`, `tenantsDueForUsageRollup`, `tenantsDueForBlobPurge` |

> **`outboundClaimDue` is the one that writes** *(renamed from `outboundDue`, 2026-08-06)*. Every other enumerator is `STABLE` and reads; this one is `VOLATILE` and performs §8.2's atomic claim, because separating the enumeration from the claim defeats `SKIP LOCKED` — two drains would enumerate the same row and both claim it. **The atomicity is why it must be the escape hatch rather than sit behind one**, and the old name invited a future reader to call it twice. See §8.2.

**The discipline that makes category two safe is what it must not return.**

1. **Identifiers only, never entity data.** `mailboxesDueForPoll()` returns `(tenant_id, mailbox_id)` — **not** `credentials_encrypted`, not the address, not the cursor. An enumerator that returns rows is a cross-tenant read with a job title.
2. **The work happens inside `withTenant()`.** The cron enumerates, then loops, then re-enters a tenant-scoped session per tenant to do anything real. **Processing on the system connection would bypass RLS for the entire pipeline** — which is precisely the failure the whole design exists to prevent, arriving through the back door of a scheduled job.
3. **Same mechanism as the bootstrap lookup**: `SECURITY DEFINER`, pinned `search_path`, minimal return, `REVOKE FROM PUBLIC` then grant.
4. **A destructive enumerator needs a refusal path**, not just a correct query. `tenantsDueForBlobPurge` deletes; if its window arithmetic is wrong it destroys a live tenant's attachments and nothing downstream notices. It must refuse to proceed when the returned count exceeds a sanity threshold — see §12.
5. **The surface test still applies**, now over **eight** exports rather than two — two bootstrap lookups plus one enumerator for each of §12's six crons. Eight enumerable, commented, deliberately-added functions is still a constrained exception; it is the *unbounded* version that would not be.

> **The eighth arrived on 2026-08-07, and the rule worked again.** `webhookDeliveriesClaimDue` (Story 7.4) is the second enumerator that *writes*, after `outboundClaimDue` — a webhook delivery drain cannot enumerate its own work under RLS any more than the outbox can. The cap has now been renegotiated twice, from two to seven to eight, and each time the growth was visible and argued for rather than edged past. **That is the cap doing its job.** What matters is not the number; it is that `system.ts` stays enumerable and every entry says why it cannot be tenant-scoped.

> **The count was written three ways across two documents and none of them agreed** *(corrected 2026-08-06)*. This point said "seven exports" and then "six enumerable" in the same sentence; §12 said "six crons' worth of enumerators" against a `vercel.json` listing five. **A cap whose number nobody can state is only as strong as the test that enforces it** — which is the argument for the surface test having been written at all, and against ever relying on the prose. The test is right because it enumerates; the prose was wrong because it counted.

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

#### What `confidence` is (ruled 2026-08-07 — closes PRD §8 Q10)

`propose_reply` emitted body, citations **and confidence** in one call, from one context. The score was the model's opinion of its own work, and it gated the meter, the escalation floor, **auto-send**, and Q1's choice between 0.9 and 0.85 — a choice that only means something if the number is comparable across drafts, tenants, intents and model versions. A self-report is none of those things, and models report high confidence most readily in the case this product exists to catch: a fluent answer to a question the knowledge base does not cover.

**Ruling: `confidence` is computed groundedness. The model's self-report is recorded beside it and gates nothing.**

```
confidence = resolvable-cited claim sentences / claim sentences
```

Three definitions carry it, and each exists to stop the model deciding its own score:

1. **The denominator is code-owned.** Every sentence of the draft body **except** a fixed boilerplate set — the greeting, the sign-off, and the tenant's configured signature and disclaimers, which are known strings from the persona (§4.6). **The model does not get to declare a sentence non-factual**, or the metric is gamed by relabelling.
2. **The numerator counts *resolvable* citations only** — a citation whose `chunk_id` was in the retrieved set for this run and still exists. A marker pointing at nothing counts as uncited, which makes a hallucinated citation *lower* the score rather than raise it.
3. **A zero denominator yields `NULL`, and `NULL` never auto-sends.** A reply that makes no claims — *"I've passed this to a colleague"* — is not a confident reply, it is a reply with nothing to be confident about. Failing safe here costs one human review of a message that needed no knowledge.

**`drafts.model_confidence`** keeps the self-report. It gates nothing and is worth its column: **the gap between what the model claims and what it can support is the only free signal this project gets about its own model**, and it is the leading indicator of a regression after a Gateway version change. Watch the gap, not either number.

**What this does not measure, stated plainly: correctness.** A reply can be perfectly grounded in a chunk that is out of date. Groundedness is a claim about *provenance*, not truth — which is exactly why the honest sentence to a support lead is *"84% of this reply's factual sentences are backed by a source you can click"* and not *"this reply is 84% likely to be right."* Front-End Spec §4.1's meter says the former.

**Why not a second-model grader (option C) now.** It costs a call per draft and adds a second thing that can be wrong, and its value is unmeasurable until there is a baseline to compare it against. B is deterministic, explainable in one sentence, and **scoreable against Story 5.1's eval set** — so if groundedness and human-judged correctness diverge there, C becomes a decision with evidence behind it. **That comparison was impossible under a self-report**, which is the second reason to leave A in place as a recorded column.

**Consumers, all now reading a computed number:** the §4.1 meter and its threshold marker; Story 5.4 AC1's low-confidence escalation; FR42's auto-send threshold, which is what makes Front-End Spec §5.3's backtest dialog honest — *"of your last 200 drafts, 84 would have sent"* is a sentence you can now write and defend. **PRD §8 Q1 is unblocked by this ruling.**

> **Option C has an owner, which is what stops "decide later" from meaning "never".** Story 8.5 AC3's nightly eval scores groundedness **and human-judged correctness** per case and reports the **correlation between them**. High correlation means B is doing its job; low correlation is the evidence that buys a second-model grader. `model_confidence` is scored in the same run, gating nothing, because the gap between claimed and computed is what moves first when a provider updates a model behind a stable name.
>
> Assigned explicitly because *a decision with a settled design and no owner never gets built* — the shape that left PO finding F4's migration unwritten for two days with nothing wrong except that no story said it.

#### The playground shares the agent and must not share the dispatcher (ruled 2026-08-06)

FR36 and Story 5.6 AC2 require the playground to use the **identical agent, tools, and knowledge as production**. That wording is right — a playground that behaves differently tests nothing — and taken literally it is dangerous.

`call_tenant_webhook` is a *"tenant-defined action (order status, **refund**)"* against a URL the tenant registered under FR49. **So an admin typing into a screen labelled "test your bot" can issue a real refund against their production order system.** `escalate_to_human` is milder and still wrong: it latches `requires_human` on a conversation that does not exist and raises an FR55 notification for something nobody did.

**And Story 5.6 AC5 makes it adversarial.** The prompt-injection corpus exists to make the agent take unauthorized actions, and AC5 requires running it *in the playground*, one click, as a visible affordance. **The corpus proving the bot cannot be manipulated would fire live webhooks at the tenant's business while proving it** — and AC5's assertion is about the model's *decision*, which can only be checked after the call has left.

**Ruling: the difference goes below the agent, at the dispatcher.**

| Layer | Playground | Production |
|---|---|---|
| Agent, prompt, persona, model | identical | identical |
| Tool definitions and schemas | identical | identical |
| Knowledge and retrieval | identical | identical |
| Read-only tools (`search_knowledge_base`, `lookup_customer`) | execute | execute |
| **Side-effecting** (`call_tenant_webhook`, `escalate_to_human`) | **captured, not dispatched** | dispatched |

The model decides identically and the trace records the decision identically, so AC5's assertion is made against the captured call. **The trace becomes the delivery mechanism**: the playground shows the exact signed payload that *would* have gone out, to the exact registered endpoint — strictly more useful for testing than firing it and reading a `200`.

**Constrain it, do not document it.** The dispatcher takes an explicit mode, the tool registry marks each tool `read-only` or `side-effecting`, and **a test asserts every side-effecting tool is captured in playground mode** — so a sixth tool added later cannot default to dispatching. Same reasoning as `system.ts`'s surface test and the provider-SDK lockfile assertion.

**PRD Story 5.6 AC2 is amended to say this**, because a correct implementation of "identical" is the unsafe one. Third time an absolute's wording was itself the defect, after §10.2's "every repository function" and §13.3's "no deserialization path".

#### The 60-second cap is an abort, not a budget (ruled 2026-08-06)

§10.4 sets `AbortSignal.timeout(60_000)` and PRD Story 5.2 AC2 restates it. **NFR3 gives the whole pipeline 30 seconds at p95** — and §8.1 runs parse → thread resolve → classify (a model call) → retrieve → agent loop → persist in sequence, with **only the agent step carrying a stated budget, twice the end-to-end target.**

Not formally contradictory: a 30s p95 coexists with a 60s ceiling if the tail is thin. **But nothing made that true and nothing measured it.** NFR3 is asserted once, end-to-end, in Story 5.3 AC5; when it fails, no artifact says which step spent the time.

- **The abort stays at 60s.** It exists to stop a hung run; lowering it converts slow drafts into escalations, which is worse.
- **The agent's working budget is ~20s**, which is what NFR3 implies once classify, retrieve, and persist are accounted for. Crossing it is a signal, not a failure.
- **Per-step durations are recorded on the draft.** `drafts.tool_calls` is already `jsonb` and already carries per-step data, so this costs a field rather than a table. Without it NFR3 is a number that can only be missed, never diagnosed.
- **NFR3 is measured from `messages.received_at`**, not from workflow start. The queue wait is part of what the customer experiences, and excluding it measures a system nobody is running.

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
