-- Email Engine — initial schema migration
-- Target: PostgreSQL 17, database `email_engine`
-- Source of truth: "Email Engine Architecture.md" §5 (data models), §6 (schema, RLS, indexes)
--
-- Run as the database owner (postgres). The application connects as
-- `email_engine_app` (see 0002, which supersedes the `app_user` role created in
-- §5 below), which is deliberately NOT the table owner and has no BYPASSRLS, so
-- the forced row-level security policies below cannot be sidestepped by
-- application code.
--
-- ===========================================================================
-- DEVIATIONS FROM THE ARCHITECTURE — this server has NO extensions available.
-- `pg_available_extensions` on the target server returns only `plpgsql`: the
-- contrib package and pgvector are not installed. Three substitutions were
-- made so the schema can land now. Each is a TODO to revert once the server
-- has `postgresql17-contrib` + `pgvector`:
--
--   1. citext  -> text. Case-insensitive uniqueness is enforced with UNIQUE
--      indexes on lower(...). The application must normalise addresses on
--      write; equality comparisons in queries must use lower() on both sides.
--   2. pg_trgm -> dropped. The fuzzy contact-name index is a plain btree on
--      lower(name), so only prefix search works, not fuzzy match.
--   3. vector(1536) -> real[]. THE SEMANTIC HALF OF RETRIEVAL IS NON-FUNCTIONAL:
--      there is no `<=>` cosine operator and no HNSW index, so the hybrid
--      query in Architecture §6.4 cannot run. Only the keyword half (tsv/GIN,
--      both core Postgres) works. Do not build Epic 5 against this until
--      pgvector is installed; the column is shaped to convert cleanly with
--      ALTER TABLE kb_chunks ALTER COLUMN embedding TYPE vector(1536).
--
-- gen_random_uuid() needs no pgcrypto — it is core in PostgreSQL 13+.
-- tsvector + GIN are core, so keyword search is unaffected.
-- ===========================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Tenancy helper
-- ---------------------------------------------------------------------------
-- Transaction-local tenant, set per request from the verified Clerk claim:
--   SELECT set_config('app.tenant_id', $1, true);
-- The `true` scopes it to the transaction so a pooled connection can never
-- leak a previous request's tenant.
CREATE OR REPLACE FUNCTION current_tenant_id() RETURNS uuid
LANGUAGE sql STABLE AS $fn$
  SELECT NULLIF(current_setting('app.tenant_id', true), '')::uuid
$fn$;

-- ---------------------------------------------------------------------------
-- 2. Tables
-- ---------------------------------------------------------------------------

