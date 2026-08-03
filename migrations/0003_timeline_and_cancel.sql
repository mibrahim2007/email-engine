-- Email Engine — 0003: conversation timeline events and send cancellation
-- Target: PostgreSQL 17, database `email_engine`
-- Source of truth: "Email Engine Architecture.md" §6.7, ruled in §9.5
--
-- Two changes, both consequences of the front-end spec:
--
--   1. `outbound_messages` gains a `cancelled` state, so send-undo can retract
--      a queued reply without deleting the row. Deleting would lose the trail
--      FR53 and NFR15 require — an audit record of a reply that was almost
--      sent is exactly the kind of thing an audit is for.
--
--      Undo does not race the §8.2 drain. Sends are enqueued with
--      `scheduled_for = now() + <undo window>`, and the drain already filters
--      `scheduled_for <= now()`, so a row inside its window is ineligible
--      rather than contested. The cancelling UPDATE reports the truth through
--      its row count: 1 means cancelled, 0 means already claimed.
--
--   2. `conversation_events` — the conversation timeline is a heterogeneous
--      list of messages AND system events. NFR23 (a failed draft appears in
--      the timeline), Story 5.4 AC3 (the escalation sentence in the
--      conversation), and Story 6.5 AC4 (delivery failures visible in the
--      timeline, not only in logs) all land here.
--
--      Not `audit_events` with a UNION: audit is a compliance artifact with a
--      retention lifetime, this is product copy that changes with the UI, and
--      coupling them means a wording tweak edits the security record.
--
-- Run as the database owner (postgres). Same no-extension constraints as
-- 0001 — nothing here needs one.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. outbound_messages: allow `cancelled`
-- ---------------------------------------------------------------------------
-- The CHECK was declared inline in 0001, so its name is generated. Look it up
-- rather than assuming: `DROP CONSTRAINT IF EXISTS <guessed name>` would do
-- nothing on a mismatch and then ADD a second constraint while the original
-- kept rejecting 'cancelled' — a silent half-migration. Same failure shape as
-- the `IF NOT EXISTS` role guard that made 0002 necessary.
DO $state_check$
DECLARE
  cname text;
  n     int;
BEGIN
  SELECT count(*), min(conname) INTO n, cname
  FROM pg_constraint
  WHERE conrelid = 'outbound_messages'::regclass
    AND contype  = 'c'
    AND pg_get_constraintdef(oid) LIKE '%state%';

  IF n <> 1 THEN
    RAISE EXCEPTION
      'expected exactly one CHECK constraint on outbound_messages.state, found % — resolve by hand', n;
  END IF;

  EXECUTE format('ALTER TABLE outbound_messages DROP CONSTRAINT %I', cname);
END
$state_check$;

ALTER TABLE outbound_messages
  ADD CONSTRAINT outbound_messages_state_check
  CHECK (state IN ('pending','claimed','sent','failed','dead','cancelled'));

-- idx_outbox_pending is partial on state = 'pending', so a cancelled row
-- leaves the index by itself. No index change needed.

-- ---------------------------------------------------------------------------
-- 2. conversation_events
-- ---------------------------------------------------------------------------
CREATE TABLE conversation_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  type            text NOT NULL CHECK (type IN
                    ('escalated','draft_failed','auto_sent','send_failed','bounced','reopened')),
  -- The one plain sentence the agent reads (Story 5.4 AC3). Rendered as text,
  -- never as HTML — this is written by the system, but it quotes model output.
  body            text NOT NULL,
  metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Leads with tenant_id per §6.3: RLS appends `tenant_id = ...` to every query,
-- so an index starting anywhere else would not be chosen. Ordering by
-- created_at serves the only read this table has — one conversation's timeline.
CREATE INDEX idx_conv_events
  ON conversation_events (tenant_id, conversation_id, created_at);

ALTER TABLE conversation_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_events FORCE  ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON conversation_events
  USING      (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Append-only, like audit_events: no UPDATE, no DELETE. A timeline entry
-- records something that happened; editing one is never correct.
GRANT SELECT, INSERT ON conversation_events TO email_engine_app;

-- ---------------------------------------------------------------------------
-- 3. Post-conditions
-- ---------------------------------------------------------------------------
-- Assert what this migration claims to have done, inside the transaction that
-- did it, so a partial apply rolls back instead of shipping.
DO $verify$
DECLARE
  def text;
BEGIN
  SELECT pg_get_constraintdef(oid) INTO def
  FROM pg_constraint
  WHERE conrelid = 'outbound_messages'::regclass
    AND conname  = 'outbound_messages_state_check';

  IF def IS NULL OR def NOT LIKE '%cancelled%' THEN
    RAISE EXCEPTION 'outbound_messages still rejects the cancelled state';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    WHERE c.oid = 'conversation_events'::regclass
      AND c.relrowsecurity AND c.relforcerowsecurity
  ) THEN
    RAISE EXCEPTION 'conversation_events is missing ENABLE or FORCE row level security';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policy
    WHERE polrelid = 'conversation_events'::regclass
      AND polcmd = '*' AND polqual IS NOT NULL AND polwithcheck IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'conversation_events has no FOR ALL policy with both USING and WITH CHECK';
  END IF;

  RAISE NOTICE 'PASS  0003 — cancelled state accepted, conversation_events forced and policied';
END
$verify$;

COMMIT;
