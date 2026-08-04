> **Shard of [Architecture](../../Email%20Engine%20Architecture.md) §3.**
> Derived file — edit the source document and re-shard, never this copy.

## 3. Tech stack

> **This table is the single source of truth.** Dev agents install exactly these versions. Anything not listed here needs an architecture change, not an ad-hoc `npm i`.

| Category | Technology | Version | Purpose | Rationale |
|---|---|---|---|---|
| Language | TypeScript | 5.9 | Everything | One language across app, workflows, and DB schema |
| Framework | Next.js | 16.x (App Router) | Dashboard + API | RSC, Server Actions, Cache Components, first-party on Vercel |
| Runtime | Node.js | 22.x | Functions | `mailparser`, IMAP, and crypto need Node APIs; not Edge |
| UI kit | shadcn/ui | latest CLI | Components | Code you own, not a dependency you fight. Registry-installed into `packages/ui` |
| Styling | Tailwind CSS | 4.x | Styling | CSS-first config (`@theme`), no `tailwind.config.js` |
| Primitives | Radix UI | via shadcn | a11y primitives | Keyboard + ARIA handled correctly |
| Icons | lucide-react | latest | Icons | shadcn default |
| Forms | react-hook-form + zod | 7.x / 4.x | Forms + validation | Same zod schema validates the form, the Server Action, and the REST body |
| Tables | TanStack Table | 8.x | Conversation lists | Headless; shadcn `data-table` wraps it |
| State (client) | Zustand | 5.x | Composer/UI state only | Server state lives in RSC; Zustand holds ephemeral UI |
| Data fetching (client) | SWR | 2.x | Live inbox polling | Lightweight, Vercel-native |
| AI SDK | `ai` (Vercel AI SDK) | 5.x | Streaming, tools, structured output | `streamText`, `generateObject`, `useChat` |
| AI routing | Vercel AI Gateway | — | Model access | **One credential, many models.** Failover, cost/latency telemetry, no provider SDK in our code |
| Embeddings | via AI Gateway | — | KB retrieval | 1536-dim; dimension pinned in schema |
| ORM | Drizzle ORM | 0.4x | DB access | SQL-shaped, generates real migrations, RLS-friendly |
| Database | PostgreSQL (Neon) | 17 | Primary store | RLS, `pgvector`, branching per preview |
| Vector | pgvector | 0.8 | Semantic search | Keeps embeddings in the same transaction as the rows |
| Migrations | drizzle-kit | latest | Schema change | Checked in, applied in CI |
| Durable jobs | Vercel Workflow (WDK) | latest | Email pipeline | Crash-safe steps, retries, sleep, human-in-the-loop pause |
| Scheduling | Vercel Cron | — | Mailbox polling, digests | Declared in `vercel.json` |
| Cache / limits | Upstash Redis | — | Rate limit, idempotency, presence | Marketplace-provisioned |
| Blob | Vercel Blob | — | Attachments | Signed URLs, no S3 to manage |
| Auth | Clerk | latest | Users, Orgs, RBAC | Organizations = tenants, out of the box |
| Billing | Stripe | latest | Subscriptions, metering | Usage-based seats + message volume |
| Email send | Resend | latest | Transactional + tenant outbound | Same vendor for inbound webhook parsing |
| Email parse | mailparser + DOMPurify | latest | MIME → safe HTML/text | Never render raw customer HTML |
| Testing | Vitest + Testing Library | 3.x | Unit + component | Fast, ESM-native |
| E2E | Playwright | 1.5x | Critical flows | Runs against preview URLs |
| Observability | Vercel Observability + Sentry | — | Logs, traces, errors | Gateway gives per-request token/cost attribution |
| Analytics | PostHog | — | Product analytics | Self-servable, tenant-scoped |

**Deliberately excluded:** no Redis-backed job queue (Workflow covers it), no separate vector database (pgvector is enough at this scale), no GraphQL (REST + Server Actions), no provider-specific AI SDK (`@anthropic-ai/sdk`, `openai`, etc. — the Gateway is the only AI dependency).

---
