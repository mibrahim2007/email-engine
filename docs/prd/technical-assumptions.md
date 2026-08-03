> **Shard of [PRD](../../Email%20Engine%20PRD.md) §4.**
> Derived file — edit the source document and re-shard, never this copy.

## 4. Technical assumptions

These are decisions the PM is making as constraints on the Architect. The rationale and the detailed design live in [[Email Engine Architecture]].

- **Repository structure:** Monorepo (Turborepo, npm workspaces). Shared types between the app, workflows, and DB are the deciding factor.
- **Service architecture:** Serverless, event-driven monolith on Vercel. No microservices at this scale; the async pipeline is separated by durable workflows, not by services.
- **Database:** PostgreSQL. Required for row-level security, `pgvector`, and partial indexes. Tenant isolation is a DB responsibility, not an application one.
- **AI access:** Through Vercel AI Gateway only. **No direct provider SDKs and no per-provider API keys in the deployment.** Model choice must be configuration, and provider failover must not require a code change.
- **Frontend:** Next.js App Router with React Server Components; Tailwind CSS v4 and shadcn/ui. Components are owned in-repo, not consumed as a dependency.
- **Auth:** Clerk with Organizations. Building tenant-aware auth is not a differentiator.
- **Testing requirements:** Full pyramid. Two suites are merge blockers: tenant isolation (RLS) and send-exactly-once. AI quality is measured by a nightly eval set that reports regressions but does not block merges.
- **Deployment:** Vercel, preview deployment per PR with a database branch. Migrations must be backward-compatible with the previous deploy (expand/contract).

---

