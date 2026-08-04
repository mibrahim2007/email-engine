> **Shard of [PRD](../../Email%20Engine%20PRD.md) §6 Epic 1.**
> Derived file — edit the source document and re-shard, never this copy.

### Epic 1 — Foundation and tenancy

**Goal:** stand up the deployable skeleton and the isolation guarantee everything else rests on. Nothing ships after this epic that could leak data across tenants.

---

**Story 1.1 — Monorepo and deployment skeleton**
*As a developer, I want a deployable monorepo with CI, so that every later story lands in a working pipeline.*

1. Turborepo monorepo with `apps/web` and `packages/{db,email,ai,ui,config}` per the architecture's source tree.
2. Next.js App Router app builds, typechecks, and lints with zero errors.
3. `/api/health` returns `{ status, version, commit }` and is reachable on a deployed URL.
4. Pushing to a branch produces a Vercel preview deployment.
5. CI runs typecheck, lint, and unit tests on every PR and blocks merge on failure.

---

**Story 1.2 — Database, schema, and migrations**
*As a developer, I want Postgres provisioned with a migration workflow, so that schema changes are versioned and reviewable.*

1. Neon Postgres provisioned via Vercel Marketplace; `DATABASE_URL` and unpooled variant set in all three environments.
2. `vector`, `pg_trgm`, and `citext` extensions enabled. *(Corrected 2026-08-03 per Architecture §6.8: `pgcrypto` was listed and is obsolete — `gen_random_uuid()` has been core since PostgreSQL 13 — and `citext` was missing.)*
3. Drizzle schema defines `tenants`, `users`, `memberships` with the fields in the architecture data models.
4. `drizzle-kit generate` produces a checked-in migration; `migrate` applies cleanly to an empty database.
5. CI fails if the committed schema and migrations have drifted.
6. A seed script creates two tenants with distinct users for local development.
7. **Point-in-time recovery is enabled with a retention window of at least 7 days, and a restore to an arbitrary point is exercised once and documented** (NFR20). *(Added 2026-08-04 per traceability finding F10 — NFR20 had no owning story anywhere. It is a setting on the instance this story provisions, so this is the cheapest moment it will ever have.)*
8. The schema carries the two corrections ruled after the architecture was written: `tenants.region` (Architecture §6.8b) and `attachments.scan_status` defaulting to `not_scanned` (§13.3).
9. The Drizzle schema defines the **intended** types — `vector(1536)`, `citext`, HNSW and trigram indexes — not the substitutions in `migrations/0001`, which were forced by an instance this story does not use (§6.8c). `migrations/0001`–`0003` are never applied to Neon.

---

**Story 1.3 — The tenant-scoped session, and keeping RLS once Drizzle owns the schema**
*As a security-conscious buyer, I want tenant isolation enforced by the database, so that an application bug cannot expose another customer's mail.*

> **Rescoped 2026-08-04 per PO finding F2.** The original story's ACs 1, 2, 4, 5, and 6 shipped on 2026-08-03 as `migrations/0001`–`0002`, `tests/rls_isolation.sql` (10/10), `tests/rls_policy_coverage.sql` (16/16), and `.github/workflows/db.yml`. Re-implementing them would rebuild working, tested infrastructure. What is left is the **application half**, plus a risk the original story did not see: RLS is currently guaranteed by hand-written SQL, and from Story 1.2 Drizzle generates the table DDL. A table Drizzle creates arrives **without a policy**.

