> **Shard of [Architecture](../../Email%20Engine%20Architecture.md) §6.**
> Derived file — edit the source document and re-shard, never this copy.

## 6. Database schema

### 6.1 Multi-tenancy: shared schema + RLS

Every tenant-owned table carries a non-null `tenant_id` and a `FORCE`d RLS policy. The application connects as `app_user`, which is **not** the table owner and has no `BYPASSRLS`. Each request opens a transaction and sets the tenant from the verified Clerk claim:

```sql
BEGIN;
SELECT set_config('app.tenant_id', $1, true);  -- true = transaction-local
-- ... queries ...
COMMIT;
```

The `true` matters: `set_config(..., true)` scopes to the transaction, so a pooled connection can never leak a previous request's tenant.

```sql
CREATE OR REPLACE FUNCTION current_tenant_id() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.tenant_id', true), '')::uuid
$$;

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON conversations
  USING      (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());
```

`USING` filters reads; `WITH CHECK` blocks writing a row into someone else's tenant. Both are required — a policy with only `USING` lets an attacker insert into another tenant.

### 6.2 Core DDL

```sql
-- Corrected 2026-08-04. `pgcrypto` was listed and is obsolete —
-- gen_random_uuid() has been core since PostgreSQL 13. `citext` was missing
-- although the columns below use the type.
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "citext";

CREATE TABLE tenants (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  slug          citext UNIQUE NOT NULL,
  clerk_org_id  text UNIQUE NOT NULL,
  plan          text NOT NULL DEFAULT 'trial',
  status        text NOT NULL DEFAULT 'active',
  settings      jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- §6.8b and §6.8d. The single-value CHECK is deliberate: it states the
  -- region actually offered rather than one aspired to.
  region        text NOT NULL DEFAULT 'us-east'
                  CHECK (region IN ('us-east')),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE mailboxes (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  provider              text NOT NULL,
  address               citext NOT NULL,
  display_name          text,
  credentials_encrypted bytea NOT NULL,
  sync_cursor           text,
  sync_state            text NOT NULL DEFAULT 'idle',
  last_synced_at        timestamptz,
  is_active             boolean NOT NULL DEFAULT true,
  created_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, address)
);

CREATE TABLE conversations (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  mailbox_id       uuid NOT NULL REFERENCES mailboxes(id) ON DELETE CASCADE,
  contact_id       uuid REFERENCES contacts(id) ON DELETE SET NULL,
  subject          text NOT NULL DEFAULT '',
  thread_key       text NOT NULL,
  status           text NOT NULL DEFAULT 'open',
  assignee_id      uuid REFERENCES users(id) ON DELETE SET NULL,
  intent           text,
  sentiment        text,
  urgency          smallint,
  requires_human   boolean NOT NULL DEFAULT false,
  last_message_at  timestamptz NOT NULL DEFAULT now(),
  first_response_at timestamptz,
  resolved_at      timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, mailbox_id, thread_key)
);

CREATE TABLE messages (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  conversation_id     uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  direction           text NOT NULL CHECK (direction IN ('inbound','outbound')),
  provider_message_id text NOT NULL,
  in_reply_to         text,
  "references"        text[],
  from_address        citext NOT NULL,
  to_addresses        citext[] NOT NULL DEFAULT '{}',
  cc_addresses        citext[] NOT NULL DEFAULT '{}',
  subject             text,
  body_text           text,
  body_html_sanitized text,
  snippet             text,
  headers             jsonb NOT NULL DEFAULT '{}'::jsonb,
  has_attachments     boolean NOT NULL DEFAULT false,
  sent_at             timestamptz,
  received_at         timestamptz NOT NULL DEFAULT now(),
  -- the idempotency guarantee for the whole ingest path
  UNIQUE (tenant_id, provider_message_id)
);

CREATE TABLE kb_chunks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  source_id   uuid NOT NULL REFERENCES kb_sources(id) ON DELETE CASCADE,
  content     text NOT NULL,
  token_count integer NOT NULL,
  embedding   vector(1536),
  tsv         tsvector GENERATED ALWAYS AS (to_tsvector('english', content)) STORED,
  metadata    jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE outbound_messages (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  conversation_id     uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  draft_id            uuid REFERENCES drafts(id) ON DELETE SET NULL,
  state               text NOT NULL DEFAULT 'pending'
                        CHECK (state IN ('pending','claimed','sent',
                                         'failed','dead','cancelled')),
  attempt_count       smallint NOT NULL DEFAULT 0,
  last_error          text,
  provider_message_id text,
  scheduled_for       timestamptz NOT NULL DEFAULT now(),
  sent_at             timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now()
);
```

