# Email Engine

Planning artifacts for a **multi-tenant SaaS email chatbot** — connect a shared mailbox, and an AI agent drafts source-cited replies that a human reviews or that send themselves above a confidence threshold you control.

> **Status: design only.** This repository contains the two BMAD planning documents. No implementation code yet.

## Documents

| Document | What it covers |
|---|---|
| [Email Engine PRD.md](./Email%20Engine%20PRD.md) | Goals, personas, success metrics, 54 functional + 25 non-functional requirements, 8 epics, 40 stories with acceptance criteria |
| [Email Engine Architecture.md](./Email%20Engine%20Architecture.md) | Stack, components, data models, Postgres schema and RLS, REST API, workflows, frontend/backend design, security, testing, coding standards |

Read the PRD first — the architecture was written against it.

## Stack

| Layer | Choice |
|---|---|
| Frontend | Next.js 16 App Router, Tailwind CSS v4, shadcn/ui |
| Backend | Vercel Functions (Node) + Vercel Workflow for durable jobs |
| Database | PostgreSQL (Neon) + pgvector, Drizzle ORM |
| AI | Vercel AI SDK v5 → Vercel AI Gateway |
| Auth | Clerk Organizations |
| Hosting | Vercel |

## Three load-bearing decisions

1. **Tenant isolation lives in PostgreSQL, not application code.** Forced row-level security with a transaction-local `app.tenant_id`, and an application role without `BYPASSRLS`. A forgotten `WHERE tenant_id = ?` returns zero rows instead of another customer's mail. The isolation test suite is a merge blocker.

2. **Every inbound email is a durable workflow run**, not a request handler. Ingest → classify → retrieve → draft → send checkpoints per step, so a model timeout retries one step rather than re-parsing MIME and re-uploading attachments. Sending is separately protected by a transactional outbox drained with `FOR UPDATE SKIP LOCKED`.

3. **No AI provider SDK or key in the deployment.** All model access routes through Vercel AI Gateway: one credential, model choice is tenant configuration, and provider failover needs no code change. Since the app feeds attacker-controlled email bodies to a tool-calling agent, prompt injection is treated as a product requirement with its own adversarial test corpus.

## Method

Built with the [BMAD method](https://github.com/bmad-code-org/BMAD-METHOD) — a planning phase that produces the PRD and architecture once, then a development cycle where a Scrum Master agent drafts one self-contained story at a time for a Dev agent to implement with a clean context. Architecture §1 documents the agent roles, the sharding plan, and the loop.

## Open questions

Seven decisions are still unowned — see PRD §8. The two that gate work: the retrieval recall bar that unblocks Epic 5, and whether auto-send ships conservative (0.9, off by default) or on at 0.85.

The UX Expert artifact (`front-end-spec.md`) has not been written; it should have preceded the architecture.

## License

MIT
