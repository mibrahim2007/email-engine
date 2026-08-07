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

> [!warning] This is an excerpt, and the constraints are what drift *(noted 2026-08-06)*
> The block below shows **eight of the eighteen tables**. Eight more — `users`, `memberships`, `contacts`, `attachments`, `drafts`, `api_keys`, `webhook_subscriptions`, `usage_records` — have their only written DDL in [`migrations/0001_init.sql`](../../migrations/0001_init.sql), **a file §6.8c says is never applied to Neon.** [`data-models.md`](./data-models.md) lists their fields without types or constraints. The remaining two are defined in rulings: `conversation_events` in §6.7 and `webhook_deliveries` in §6.7b.
>
> That is workable for columns and **is not workable for `CHECK` constraints**, which is where it has already gone wrong twice — `conversations.status` and `mailboxes.provider` both carried a `CHECK` in `0001` and none here until today, and Neon's schema comes from Drizzle, which is built from this block. Both constraints would simply have been absent on the only instance that matters.
>
> **Worse: §6.7a amends `drafts.state`'s CHECK and `drafts` is not in this block at all.** A ruling that changes a constraint on a table the architecture does not define sends its reader to the migration the architecture disowns.
>
> **Rule from here: a ruling that touches a CHECK states the whole constraint, not the delta** — and a story that creates a table brings its constraints from `0001`, not only its columns. Epic 4's story does this explicitly (Story 4.1 owns `kb_sources.status`'s CHECK); the earlier epics' stories should be re-read for it before approval.

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
  -- Added 2026-08-06 (Story 6.4). Business hours need a *business* timezone;
  -- `region` above is an infrastructure location, so a London tenant on
  -- us-east keeps London hours. IANA name, never an offset — a stored
  -- '-05:00' is correct for half the year. Defaulting to UTC is deliberately
  -- slightly wrong for everyone: a default of 'America/New_York' would look
  -- right to the majority and be invisibly wrong for the rest (§6.2 warning).
  timezone      text NOT NULL DEFAULT 'UTC',
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE mailboxes (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  provider              text NOT NULL
                          CHECK (provider IN ('gmail','outlook',
                                              'imap','inbound_webhook')),
  address               citext NOT NULL,
  display_name          text,
  credentials_encrypted bytea NOT NULL,
  sync_cursor           text,
  sync_state            text NOT NULL DEFAULT 'idle',
  last_synced_at        timestamptz,
  is_active             boolean NOT NULL DEFAULT true,
  -- Ruled 2026-08-05. Distinct from created_at on purpose: see §6.8e.
  connected_at          timestamptz NOT NULL DEFAULT now(),
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
  -- CHECK added 2026-08-06: `migrations/0001` has always had it and §6.2 never
  -- did. Neon's schema comes from Drizzle, which is built from this block, so
  -- the constraint would have been lost on the only instance that matters.
  status           text NOT NULL DEFAULT 'open'
                     CHECK (status IN ('open','pending','resolved','spam')),
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
  -- Both added 2026-08-06 (Story 6.1). `message_id` is the RFC 5322 header
  -- we generate and persist *before* the send attempt: it is what makes
  -- crash recovery possible (findSent, §4.1) and what matches an inbound
  -- DSN back to the send it is about (Story 6.5). One column, both problems.
  message_id          text,
  claimed_at          timestamptz,
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

### 6.7a Two Epic 5 schema rulings — Drizzle, not hand-written (2026-08-06)

Both found drafting Epic 5. Neither is a `migrations/` change: `0003` is the last hand-written migration (§6.9), and both tables below are defined by Drizzle on Neon.

**1. `drafts` gains `superseded`, plus a partial unique index.**

Story 5.5 AC5 requires regenerate to retain the prior draft. The prior draft was never approved or rejected, so it stays `proposed` — and the conversation now holds **two live drafts with nothing but `created_at` to separate them.**

FR42's auto-send drains `proposed` drafts above a confidence threshold and finds both. **The customer receives two replies.** FR41's exactly-once guarantee is untouched — `outbound_messages` correctly sends each of two legitimate rows exactly once. **A uniqueness mechanism protects the table it is written on and says nothing about a duplicate created above it.**

**`drafts` is not in §6.2**, so the whole constraint is stated here rather than a delta — see §6.2's warning. Its existing DDL is `migrations/0001_init.sql`, which Neon never receives; Drizzle defines the table from this:

```sql
-- drafts.state — the complete constraint, not a delta
CHECK (state IN ('proposed','approved','rejected','edited',
                 'auto_sent','superseded'))

CREATE UNIQUE INDEX idx_drafts_one_live
  ON drafts (tenant_id, conversation_id)
  WHERE state = 'proposed';
```

Regenerate supersedes the prior draft in the **same transaction** as the insert. AC5's "retained in history" holds — the row stays readable with its confidence and citations intact.

The index is the point: two concurrent regenerates cannot both land, and Epic 6's drain cannot find two candidates, **because the database will not hold them** — not because every query remembered to `ORDER BY`. Fourth time an invariant was made structural rather than temporal, after `scheduled_for`, the backfill window, and Story 4.3's atomic promotion.

> **A partial unique index enforces *at most one*, which is what this needs** — and is precisely what Story 1.5's last-owner rule could not use, because that one needs *at least one* and there is no row to hang a constraint on when the last one leaves. Same tool, decisive in one case and useless in the other.

**2. Classification moves onto `messages`, and `requires_human` becomes a latch.**

FR30 classifies **every inbound message**; `conversations` holds one `intent`, one `sentiment`, one `urgency`, one `requires_human`, and `messages` holds none. So each message overwrites its predecessor — identical to correct behaviour for a single-message conversation, which is every conversation in testing.

**The damage is not the lost history.** Message 2 is angry and escalates; message 3 says "never mind, thanks" and its classification writes `requires_human = false`. **The conversation silently leaves the escalation queue and nobody ever read message 2.** Worse the more polite the customer is, and §1.4's escalation-precision metric measures flags that were raised — it cannot see one withdrawn.

`messages` gains `intent`, `sentiment`, `urgency`, `language`, `pii_detected`, `requires_human`, `classified_at`, `classification_model`, all nullable — a row predating Story 5.1 is `classified_at IS NULL`, which is true and distinguishable from "classified as nothing".

The conversation's columns become a **derived summary with stated rules**, never last-write-wins: `intent` is the **first** classified (what the customer originally wanted), `sentiment` the **most negative** seen, `urgency` the **maximum** seen, and `requires_human` **latched** — set by a classifier, cleared only by a human resolving, assigning, or dismissing.

> **An acceptance criterion that reads like a field is often a state machine.** Third instance: Story 1.5's last-owner rule, the send-undo race, and now this. The tell is a value that a later, individually-correct write may lower.

### 6.7b Two Epic 7 schema rulings (2026-08-07)

Both found drafting Epic 7. Neither is in §6.2 above, so both state their constraints in full — §6.2's warning.

**1. `api_keys` gains `role` and `scopes`.**

Story 7.1 AC1 creates keys "with a name and **scope**", and `api_keys` has neither a scope nor a role column — so as the schema stands **every key is full access**, including `POST /v1/conversations/:id/reply`, which sends mail to customers.

§10.3 already assumes the answer: *"Both paths converge on the same `{ tenant, role }` shape, so authorization logic is written once."* A key therefore has a role, and nothing stored it.

```sql
ALTER TABLE api_keys
  ADD COLUMN role text NOT NULL DEFAULT 'viewer'
    CHECK (role IN ('owner','admin','agent','viewer')),
  ADD COLUMN scopes text[] NOT NULL DEFAULT '{conversations:read}';
```

Two columns because they answer different questions. **`role`** feeds the existing `requireRole()` so authorization stays written once; **`scopes`** narrows which resources a key touches, because a reporting integration wants read-only conversations and an ingest integration wants `kb:write` and no conversation access at all. Role alone is too coarse; scopes alone would duplicate the role logic §10.3 exists to avoid.

**The default is the narrowest useful thing, not the widest** — a key created by submitting the form quickly gets `conversations:read`, never send-mail. And **a key can never exceed the role of the user who created it**, enforced at creation, or an `agent` mints an `owner` key and role separation is decorative.

**2. `webhook_deliveries` — the 18th table.**

Story 7.4 AC3 requires retry with backoff for 24 hours and visible delivery history. That is `outbound_messages` again for a different transport, and **the schema had `webhook_subscriptions` and nothing else** — so the history had nowhere to live and the retry had nothing to retry from.

```sql
CREATE TABLE webhook_deliveries (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  subscription_id uuid NOT NULL REFERENCES webhook_subscriptions(id) ON DELETE CASCADE,
  event_type      text NOT NULL,
  payload         jsonb NOT NULL,
  state           text NOT NULL DEFAULT 'pending'
                    CHECK (state IN ('pending','claimed','delivered','failed','dead')),
  attempt_count   smallint NOT NULL DEFAULT 0,
  last_error      text,
  response_status smallint,
  idempotency_key text NOT NULL,
  scheduled_for   timestamptz NOT NULL DEFAULT now(),
  claimed_at      timestamptz,
  delivered_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_webhook_deliveries_pending
  ON webhook_deliveries (scheduled_for) WHERE state = 'pending';
```

**The state machine mirrors the outbox deliberately**, because it is the same problem: §8.2's atomic `SECURITY DEFINER` claim returning two columns, jittered and capped backoff so 400 failures do not retry in lockstep, and `claimed_at` for the reaper. Reusing the shape is the point — a second, subtly different outbox is how one of them keeps a bug the other fixed.

> **One deliberate asymmetry with the outbox: there is no `findSent` problem here.** A duplicate HTTP POST carrying a stable `idempotency_key` is a non-event if the receiver honours it, and the spec requires them to. A duplicate *email* is not recoverable that way, which is exactly why §4.1 needed a per-provider capability flag and this does not. **The recovery story differs because the transport's idempotency story differs**, not because one was designed more carefully.

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

### 6.8e Ruling — `mailboxes.connected_at` is its own column (2026-08-05)

Story 2.1 asked whether the backfill boundary can reuse `created_at`. **It cannot, and the difference only shows up in the case that matters.**

Story 2.8 bounds backfill to `[connected_at − 30 days, connected_at)` so it cannot overlap live ingest. If that boundary reads `created_at`:

> A tenant connects a mailbox, revokes it a month later, then reconnects. `created_at` still points at the original connection, so the backfill re-fetches a month of mail the product has **already processed and replied to** — inserting it as historical, or worse, re-drafting it.

`connected_at` moves on reconnect; `created_at` records when the row appeared. They are the same value exactly once, which is why one can masquerade as the other right up until the first reconnection.

**Rule:** `connect()` sets `connected_at = now()` on every successful connection, including reconnection of an existing row. `created_at` is never written twice.

> **The general form is worth keeping.** A timestamp that means "when this row was created" and a timestamp that means "when this thing last started" coincide until the thing restarts — and reusing one for the other is a bug that cannot be found by testing the happy path, only by asking what happens the second time.

### 6.8f RLS post-filters an approximate index, so §6.4's semantic half returns nothing at scale (ruled 2026-08-06)

Found drafting Story 4.4, comparing Epic 4's requirements to Epic 1's design. **§6.4 is correct as written and stops working somewhere between the first tenant and the five hundredth.**

**With an approximate index, filtering is applied after the index is scanned.** pgvector documents it plainly: with `hnsw.ef_search` at its default of 40, a condition matching 10% of rows leaves about 4 rows. An RLS policy is a filter — `USING (tenant_id = current_tenant_id())` is applied to tuples HNSW has already returned, and cannot restrict which region of the graph is searched. §6.4's deliberate absence of a `tenant_id` predicate, which is what makes it correct, is also what leaves the planner nothing to narrow with.

At NFR7's scale — 500 tenants × 5,000 chunks = 2.5M rows, one tenant holding 0.2% — the `semantic` CTE asks for `LIMIT 30` and expected survivors are **40 × 0.002 ≈ 0.08 rows.**

**Nothing errors.** The `LEFT JOIN`s and `WHERE s.id IS NOT NULL OR k.id IS NOT NULL` behave exactly as written, RRF fuses one input instead of two, and **hybrid retrieval silently becomes keyword-only.** FR29 reads as satisfied because both halves ran. NFR5's 150ms budget is *easier* to hit, because the expensive half found nothing — **the performance target rewards the failure.** Downstream, Epic 5 drafts against whatever literal keyword overlap survives, with citations, confidence, and a tool trace that all look normal.

**No acceptance criterion in Epic 4 could catch it.** Every one measures a single tenant, where that tenant is 100% of the table, RLS filters nothing, and 40 comfortably serves 30. The defect is a function of tenant count, so it ships green and worsens with every customer added.

**Ruling — iterative index scans, set transaction-locally in `withTenant()`:**

```sql
SET LOCAL hnsw.iterative_scan = strict_order;
SET LOCAL hnsw.max_scan_tuples = 40000;
SET LOCAL hnsw.ef_search = 200;
```

pgvector 0.8 (the pinned version) added iterative scans for exactly this: the index is scanned further until enough rows survive filtering. `strict_order` and not `relaxed_order`, because §6.4 takes `LIMIT 30` from a distance ordering and feeds `row_number()` into RRF — relaxed order permits the wrong 30 to be taken, corrupting the rank input the fusion is computed from. `SET LOCAL` for the same reason `app.tenant_id` is transaction-local: it must not leak across pooled connections.

**Iterative scan is bounded, so it narrows the window rather than closing it.** When the semantic CTE returns zero rows against a non-empty knowledge base, that is an observable event and must be logged — it is the only signal separating "hybrid retrieval running" from "hybrid retrieval reporting".

**The structural fix is partitioning, and it is deferred with a trigger.** pgvector recommends partial indexes for few distinct filter values and **partitioning for many**; 500 tenants is many. Partitioning `kb_chunks` by `tenant_id` changes Epic 5's write path and is not worth doing before a customer exists — but `SET LOCAL` is a mitigation, not an answer. **Revisit when `max_scan_tuples` is being reached routinely**, which the log line above is what makes visible.

**And every measurement of this query must be multi-tenant.** A single-tenant benchmark measures a different query and would certify this defect as passing — including the recall@8 set that answers PRD §8 Q7. Whoever sets that bar must be told which measurement it is a bar for.

> **The general form.** *A correctness mechanism and a performance mechanism can each be right and compose into something that is neither.* RLS is applied after the ANN scan; neither document describing them mentions the other, because each is complete on its own terms. The tell is a filter that the query deliberately does not express — if the planner cannot see the predicate, no index can be chosen for it.

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