### 6.3 Indexes

```sql
-- Inbox: newest-first within a tenant, filtered by status
CREATE INDEX idx_conv_tenant_status_last
  ON conversations (tenant_id, status, last_message_at DESC);

-- Conversation view
CREATE INDEX idx_msg_conv_received
  ON messages (tenant_id, conversation_id, received_at);

-- Vector search. HNSW over cosine; lists tuned after real data volume.
CREATE INDEX idx_kb_embedding
  ON kb_chunks USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Keyword half of hybrid search
CREATE INDEX idx_kb_tsv ON kb_chunks USING gin (tsv);

-- Outbox drain: partial index keeps it tiny regardless of history size
CREATE INDEX idx_outbox_pending
  ON outbound_messages (scheduled_for)
  WHERE state = 'pending';

-- Contact lookup and fuzzy search
CREATE INDEX idx_contacts_email ON contacts (tenant_id, email);
CREATE INDEX idx_contacts_name_trgm ON contacts USING gin (name gin_trgm_ops);
```

> **Index rule:** every index on a tenant table leads with `tenant_id`. RLS adds `tenant_id = ...` to every query; an index that doesn't start there won't be used.

### 6.4 Hybrid retrieval query

```sql
WITH semantic AS (
  SELECT id, 1 - (embedding <=> $1::vector) AS score,
         row_number() OVER (ORDER BY embedding <=> $1::vector) AS rank
  FROM kb_chunks
  WHERE embedding IS NOT NULL
  ORDER BY embedding <=> $1::vector
  LIMIT 30
),
keyword AS (
  SELECT id, ts_rank(tsv, websearch_to_tsquery('english', $2)) AS score,
         row_number() OVER (ORDER BY ts_rank(tsv, websearch_to_tsquery('english', $2)) DESC) AS rank
  FROM kb_chunks
  WHERE tsv @@ websearch_to_tsquery('english', $2)
  LIMIT 30
)
SELECT c.id, c.content, c.metadata,
       COALESCE(1.0/(60 + s.rank), 0) + COALESCE(1.0/(60 + k.rank), 0) AS rrf
FROM kb_chunks c
LEFT JOIN semantic s ON s.id = c.id
LEFT JOIN keyword  k ON k.id = c.id
WHERE s.id IS NOT NULL OR k.id IS NOT NULL
ORDER BY rrf DESC
LIMIT 8;
```

RLS silently scopes all three scans to the current tenant — there is no `tenant_id` in this query by design.

> [!note] A reranker is worth measuring against this (noted 2026-08-04)
> The AI Gateway hosts `reranking` models alongside language and embedding ones — `getAvailableModels()` filters on `modelType`. A cross-encoder reranking the candidate set is a different primitive from RRF, which only merges two rank orders and never re-reads the query against the text.
>
> **Not a decision.** RRF is the right starting point: it is free, deterministic, and has no extra latency or token cost. But PRD §8 Q7 has to set a recall@8 bar before Epic 5 can start, and that measurement is the natural moment to try a reranker against the same labelled set. If RRF clears the bar, this stays a footnote. See [[Vercel AI Gateway]].

### 6.5 Migrations

