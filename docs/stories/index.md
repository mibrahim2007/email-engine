# Stories

One story in flight at a time, per Architecture §1.2. The Dev agent starts with a clean context holding exactly one story file plus the three `devLoadAlwaysFiles` shards.

| Story | Title | Status |
|---|---|---|
| [1.1](./1.1.md) | Monorepo and deployment skeleton | **Approved — ready for Dev** |
| 1.2 | Database, schema, and migrations | ⛔ Blocked — [PO finding F1](../po-validation-2026-08-03.md): the story provisions Neon with three extensions, the applied schema is on a self-hosted PostgreSQL 17 with none. Architect must rule before this is drafted |
| 1.3 | Row-level security and the isolation test suite | ⛔ Needs rescoping — [PO finding F2](../po-validation-2026-08-03.md): five of six ACs already shipped. Rescope to `withTenant()` before drafting |
| 1.4 | Authentication and organizations | Not drafted |
| 1.5 | Roles and team management | Not drafted |
| 1.6 | Application shell | Not drafted |

Later epics are not drafted. Epic 2 needs [F3 and F5](../po-validation-2026-08-03.md) resolved; Epic 3 needs F4.

## Story lifecycle

```
SM drafts → Approved → Dev implements → Review → QA gate → PO marks Done → SM drafts next
```

A story file is **self-contained**: the SM embeds the relevant architecture excerpts into it so the Dev agent never has to go hunting. If the Dev agent needs to open `Email Engine Architecture.md`, the story was drafted badly.