CREATE TABLE tenants (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  slug          text NOT NULL,                      -- was citext
  clerk_org_id  text UNIQUE NOT NULL,
  plan          text NOT NULL DEFAULT 'trial',
  status        text NOT NULL DEFAULT 'active',
  settings      jsonb NOT NULL DEFAULT '{}'::jsonb, -- persona, tone, auto_send_threshold, business_hours, locale
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Identity is owned by Clerk; `users` is a mirror and is intentionally global
-- (a user may belong to many tenants), so it carries no tenant_id and no RLS.
CREATE TABLE users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id text UNIQUE NOT NULL,
  email         text NOT NULL,                      -- was citext
  name          text,
  avatar_url    text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE memberships (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role       text NOT NULL CHECK (role IN ('owner','admin','agent','viewer')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, user_id)
);

CREATE TABLE mailboxes (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  provider              text NOT NULL CHECK (provider IN ('gmail','outlook','imap','inbound_webhook')),
  address               text NOT NULL,              -- was citext
  display_name          text,
  credentials_encrypted bytea NOT NULL,
  sync_cursor           text,
  sync_state            text NOT NULL DEFAULT 'idle',
  last_synced_at        timestamptz,
  is_active             boolean NOT NULL DEFAULT true,
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE contacts (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email              text NOT NULL,                 -- was citext
  name               text,
  company            text,
  custom_fields      jsonb NOT NULL DEFAULT '{}'::jsonb,
  first_seen_at      timestamptz NOT NULL DEFAULT now(),
  last_seen_at       timestamptz NOT NULL DEFAULT now(),
  conversation_count integer NOT NULL DEFAULT 0
);

CREATE TABLE conversations (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  mailbox_id        uuid NOT NULL REFERENCES mailboxes(id) ON DELETE CASCADE,
  contact_id        uuid REFERENCES contacts(id) ON DELETE SET NULL,
  subject           text NOT NULL DEFAULT '',
  thread_key        text NOT NULL,
  status            text NOT NULL DEFAULT 'open' CHECK (status IN ('open','pending','resolved','spam')),
  assignee_id       uuid REFERENCES users(id) ON DELETE SET NULL,
  intent            text,
  sentiment         text,
  urgency           smallint,
  requires_human    boolean NOT NULL DEFAULT false,
  last_message_at   timestamptz NOT NULL DEFAULT now(),
  first_response_at timestamptz,
  resolved_at       timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
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
  from_address        text NOT NULL,                -- was citext
  to_addresses        text[] NOT NULL DEFAULT '{}', -- was citext[]
  cc_addresses        text[] NOT NULL DEFAULT '{}', -- was citext[]
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

CREATE TABLE attachments (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  message_id   uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  filename     text NOT NULL,
  content_type text,
  size_bytes   bigint,
  blob_url     text,
  checksum     text,
  scan_status  text NOT NULL DEFAULT 'pending',
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE kb_sources (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  type            text NOT NULL CHECK (type IN ('url','file','text','faq')),
  title           text NOT NULL,
  uri             text,
  status          text NOT NULL DEFAULT 'pending',
  last_indexed_at timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE kb_chunks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  source_id   uuid NOT NULL REFERENCES kb_sources(id) ON DELETE CASCADE,
  content     text NOT NULL,
  token_count integer NOT NULL,
  -- TODO(pgvector): should be vector(1536). real[] is a placeholder with no
  -- distance operator and no ANN index — semantic retrieval does not work.
  embedding   real[],
  tsv         tsvector GENERATED ALWAYS AS (to_tsvector('english', content)) STORED,
  metadata    jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT embedding_dims CHECK (embedding IS NULL OR array_length(embedding, 1) = 1536)
);

CREATE TABLE drafts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  body_text       text,
  body_html       text,
  confidence      numeric(4,3) CHECK (confidence >= 0 AND confidence <= 1),
  citations       jsonb NOT NULL DEFAULT '[]'::jsonb,
  model           text,
  tool_calls      jsonb NOT NULL DEFAULT '[]'::jsonb,
  state           text NOT NULL DEFAULT 'proposed'
                    CHECK (state IN ('proposed','approved','rejected','edited','auto_sent')),
  reviewed_by     uuid REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE outbound_messages (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  conversation_id     uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  draft_id            uuid REFERENCES drafts(id) ON DELETE SET NULL,
  state               text NOT NULL DEFAULT 'pending'
                        CHECK (state IN ('pending','claimed','sent','failed','dead')),
  attempt_count       smallint NOT NULL DEFAULT 0,
  last_error          text,
  provider_message_id text,
  scheduled_for       timestamptz NOT NULL DEFAULT now(),
  sent_at             timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE api_keys (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name         text NOT NULL,
  key_hash     text UNIQUE NOT NULL,   -- only the hash is stored
  key_prefix   text NOT NULL,          -- shown in the UI, e.g. sk_live_abcd
  last_used_at timestamptz,
  revoked_at   timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE webhook_subscriptions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  url              text NOT NULL,
  events           text[] NOT NULL DEFAULT '{}',  -- message.received, draft.created, ...
  secret_encrypted bytea NOT NULL,                -- HMAC-SHA256 signing secret
  is_active        boolean NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- Append-only: app_user gets SELECT and INSERT, never UPDATE or DELETE.
CREATE TABLE audit_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  actor_type  text NOT NULL CHECK (actor_type IN ('user','system','agent')),
  actor_id    text,
  action      text NOT NULL,
  entity_type text,
  entity_id   text,
  metadata    jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip          inet,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE usage_records (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  period      text NOT NULL,                       -- YYYY-MM
  metric      text NOT NULL
                CHECK (metric IN ('messages_processed','ai_replies','tokens_in','tokens_out')),
  quantity    bigint NOT NULL DEFAULT 0,
  recorded_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 3. Indexes
-- Rule: every index on a tenant table leads with tenant_id. RLS appends
-- `tenant_id = ...` to every query; an index that doesn't start there is dead.
-- ---------------------------------------------------------------------------

-- Case-insensitive uniqueness, standing in for citext
CREATE UNIQUE INDEX uq_tenants_slug     ON tenants (lower(slug));
CREATE UNIQUE INDEX uq_mailboxes_addr   ON mailboxes (tenant_id, lower(address));
CREATE UNIQUE INDEX uq_contacts_email   ON contacts (tenant_id, lower(email));
CREATE INDEX        idx_users_email     ON users (lower(email));

-- Inbox: newest-first within a tenant, filtered by status
CREATE INDEX idx_conv_tenant_status_last
  ON conversations (tenant_id, status, last_message_at DESC);

-- Conversation view
CREATE INDEX idx_msg_conv_received
  ON messages (tenant_id, conversation_id, received_at);

-- Keyword half of hybrid search (the semantic half needs pgvector)
CREATE INDEX idx_kb_tsv ON kb_chunks USING gin (tsv);

-- Outbox drain: partial index stays tiny regardless of history size
CREATE INDEX idx_outbox_pending
  ON outbound_messages (scheduled_for)
  WHERE state = 'pending';

-- Contact name lookup. TODO(pg_trgm): replace with
--   CREATE INDEX ... USING gin (name gin_trgm_ops)  -- fuzzy match
CREATE INDEX idx_contacts_name_lower ON contacts (tenant_id, lower(name));

-- Supporting lookups
CREATE INDEX idx_memberships_user    ON memberships (user_id);
CREATE INDEX idx_mailboxes_tenant    ON mailboxes (tenant_id) WHERE is_active;
CREATE INDEX idx_attachments_message ON attachments (tenant_id, message_id);
CREATE INDEX idx_kb_chunks_source    ON kb_chunks (tenant_id, source_id);
CREATE INDEX idx_drafts_conversation ON drafts (tenant_id, conversation_id, created_at DESC);
CREATE INDEX idx_audit_tenant_created ON audit_events (tenant_id, created_at DESC);
CREATE INDEX idx_usage_tenant_period ON usage_records (tenant_id, period, metric);

-- ---------------------------------------------------------------------------
-- 4. Row-level security
-- Every tenant-owned table: ENABLE + FORCE + a policy with both USING and
-- WITH CHECK. USING alone filters reads but still lets an attacker insert a
-- row into someone else's tenant.
-- ---------------------------------------------------------------------------
DO $rls$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'tenants','memberships','mailboxes','contacts','conversations','messages',
    'attachments','kb_sources','kb_chunks','drafts','outbound_messages',
    'api_keys','webhook_subscriptions','audit_events','usage_records'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    IF t = 'tenants' THEN
      -- the tenants row itself is keyed by id, not tenant_id
      EXECUTE format('CREATE POLICY tenant_isolation ON %I USING (id = current_tenant_id()) WITH CHECK (id = current_tenant_id())', t);
    ELSE
      EXECUTE format('CREATE POLICY tenant_isolation ON %I USING (tenant_id = current_tenant_id()) WITH CHECK (tenant_id = current_tenant_id())', t);
    END IF;
  END LOOP;
END
$rls$;

-- ---------------------------------------------------------------------------
-- 5. Application role
-- Created NOLOGIN on purpose: set a password yourself so no credential is
-- written into a migration file that lives in a repo.
--   ALTER ROLE app_user LOGIN PASSWORD '...';
-- app_user must never own these tables and must never hold BYPASSRLS.
--
-- SUPERSEDED BY 0002_dedicated_role.sql. `app_user` is a name generic enough
-- that a role of that name may already exist on a shared cluster — roles are
-- cluster-wide, tables are not, so the `IF NOT EXISTS` guard below can skip
-- creation and attach these grants to somebody else's login role. 0002 moves
-- every grant here to a database-specific `email_engine_app`, asserts that
-- role holds neither BYPASSRLS nor SUPERUSER, and revokes app_user. The grants
-- below are historical — read 0002 for the privileges actually in force.
-- ---------------------------------------------------------------------------
DO $role$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
    CREATE ROLE app_user NOLOGIN NOBYPASSRLS;
  END IF;
END
$role$;

GRANT USAGE ON SCHEMA public TO app_user;

GRANT SELECT, INSERT, UPDATE, DELETE ON
  tenants, memberships, mailboxes, contacts, conversations, messages,
  attachments, kb_sources, kb_chunks, drafts, outbound_messages,
  api_keys, webhook_subscriptions, usage_records
TO app_user;

-- Clerk webhook mirrors identity into users; no delete grant
GRANT SELECT, INSERT, UPDATE ON users TO app_user;

-- Append-only audit trail
GRANT SELECT, INSERT ON audit_events TO app_user;

COMMIT;
