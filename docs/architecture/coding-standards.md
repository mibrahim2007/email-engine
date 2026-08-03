> **Shard of [Architecture](../../Email%20Engine%20Architecture.md) §15.**
> Derived file — edit the source document and re-shard, never this copy.

## 15. Coding standards

> Loaded into every Dev agent context. Short by design — only rules that prevent real bugs.

1. **Never import `db` outside `server/db`.** Repositories take a `tx` from `withTenant()`. Enforced by an ESLint `no-restricted-imports` rule.
2. **Never write a raw `tenant_id = ?` filter in a repository.** RLS does it. A manual filter hides a missing policy.
3. **Types come from Drizzle inference.** Never hand-write an interface that mirrors a table.
4. **Every API input is parsed by a zod schema** at the boundary. The parsed value is what flows inward; the raw body never does.
5. **Never render email HTML without `sanitizeEmailHtml()`.**
6. **Environment variables are read only in `server/env.ts`**, validated by zod at boot. `process.env` elsewhere is a lint error.
7. **Server Components by default.** `"use client"` requires a comment explaining what needs the client.
8. **Every mutation calls `requireRole()`** before touching data.
9. **Errors are thrown as taxonomy classes**, never as strings or bare `Error`.
10. **Workflow steps are idempotent.** Assume every step runs at least twice.
11. **No `any`.** `unknown` plus a narrowing parse.
12. **Naming:** components `PascalCase`, hooks `useCamelCase`, DB tables/columns `snake_case`, routes `kebab-case`, API fields `camelCase` in JSON.

---

