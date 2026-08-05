# Story boundary audit — Epic 1

| | |
|---|---|
| **Date** | 2026-08-05, SM |
| **Scope** | Stories 1.1–1.7, checked **against each other** rather than against the architecture |
| **Result** | **Three findings.** One is the same shape as F3 and F8 — a capability every story describes and none builds |

## Why this pass exists

Each story was drafted individually and is internally consistent. The PO gate compares planning *documents*; the traceability matrix compares *requirements to stories*; the consistency audit compares a document *to itself*. **Nothing had compared the stories to each other**, which is where hand-off gaps live — and it is the third distinct check that has found something the others structurally could not.

---

## SB-1 — Nothing creates a `users` or `memberships` row 🔴

**Five stories describe `users` as a mirror of Clerk identity.** 1.2 defines the table, 1.3 explains why it has no RLS, 1.4 has a section titled *"Identity lives in Clerk; `users` is a mirror"*, 1.5 restates it. **No story mirrors anything.**

Story 1.4's webhook handles `organization.created` → `tenants`. There is no `user.created` handler and no `organizationMembership.*` handler anywhere in Epic 1.

Story 1.5 makes the gap visible by pointing at a thing that does not exist:

> *"Invitations go through Clerk; the `tenants`/`memberships` rows follow from the webhook, as in Story 1.4."*

Story 1.4 has no membership webhook. The sentence reads as a hand-off and is a dangling reference.

**What breaks.** `requireTenant()` still works — it needs only `tenants`. But:

| | |
|---|---|
| **FR3** — *"roles are stored on membership"* | Story 1.5 delivers it against a table nothing populates |
| **Story 1.5 AC1** | Cannot be satisfied; there are no membership rows to store a role on |
| **Epic 3 assignment** | `conversations.assignee_id` references `users(id)`. With no users, nobody can be assigned |
| **FR53 audit** | `actor_id` identifies a user who has no row |

**This is the third instance of the F3/F8 shape** — a capability that appears only as background in several stories and is owned by none. F3 was notification, F8 was the audit write path, this is identity mirroring. The pattern is now well enough established to be worth naming as a drafting check: *if more than two stories describe a thing, ask which one builds it.*

**Fix: Story 1.4 owns it.** That story already verifies Clerk webhook signatures and handles one event type; adding three more is cheap there and wrong anywhere else. Applied below.

---

## SB-2 — Two stories both amend the same ESLint rule, neither owns it 🟡

Story 1.3 Task 2 creates the `no-restricted-imports` rule forbidding `db` outside `server/db`. Story 1.4 Task 2 requires that rule to permit `server/db/system.ts`.

Story 1.3 says the coordination is "whichever ships first". That is not an owner, it is a hope — and the failure mode is quiet: 1.4 ships, the rule blocks `system.ts`, and the fastest fix under pressure is to loosen the rule rather than add one path to it.

**Fix: Story 1.3 writes the rule with `system.ts` already permitted**, and a comment saying why. The exception is known now; there is no reason to discover it later. Applied below.

---

## SB-3 — Story 1.4's webhook writes a `tenants` row with no audit event 🟡

FR53 requires an audit event for **every** state change. Creating a tenant is a state change. Story 1.4 writes one and does not audit it, because `audit()` does not exist until Story 1.5.

A genuine ordering problem rather than an oversight — and small, since it is one event. **Two honest options:**

| | |
|---|---|
| Move `audit()` into 1.4 | Puts the helper in the story that first needs it, but 1.4 is already the largest story in the epic |
| **Note it and backfill in 1.5** ✅ | 1.5 owns the helper and is the next story; it adds the tenant-creation call as its first act |

Taking the second, **with the requirement written down rather than remembered** — that is the whole lesson of F8. Applied below.

---

## Checked and clean

| Boundary | Verdict |
|---|---|
| 1.2 tables → 1.3 `withTenant` | Consistent; 1.3 correctly does not redefine the schema |
| 1.3 coverage test → 1.7 `notifications` | 1.7 says to let the test fail if the policy is missing. Correct — that is the net working |
| 1.5 roles → 1.7 email audience | Consistent; 1.7 depends on 1.5 and says so |
| 1.6 shell → 1.7 bell | Consistent |
| 1.1 CI → 1.6 axe-core | Additive, no conflict |
| 1.2 `region` CHECK → 1.4 `tenants` insert | Consistent; the webhook does not set `region`, so the default applies |
| 1.1 `env.ts` → 1.4, 1.7 additions | Each story adds only the variables it uses, as Story 1.1 established |

---

## Applied

- **Story 1.4** gains AC6 and a task: mirror `user.created`/`user.updated` into `users`, and `organizationMembership.created/updated/deleted` into `memberships`. PRD amended to match.
- **Story 1.3** writes the lint rule with `server/db/system.ts` permitted from the start.
- **Story 1.5** gains a task to audit tenant creation retroactively, and its dangling "as in Story 1.4" reference now points at something real.
