-- Email Engine — RLS tenant isolation test
-- Database: email_engine.  Run as postgres (or any superuser).
--
-- Architecture §14 makes this suite a merge blocker: a forgotten
-- `WHERE tenant_id = ?` must return zero rows, not another customer's mail.
--
-- The test does NOT need email_engine_app's password. `SET ROLE` switches the
-- session to that role, and RLS starts applying the moment the current role is
-- neither superuser nor BYPASSRLS. Seeding happens first, as postgres, whose
-- superuser bypass lets it write rows for both tenants.
--
-- Everything runs inside one transaction that ends in ROLLBACK — no test data
-- survives. Results land in the Messages pane via RAISE NOTICE.

BEGIN;

-- ---------------------------------------------------------------------------
-- Seed: two tenants, one mailbox / conversation / message each
-- ---------------------------------------------------------------------------
INSERT INTO tenants (id, name, slug, clerk_org_id) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Tenant A', 'tenant-a', 'org_test_a'),
  ('22222222-2222-2222-2222-222222222222', 'Tenant B', 'tenant-b', 'org_test_b');

INSERT INTO mailboxes (id, tenant_id, provider, address, credentials_encrypted) VALUES
  ('11111111-1111-1111-1111-1111111111aa', '11111111-1111-1111-1111-111111111111',
   'imap', 'a@example.test', '\x00'::bytea),
  ('22222222-2222-2222-2222-2222222222bb', '22222222-2222-2222-2222-222222222222',
   'imap', 'b@example.test', '\x00'::bytea);

INSERT INTO conversations (id, tenant_id, mailbox_id, subject, thread_key) VALUES
  ('11111111-1111-1111-1111-1111111111cc', '11111111-1111-1111-1111-111111111111',
   '11111111-1111-1111-1111-1111111111aa', 'A: invoice question', 'thread-a'),
  ('22222222-2222-2222-2222-2222222222dd', '22222222-2222-2222-2222-222222222222',
   '22222222-2222-2222-2222-2222222222bb', 'B: refund request',   'thread-b');

INSERT INTO messages (tenant_id, conversation_id, direction, provider_message_id, from_address) VALUES
  ('11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-1111111111cc',
   'inbound', 'msg-a-1', 'alice@example.test'),
  ('22222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-2222222222dd',
   'inbound', 'msg-b-1', 'bob@example.test');

-- ---------------------------------------------------------------------------
-- The test, run as the application role
-- ---------------------------------------------------------------------------
DO $test$
DECLARE
  tenant_a  constant uuid := '11111111-1111-1111-1111-111111111111';
  tenant_b  constant uuid := '22222222-2222-2222-2222-222222222222';
  conv_b    constant uuid := '22222222-2222-2222-2222-2222222222dd';
  mbox_b    constant uuid := '22222222-2222-2222-2222-2222222222bb';
  n         bigint;
  rows_hit  bigint;
  passed    int := 0;
  failed    int := 0;