Drizzle generates the table DDL; RLS policies and index DDL live in hand-written `.sql` files under `packages/db/migrations/policies/` and run after each generated migration. CI fails if any table with a `tenant_id` column lacks an enabled, forced policy — that check is a test, not a convention (§14).

### 6.6 As built (2026-08-02)

This schema has been applied to a PostgreSQL 17 instance ahead of the Drizzle setup, as hand-written SQL in [`migrations/`](./migrations/). As of `0003`: **17 tables, 39 indexes, 16 forced RLS policies**, and the `email_engine_app` role. (`0001` alone landed 16 tables, 38 indexes, and 15 policies; `0003` added `conversation_events` per §6.7.)

Both suites in [`tests/`](./tests/) pass and run in CI on every pull request touching `migrations/` or `tests/` — [`rls_isolation.sql`](./tests/rls_isolation.sql) covers §6.1 behaviourally with 10 checks, and [`rls_policy_coverage.sql`](./tests/rls_policy_coverage.sql) covers it structurally by walking the catalog, so a table added later with a `tenant_id` and no policy fails the build. §14 has the reasoning.

Sections 6.2–6.3 above remain the target. Three deviations were forced by the instance, which has **no extensions available at all** (`pg_available_extensions` returns only `plpgsql`):

| §6.2 specifies | As built | Consequence |
|---|---|---|
| `embedding vector(1536)` + HNSW index | `real[]` + dimension CHECK, no index | **§6.4 cannot run.** No `<=>` operator, so the semantic half of hybrid retrieval is absent; the keyword half (tsvector + GIN) works. |
| `citext` on slug/email columns | `text` + `UNIQUE` on `lower(...)` | Callers must apply `lower()` on both sides of a comparison; the app normalises on write. |
| `pg_trgm` index on `contacts.name` | btree on `lower(name)` | Prefix search only, no fuzzy match. |

`CREATE EXTENSION pgcrypto` was dropped entirely — `gen_random_uuid()` is core in PostgreSQL 13+.

Two notes for whoever provisions the real environment:

- **Check `pg_available_extensions` before trusting §6.2.** On a Neon instance pgvector is available and none of the above applies; reverting is `ALTER TABLE kb_chunks ALTER COLUMN embedding TYPE vector(1536)` plus recreating the two indexes.
- **§6.1 names the application role `app_user`, which is too generic to be safe.** On a shared cluster that name is likely already taken by another application, and roles are cluster-wide while tables are not — an `IF NOT EXISTS` guard will silently attach your grants to a stranger's login role. Use a database-specific name (`email_engine_app`) and assert the role has neither `BYPASSRLS` nor `SUPERUSER` before granting.

### 6.7 Schema changes from the front-end spec rulings — applied

Deltas 3 and 4 of §9.5 changed the schema. Both shipped as `migrations/0003_timeline_and_cancel.sql`, **written and applied on 2026-08-03** — to the scratch instance and, on every pull request, to a container-built schema in CI. *(This section said "not yet written or applied" until 2026-08-04; the DDL below is the record of what `0003` contains.)*

**1. `outbound_messages` gains a `cancelled` state** (§9.5 delta 3):

```sql
ALTER TABLE outbound_messages DROP CONSTRAINT outbound_messages_state_check;
ALTER TABLE outbound_messages ADD  CONSTRAINT outbound_messages_state_check
  CHECK (state IN ('pending','claimed','sent','failed','dead','cancelled'));
```

Sends are enqueued with `scheduled_for = now() + <undo window>` so a cancel can never race the §8.2 drain. No index change — `idx_outbox_pending` is partial on `state = 'pending'`, and a cancelled row correctly leaves it.

**2. `conversation_events` — the 17th table** (§9.5 delta 4):

