> **Shard of [PRD](../../Email%20Engine%20PRD.md) §6 Epic 1.**
> Derived file — edit the source document and re-shard, never this copy.

---

## 6. Epic details

> Story format: `As a <role>, I want <capability>, so that <benefit>.` Acceptance criteria are testable and numbered. The SM expands each story into a self-contained story file with the relevant architecture excerpts embedded.

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

---

**Story 1.3 — Row-level security and the isolation test suite**
*As a security-conscious buyer, I want tenant isolation enforced by the database, so that an application bug cannot expose another customer's mail.*

1. Every table with a `tenant_id` column has RLS `ENABLED` and `FORCED`, with a policy carrying both `USING` and `WITH CHECK`.
2. The application connects as a role that is not the table owner and lacks `BYPASSRLS`.
3. `withTenant()` opens a transaction and sets `app.tenant_id` transaction-locally; no repository function accepts a connection obtained any other way.
4. An automated suite seeds two tenants and asserts, per table, that tenant A's session cannot `SELECT`, `UPDATE`, `DELETE`, or `INSERT` against tenant B's rows.
5. A schema-walking test fails the build if any table with a `tenant_id` column lacks a forced policy.
6. This suite runs on every PR and blocks merge.

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
5. Every membership change writes an audit event.

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