BEGIN
  EXECUTE 'SET LOCAL ROLE email_engine_app';

  RAISE NOTICE '--- running as %, superuser=%, bypassrls=% ---',
    current_user,
    (SELECT rolsuper     FROM pg_roles WHERE rolname = current_user),
    (SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user);

  -- 1. No tenant set at all: everything must be invisible.
  SELECT count(*) INTO n FROM conversations;
  IF n = 0 THEN passed := passed + 1;
    RAISE NOTICE 'PASS 1  no app.tenant_id  -> conversations visible: 0';
  ELSE failed := failed + 1;
    RAISE WARNING 'FAIL 1  no app.tenant_id  -> conversations visible: % (expected 0)', n;
  END IF;

  -- Now act as tenant A for the rest of the test.
  PERFORM set_config('app.tenant_id', tenant_a::text, true);

  -- 2. Reads are scoped to A.
  SELECT count(*) INTO n FROM conversations;
  IF n = 1 AND (SELECT bool_and(tenant_id = tenant_a) FROM conversations) THEN
    passed := passed + 1;
    RAISE NOTICE 'PASS 2  tenant=A          -> conversations visible: 1, all tenant A';
  ELSE failed := failed + 1;
    RAISE WARNING 'FAIL 2  tenant=A          -> conversations visible: % (expected 1, tenant A only)', n;
  END IF;

  -- 3. The unscoped query — a forgotten WHERE tenant_id = ? — leaks nothing.
  SELECT count(*) INTO n FROM messages;
  IF n = 1 AND (SELECT bool_and(tenant_id = tenant_a) FROM messages) THEN
    passed := passed + 1;
    RAISE NOTICE 'PASS 3  SELECT * messages -> 1 row, tenant A only (B''s mail invisible)';
  ELSE failed := failed + 1;
    RAISE WARNING 'FAIL 3  SELECT * messages -> % rows (expected 1)', n;
  END IF;

  -- 4. tenants itself is keyed by id, not tenant_id — check its policy too.
  SELECT count(*) INTO n FROM tenants;
  IF n = 1 THEN passed := passed + 1;
    RAISE NOTICE 'PASS 4  tenants           -> 1 row (own tenant only)';
  ELSE failed := failed + 1;
    RAISE WARNING 'FAIL 4  tenants           -> % rows (expected 1)', n;
  END IF;

  -- 5. Cross-tenant UPDATE by primary key: USING hides the row, 0 rows affected.
  UPDATE conversations SET subject = 'tampered' WHERE id = conv_b;
  GET DIAGNOSTICS rows_hit = ROW_COUNT;
  IF rows_hit = 0 THEN passed := passed + 1;
    RAISE NOTICE 'PASS 5  UPDATE B by id    -> 0 rows affected';
  ELSE failed := failed + 1;
    RAISE WARNING 'FAIL 5  UPDATE B by id    -> % rows affected (expected 0)', rows_hit;
  END IF;

  -- 6. Cross-tenant DELETE by primary key.
  DELETE FROM conversations WHERE id = conv_b;
  GET DIAGNOSTICS rows_hit = ROW_COUNT;
  IF rows_hit = 0 THEN passed := passed + 1;
    RAISE NOTICE 'PASS 6  DELETE B by id    -> 0 rows affected';
  ELSE failed := failed + 1;
    RAISE WARNING 'FAIL 6  DELETE B by id    -> % rows affected (expected 0)', rows_hit;
  END IF;

  -- 7. WITH CHECK: writing a row INTO another tenant must be refused.
  --    This is the half a USING-only policy would let through.
  BEGIN
    INSERT INTO conversations (tenant_id, mailbox_id, subject, thread_key)
    VALUES (tenant_b, mbox_b, 'planted by tenant A', 'thread-planted');
    failed := failed + 1;
    RAISE WARNING 'FAIL 7  INSERT as B       -> accepted (expected RLS violation)';
  EXCEPTION WHEN insufficient_privilege THEN
    passed := passed + 1;
    RAISE NOTICE 'PASS 7  INSERT as B       -> rejected: %', SQLERRM;
  END;

  -- 8. Own-tenant writes still work — the policy must not be a brick wall.
  BEGIN
    INSERT INTO conversations (tenant_id, mailbox_id, subject, thread_key)
    VALUES (tenant_a, '11111111-1111-1111-1111-1111111111aa', 'legit', 'thread-a-2');
    passed := passed + 1;
    RAISE NOTICE 'PASS 8  INSERT as A       -> accepted';
  EXCEPTION WHEN OTHERS THEN
    failed := failed + 1;
    RAISE WARNING 'FAIL 8  INSERT as A       -> rejected: %', SQLERRM;
  END;

  -- 9. audit_events is append-only: the grant, not a policy, must stop DELETE.
  BEGIN
    DELETE FROM audit_events WHERE tenant_id = tenant_a;
    failed := failed + 1;
    RAISE WARNING 'FAIL 9  DELETE audit      -> permitted (expected permission denied)';
  EXCEPTION WHEN insufficient_privilege THEN
    passed := passed + 1;
    RAISE NOTICE 'PASS 9  DELETE audit      -> denied: %', SQLERRM;
  END;

  -- 10. A pooled connection must not inherit the previous request's tenant.
  --     set_config(..., true) is transaction-local; reset it and reads go dark.
  PERFORM set_config('app.tenant_id', '', true);
  SELECT count(*) INTO n FROM conversations;
  IF n = 0 THEN passed := passed + 1;
    RAISE NOTICE 'PASS 10 tenant cleared    -> conversations visible: 0';
  ELSE failed := failed + 1;
    RAISE WARNING 'FAIL 10 tenant cleared    -> conversations visible: % (expected 0)', n;
  END IF;

  RESET ROLE;

  RAISE NOTICE '=== % passed, % failed ===', passed, failed;
  IF failed > 0 THEN
    RAISE EXCEPTION 'RLS isolation test FAILED (% checks)', failed;
  END IF;
END
$test$;

-- Nothing is kept.
ROLLBACK;