```sql
CREATE TABLE conversation_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  type            text NOT NULL CHECK (type IN
                    ('escalated','draft_failed','auto_sent','send_failed','bounced','reopened')),
  body            text NOT NULL,          -- the one plain sentence (Story 5.4 AC3)
  metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_conv_events ON conversation_events (tenant_id, conversation_id, created_at);

ALTER TABLE conversation_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_events FORCE  ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON conversation_events
  USING (tenant_id = current_tenant_id()) WITH CHECK (tenant_id = current_tenant_id());

GRANT SELECT, INSERT ON conversation_events TO email_engine_app;
```

Append-only like `audit_events` — no `UPDATE` or `DELETE` grant. A timeline entry is a record of something that happened; editing one is never correct.

The index leads with `tenant_id` per §6.3's rule, and `tests/rls_policy_coverage.sql` will fail the PR if the policy above is ever dropped or written `USING`-only.

### 6.8 Ruling on PO finding F1 — which database is the target (2026-08-03)


> **§6.8 is a cluster of four database rulings** made after the section numbering was fixed, kept at lettered anchors because the PRD, the PO validation, and Story 1.2 all cite them:
>
> | | | |
> |---|---|---|
> | **§6.8** | Which database is the target | PO finding F1 |
> | **§6.8b** | Data region — a column, not a `settings` key | PO finding F6 |
> | **§6.8c** | `0004` is unnecessary; Drizzle defines the Neon schema | follows from F1 |
> | **§6.8d** | Data residency — one region, and the constraint that keeps it honest | PRD §8 Q2 |

[PO validation](./docs/po-validation-2026-08-03.md) F1: Epic 1 Story 1.2 provisions **Neon** and enables three extensions; the schema is applied to a **self-hosted PostgreSQL 17** where `pg_available_extensions` returns only `plpgsql`.

**Ruling: Neon is the target. The self-hosted instance is reclassified as a scratch environment and will never hold tenant data.**

Four reasons, in the order they bind:

1. **NFR25 already decided this.** "The system shall run on a single-vendor serverless platform with **no self-managed infrastructure**." A VPS whose extension set nobody can change is self-managed infrastructure by definition. The requirement was written before the instance existed; the instance is what violates it, not the other way round.

2. **The blocker is the proof.** `pgvector` has been unavailable for two days, not because the work is hard but because installing it needs shell access nobody has. That is exactly the failure mode NFR25 exists to prevent, and it has already cost the project its semantic-retrieval capability. Choosing the self-hosted box means accepting that every future extension, version bump, and `postgresql.conf` change carries the same dependency.

3. **§12's deployment model is not portable.** Preview environments get "a Neon branch per PR, auto-deleted on merge". On a shared cluster that becomes a database-per-PR provisioning system somebody has to build and garbage-collect. The branching model is a reason Neon was chosen (§2.2), not an incidental benefit.

4. **A shared cluster undercuts the product's own sales argument.** PRD §1.1 lists "tenant data isolation is provable, not asserted, so the product can be sold into security-reviewed accounts" as a goal. The current box runs ten databases for unrelated applications and already produced the `0002` incident, where 61 grants landed on a login role another application uses. RLS held throughout — but "our customers' mail shares a cluster with an unrelated POS system" is not a sentence that survives a security review, however good the policies are.

**What this costs: almost nothing.** The artifact was always the SQL, never the server. `migrations/` is portable PostgreSQL 17 and CI has been proving that on a clean container since `6e0cb53` — the self-hosted instance was never in the CI path. The RLS design, both test suites, and the workflow all move unchanged.

**What it changes:**

| | |
|---|---|
| ~~`migrations/0004_restore_extensions.sql`~~ | **Superseded 2026-08-04 — not needed. See §6.8c.** Neon starts empty, so there is nothing to revert |
| `0001`–`0003` | **Unchanged and immutable.** A migration log is append-only; rewriting it to look tidier is the habit that produces migrations which no longer describe how production got here. *(This row originally said `0004` would revert the substitutions — see §6.8c, which retired that migration. Nothing reverts them, because Neon never receives them.)* |
| §6.6 | Stands as the record of why `0001` looks the way it does. Not deleted |
| Epic 1 Story 1.2 | Unblocked. AC2 corrected — `pgcrypto` is obsolete (`gen_random_uuid()` is core since PostgreSQL 13), and `citext` was missing |
| PO finding F4 | Unblocked, and the answer improves: `tsvector` + GIN on `messages` for full-text search — core, so it was always the right call — **plus** `pg_trgm` returning to `contacts.name` for the fuzzy match §6.3 originally specified |
| The self-hosted instance | Scratch only. Useful for exactly what it has been used for: proving SQL applies and policies hold. **No tenant data, ever** |

