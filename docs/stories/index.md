# Stories

One story in flight at a time, per Architecture §1.2. The Dev agent starts with a clean context holding exactly one story file plus the three `devLoadAlwaysFiles` shards.

| Story | Title | Status |
|---|---|---|
| [1.1](./1.1.md) | Monorepo and deployment skeleton | **Review** — Tasks 1–5 done and verified (typecheck/lint/test/build all green). Blocked on two human prerequisites: link the Vercel project, enable branch protection |
| [1.2](./1.2.md) | Database, schema, and migrations | **Drafted 2026-08-04** — cannot start until a Neon instance is provisioned. Raises an AC8/AC9 scope conflict for the PO |
| [1.3](./1.3.md) | The tenant-scoped session, and keeping RLS once Drizzle owns the schema | **Draft, not Approved** — drafted two ahead on 2026-08-04. ACs 1–3 are solid; **ACs 4–6 are provisional** because they depend on choices Story 1.2's implementation makes. Re-read against the real `packages/db` before approving |
| [1.4](./1.4.md) | Authentication and organizations | **Draft, not Approved** — drafted three ahead on 2026-08-05. Surfaced the bootstrap-lookup problem and its ruling (Architecture §10.2). Depends on 1.2 and 1.3 |
| [1.5](./1.5.md) | Roles and team management | **Draft, not Approved** — 2026-08-05. Owns the audit write path (F8). Identifies AC4's last-owner rule as a **race**, not a validation check |
| [1.6](./1.6.md) | Application shell | **Draft, not Approved** — 2026-08-05. Flags AC5 as presentation needing a separate route guard; adds axe-core to CI |
| 1.7 | Notification foundation | Not drafted — **added 2026-08-03** resolving [F3](../po-validation-2026-08-03.md). Must land before Epic 2 Story 2.2, its first consumer. Depends on 1.5 (roles) and 1.6 (shell) |

Later epics are not drafted. Every PO finding is now resolved, so no epic is blocked editorially — Epic 3 still needs F4's migration written, though its design is settled.

## Story lifecycle

```
SM drafts → Approved → Dev implements → Review → QA gate → PO marks Done → SM drafts next
```

A story file is **self-contained**: the SM embeds the relevant architecture excerpts into it so the Dev agent never has to go hunting. If the Dev agent needs to open `Email Engine Architecture.md`, the story was drafted badly.

## Drafting convention — cite the FRs

> **Every story file carries a `Delivers` row naming the FR numbers it satisfies** (or stating plainly that it delivers none, as 1.1 does).
>
> Adopted 2026-08-04 on the [traceability matrix](../prd/traceability.md)'s own recommendation. The matrix exists because the epics cite no FR numbers, which is how **F3** (four stories notifying, none building notification) and **F8** (three stories writing audit events, none building the audit path) both survived three careful readings. A capability that appears only as somebody else's secondary acceptance criterion has no owner — and citing FRs makes that visible while the story is being drafted, rather than months later in a table.
