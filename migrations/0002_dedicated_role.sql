-- Email Engine — 0002: dedicated application role
-- Target: PostgreSQL 17, database `email_engine`
--
-- 0001 granted table privileges to `app_user`, a name generic enough that a
-- role of that name may already exist on a shared cluster. Roles are
-- cluster-wide; tables are not — so 0001's `IF NOT EXISTS` guard can skip
-- creation and silently attach the grants to somebody else's login role. This
-- migration moves those privileges to a role that belongs to this database
-- only, and revokes app_user's access to email_engine.
--
-- Scope note: privileges are per-database, so the REVOKEs below touch only the
-- email_engine database. Any privileges app_user holds in other databases on
-- the same cluster are untouched — nothing outside this database changes.
--
-- The role is created NOLOGIN and without a password on purpose: no credential
-- belongs in a migration file. Set one yourself before pointing the app at it:
--   ALTER ROLE email_engine_app LOGIN PASSWORD '<pick one>';
--
-- email_engine_app must never own these tables (the owner would still be
-- subject to FORCE RLS, but ownership brings DDL rights the app must not have)
-- and must never hold BYPASSRLS.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. The role
-- ---------------------------------------------------------------------------
DO $role$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'email_engine_app') THEN
    CREATE ROLE email_engine_app NOLOGIN NOBYPASSRLS;
  END IF;
END
$role$;

-- Fail loudly rather than silently granting to a pre-existing role that can
-- log in or bypass RLS — exactly the surprise that made 0002 necessary.
DO $guard$
DECLARE r record;
BEGIN
  SELECT rolcanlogin, rolbypassrls, rolsuper INTO r
  FROM pg_roles WHERE rolname = 'email_engine_app';

  IF r.rolbypassrls OR r.rolsuper THEN
    RAISE EXCEPTION
      'email_engine_app has BYPASSRLS or SUPERUSER; tenant isolation would be void';
  END IF;
END
$guard$;

-- ---------------------------------------------------------------------------
-- 2. Grants (mirrors 0001 §5, retargeted)
-- ---------------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO email_engine_app;

GRANT SELECT, INSERT, UPDATE, DELETE ON
  tenants, memberships, mailboxes, contacts, conversations, messages,
  attachments, kb_sources, kb_chunks, drafts, outbound_messages,
  api_keys, webhook_subscriptions, usage_records
TO email_engine_app;

-- Clerk webhook mirrors identity into users; no delete grant
GRANT SELECT, INSERT, UPDATE ON users TO email_engine_app;

-- Append-only audit trail
GRANT SELECT, INSERT ON audit_events TO email_engine_app;

-- ---------------------------------------------------------------------------
-- 3. Take email_engine away from the generic role
-- ---------------------------------------------------------------------------
REVOKE ALL PRIVILEGES ON ALL TABLES    IN SCHEMA public FROM app_user;
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM app_user;
REVOKE ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public FROM app_user;
REVOKE ALL PRIVILEGES ON SCHEMA public FROM app_user;

COMMIT;