**Consequently closed:** the `pgvector` + `postgresql17-contrib` shell-access item, and the `email_engine_app` password item. Neither is a blocker any more — Neon ships `pgvector`, and Neon manages the credential. Both were open for two days and are dissolved rather than solved.

### 6.8b Ruling on PO finding F6 — data region (2026-08-04)

NFR22: "Data region shall be a tenant-level attribute, even if only one region is offered at launch." `tenants` has no such column, and Epic 8's AC repeats the requirement.

**Ruling: a real column, not a `settings` key.**

```sql
region text NOT NULL DEFAULT 'us-east'
```

`settings` jsonb was the tempting alternative and is wrong here. Everything else in `settings` — persona, tone, auto-send threshold, business hours — is tenant *preference* that only the application reads. Region is different in kind: it determines **where rows may physically live**, it will eventually constrain connection routing, and a compliance answer that depends on a jsonb key nobody can constrain or index is not an answer. A `CHECK` on a column can enumerate the regions actually offered; a jsonb key cannot.

The default means every existing and future tenant has a truthful region from day one, so Epic 8 reports a fact rather than backfilling a guess.

**Lands in the Drizzle schema in Story 1.2** alongside the `tenants` definition — no hand-written migration, since Neon has no schema yet (§6.9).

### 6.8c `0004` is unnecessary — Drizzle defines the Neon schema (2026-08-04)

§6.8 called for `0004_restore_extensions.sql` to revert the §6.6 substitutions "once a Neon instance exists". Building the traceability matrix made it obvious that migration should never be written.

**Neon starts empty.** The substitutions exist because `0001` had to land on a server with no extensions. On a database where `vector`, `pg_trgm`, and `citext` are available from the first statement, the Drizzle schema simply *defines the intended types* — `vector(1536)`, `citext`, the HNSW and trigram indexes. There is no intermediate wrong state to correct, so a migration correcting it would be theatre: `0001` creating `real[]` on Neon purely so `0004` could change it back.

**Ruling:**

| | |
|---|---|
| `migrations/0001`–`0003` | **Never applied to Neon.** They are the record of the scratch-instance work and stay exactly as they are |
| Neon's schema | Created by **Drizzle from the schema definition** in Story 1.2, with the intended types from the start. Extensions enabled per Story 1.2 AC2; RLS policy DDL in `packages/db/migrations/policies/` per §6.5 |
| `tests/rls_isolation.sql`, `tests/rls_policy_coverage.sql` | **Keep both, and keep `db.yml` running them** against a container-built schema from `migrations/`. That job stops being a check on production and becomes a portability regression test — proof the RLS design holds on stock PostgreSQL 17 with no extensions, which is worth keeping and costs 30 seconds a PR |
| The same suites against the real schema | Story 1.3 AC5 already requires `rls_policy_coverage.sql` to run against the **Drizzle-migrated** schema. That is the check that guards production |

The two paths are deliberate: `db.yml` proves the design is portable, Story 1.3 AC5 proves the deployed schema is correct. Neither substitutes for the other.

**Consequence:** the §6.6 substitution table becomes purely historical the moment Neon exists. It stays in the document because it explains why `0001` looks the way it does, and because "check `pg_available_extensions` before designing against an extension" is the lesson that produced §6.8.

### 6.8d Ruling on PRD §8 Q2 — data residency (2026-08-04)

> *Single region now, or tenant→region routing designed up front?* Blocks Epic 8.