1. `withTenant()` opens a transaction, sets `app.tenant_id` transaction-locally, and returns a `tx`; every repository function takes that `tx`. No raw `db` is exported outside `server/db`.
2. An ESLint `no-restricted-imports` rule fails the build on any import of `db` outside `server/db` (coding standard 1), and a test proves the rule fires.
3. No repository function contains a literal `tenant_id = ` filter (coding standard 2) — a lint rule or a test asserts this, because a manual filter hides a missing policy rather than compensating for one.
4. RLS policy DDL lives in `packages/db/migrations/policies/` and runs **after** each Drizzle-generated migration, per Architecture §6.5, so a Drizzle-created table cannot reach a deployed environment unpoliced.
5. `tests/rls_policy_coverage.sql` runs against the Drizzle-migrated schema, not only the hand-written one — the existing suite is the safety net for AC4, and this AC is what points it at the new source of tables.
6. The isolation suite is re-run **connected as `email_engine_app` over the real connection path**, not via `SET ROLE`, proving the credential and `pg_hba` path and not merely the policies. *(Carried from the 2026-08-02 open loop; possible for the first time once Neon is provisioned.)*

*Prerequisite: a provisioned Neon instance (Story 1.2). ACs 4–6 cannot be verified without one.*

---

**Story 1.4 — Authentication and organizations**
*As a user, I want to sign up and belong to an organization, so that my team shares a workspace.*

1. Clerk sign-up, sign-in, and sign-out work; unauthenticated access to `(app)` routes redirects to sign-in.
2. Creating a Clerk Organization creates a corresponding `tenants` row via a verified webhook, idempotently.
3. `requireTenant()` resolves the tenant from the session's `org_id` and rejects a session with no active organization.
4. A user in two organizations can switch between them and the data shown changes accordingly.
5. Clerk webhook signature verification rejects unsigned or stale payloads.

---

**Story 1.5 — Roles and team management**
*As an owner, I want to invite teammates with roles, so that access matches responsibility.*

1. Roles `owner`, `admin`, `agent`, `viewer` are stored on membership and mapped from Clerk organization roles.
2. `requireRole()` guards every mutation; a `viewer` receives 403 on any write.
3. Owners and admins can invite by email, remove members, and change roles from the Team settings screen.
4. The last remaining `owner` cannot be removed or demoted.
5. **This story owns the audit write path** — a single `audit(actor, action, entity, metadata)` helper that every later state change calls, rather than each story inventing its own insert. Membership changes are its first caller. *(Added 2026-08-04 per traceability finding F8: FR53 requires an audit event for **every** state change, and three stories consumed audit while none built it.)*
6. A test asserts the application role cannot `UPDATE` or `DELETE` `audit_events` (NFR15), so immutability is verified behaviour and not only a grant in a migration.

---

**Story 1.6 — Application shell**
*As a user, I want a consistent navigation shell, so that the product feels like one application.*

1. `(app)` layout renders sidebar, organization switcher, user menu, and content area.
2. shadcn/ui is initialized in `packages/ui`; Tailwind v4 theme tokens are defined CSS-first with light and dark values.
3. Dark mode follows the system preference and can be toggled, persisting across sessions.
4. The shell is responsive to 768px and passes an automated accessibility scan with no critical violations.
5. Navigation items reflect the current user's role — billing is hidden from `agent` and `viewer`.

---

**Story 1.7 — Notification foundation**
*As an admin, I want to be told when something needs me, so that a broken mailbox or a failed send does not sit unnoticed.*

*Added 2026-08-03 resolving PO finding F3. It sits in Epic 1 because Epic 2 Story 2.2 is the first consumer, and no story may depend on a later epic — though "foundation" is doing some work here, since this is closer to a feature than to tenancy.*

1. A `notifications` table is tenant-scoped, RLS-forced, and keyed per recipient user, with `type`, `title`, `body`, `entity_type`, `entity_id`, `read_at`, `created_at`.
2. `notify(userIds, type, …)` is the single entry point; no feature writes the table directly.
3. The app shell shows a bell with an unread count and a panel listing notifications newest-first; clicking one marks it read and navigates to its entity.
4. Owners and admins additionally receive transactional email via Resend for **exactly two** conditions — mailbox connection broken, outbound message `dead` — deduplicated per condition per mailbox within a 24-hour window (FR56).
5. Email sending failure is logged and never blocks the in-app notification, which remains the durable record.
6. A notification that duplicates a conversation timeline event links to it rather than restating it; the timeline stays the source of truth (Architecture §6.7).

---
