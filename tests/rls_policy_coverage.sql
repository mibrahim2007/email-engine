-- Email Engine — RLS policy coverage
-- Database: email_engine.  Run as postgres (or any superuser).
--
-- Architecture §14.1 asks for two non-negotiable tests. rls_isolation.sql is
-- the behavioural half: it seeds two tenants and proves A cannot reach B. This
-- is the structural half — "a schema-walking test that fails if any table with
-- a tenant_id column lacks a forced policy".
--
-- The difference matters. The isolation test only exercises the tables it
-- happens to touch, so a table added later with a tenant_id and no policy
-- passes it. This walks the catalog instead, so the check covers tables that
-- do not exist yet.
--
-- Reads only pg_catalog. Wrapped in a transaction that ROLLBACKs for symmetry
-- with the other suite; nothing here writes.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Every tenant-scoped table: ENABLE, FORCE, and a policy with both halves
-- ---------------------------------------------------------------------------
DO $coverage$
DECLARE
  r        record;
  checked  int := 0;
  failed   int := 0;
  problems text;
BEGIN
  FOR r IN
    SELECT c.oid,
           c.relname,
           c.relrowsecurity      AS enabled,
           c.relforcerowsecurity AS forced
    FROM pg_class c
    JOIN pg_namespace ns ON ns.oid = c.relnamespace
    WHERE ns.nspname = 'public'
      AND c.relkind  = 'r'
      AND (
        EXISTS (
          SELECT 1 FROM pg_attribute a
          WHERE a.attrelid = c.oid
            AND a.attname  = 'tenant_id'
            AND a.attnum   > 0
            AND NOT a.attisdropped
        )
        -- tenants is keyed by id rather than tenant_id, so the column test
        -- misses it; it is tenant-scoped all the same.
        OR c.relname = 'tenants'
      )
    ORDER BY c.relname
  LOOP
    checked  := checked + 1;
    problems := '';

    IF NOT r.enabled THEN
      problems := problems || ' ENABLE ROW LEVEL SECURITY missing;';
    END IF;

    -- Without FORCE, the table owner silently bypasses every policy below.
    IF NOT r.forced THEN
      problems := problems || ' FORCE ROW LEVEL SECURITY missing;';
    END IF;

    -- polcmd '*' is FOR ALL. A policy scoped to SELECT alone would leave
    -- writes unguarded, and USING without WITH CHECK filters reads while
    -- letting a row be written into another tenant.
    IF NOT EXISTS (
      SELECT 1 FROM pg_policy p
      WHERE p.polrelid     = r.oid
        AND p.polcmd       = '*'
        AND p.polqual      IS NOT NULL
        AND p.polwithcheck IS NOT NULL
    ) THEN
      problems := problems || ' no FOR ALL policy carrying both USING and WITH CHECK;';
    END IF;

    IF problems = '' THEN
      RAISE NOTICE 'PASS  % — enabled, forced, USING + WITH CHECK', r.relname;
    ELSE
      failed := failed + 1;
      RAISE WARNING 'FAIL  % —%', r.relname, problems;
    END IF;
  END LOOP;

  -- A silent pass over zero tables is the worst outcome: green CI, no schema.
  IF checked = 0 THEN
    RAISE EXCEPTION 'no tenant-scoped tables found — were the migrations applied?';
  END IF;

  RAISE NOTICE '=== % tenant tables checked, % failed ===', checked, failed;
  IF failed > 0 THEN
    RAISE EXCEPTION 'RLS policy coverage FAILED (% tables)', failed;
  END IF;
END
$coverage$;

-- ---------------------------------------------------------------------------
-- 2. The application role must not be able to step over the policies
-- ---------------------------------------------------------------------------
-- Policies are only worth the role they apply to: BYPASSRLS or SUPERUSER on
-- the application role voids every check above, and table ownership brings
-- DDL rights the app has no use for.
DO $role$
DECLARE
  r      record;
  owned  int;
BEGIN
  SELECT rolbypassrls, rolsuper INTO r
  FROM pg_roles WHERE rolname = 'email_engine_app';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'role email_engine_app does not exist — was 0002 applied?';
  END IF;

  IF r.rolbypassrls THEN
    RAISE EXCEPTION 'email_engine_app holds BYPASSRLS — tenant isolation is void';
  END IF;

  IF r.rolsuper THEN
    RAISE EXCEPTION 'email_engine_app is SUPERUSER — tenant isolation is void';
  END IF;

  SELECT count(*) INTO owned
  FROM pg_class c
  JOIN pg_namespace ns ON ns.oid = c.relnamespace
  WHERE ns.nspname = 'public'
    AND c.relkind  = 'r'
    AND pg_get_userbyid(c.relowner) = 'email_engine_app';

  IF owned > 0 THEN
    RAISE EXCEPTION 'email_engine_app owns % table(s) — it must not', owned;
  END IF;

  RAISE NOTICE 'PASS  email_engine_app — no BYPASSRLS, no SUPERUSER, owns no tables';
END
$role$;

ROLLBACK;