**Ruling: one region at launch. The attribute is the seam; the routing is not built.**

NFR22 asks only that region be *a tenant-level attribute, even if only one region is offered* — and §6.8b already delivered exactly that. The question left is whether to build routing, and the answer is no, for a reason specific to this architecture:

**Per-tenant region routing changes `withTenant()`, which is the most load-bearing function in the product** (§10.2). Today it opens a transaction and sets `app.tenant_id`. Routing would make it first resolve a *pool* from the tenant's region, which means the tenant lookup must happen before the tenant-scoped session exists — a chicken-and-egg that has to be solved with a global registry outside RLS. That is a real design, and it is the wrong thing to be designing before the first customer.

Everything else follows cheaply because the column exists: tenants carry a truthful region from day one, migrations stay single-path, and adding a second region later is a data move plus a routing layer rather than a schema redesign.

> [!warning] The column must not become another `scan_status`
> `region` defaults to `'us-east'` and nothing enforces it, which is precisely the shape of the `attachments.scan_status DEFAULT 'pending'` problem §13.3 had to fix — a field that looks like a capability and is actually a placeholder. It stays honest by **constraint, not by intention**:
>
> ```sql
> region text NOT NULL DEFAULT 'us-east'
>   CHECK (region IN ('us-east'))   -- extend only when a region is really offered
> ```
>
> A single-value `CHECK` looks absurd and is the point: it makes the column state what is *true* rather than what is *aspired to*, and adding `'eu-west'` becomes a deliberate migration at the moment the capability actually exists. Story 1.2 AC8 should carry this.

**What would force the decision earlier:** a customer with a contractual EU-residency requirement. That is a sales event, not a technical one — observable, and it arrives with a date attached. Revisit then, not on a schedule.

**Epic 8's AC5** — *"data region is a tenant attribute, and the audit trail satisfies a standard DPA review"* — is satisfiable as written under this ruling. The honest DPA answer is "one region, recorded per tenant, enforced by constraint", which reviews better than a routing layer nobody has exercised.

### 6.9 `notifications`, and where migrations live from here

**The table** (PO finding F3, PRD FR55, Story 1.7). Tenant-scoped and per-recipient, so RLS applies on `tenant_id` as everywhere else:

```sql
CREATE TABLE notifications (
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
  type        text NOT NULL,        -- assigned, escalated, mailbox_broken, send_failed
  title       text NOT NULL,
  body        text,
  entity_type text,                 -- conversation, mailbox, outbound_message
  entity_id   uuid,
  read_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
  -- id, PK omitted here; see the Drizzle schema
);

CREATE INDEX idx_notifications_unread
  ON notifications (tenant_id, user_id, created_at DESC)
  WHERE read_at IS NULL;
```

The partial index is the one query that matters — an unread badge on every page load. It stays small no matter how much history accumulates, the same trick as `idx_outbox_pending`.

`notifications` is **not** the conversation timeline. A notification for an escalation links to the `conversation_events` row (§6.7); it does not restate it. One event, one record, two surfaces.

**Where migrations live from here.** Story 1.2 introduces Drizzle, and from that point `drizzle-kit generate` owns schema change in `packages/db/migrations`. That makes the hand-written root `migrations/` a closed set:

| | |
|---|---|
| `migrations/0001`–`0003` | Applied, immutable, the pre-Drizzle history |
| ~~`migrations/0004_restore_extensions.sql`~~ | **Never written — retired by §6.8c.** Neon starts empty, so there is no substitution to revert. `0003` is therefore the last hand-written migration |
| Everything from Story 1.2 onward — the three core tables, `notifications`, the F4 search indexes, the F6 region column | **Drizzle-generated**, in `packages/db/migrations`. Extensions are enabled by Story 1.2 AC2 |

Both folders coexist permanently. `migrations/` is history and extensions; `packages/db/migrations` is the live schema. Story 1.2 should make the baseline explicit so Drizzle does not try to recreate sixteen tables that already exist.

---
