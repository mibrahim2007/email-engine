> **Shard of [Architecture](../../Email%20Engine%20Architecture.md) §9.**
> Derived file — edit the source document and re-shard, never this copy.

## 9. Frontend architecture

> [!note] The front-end spec arrived after this section
> [[Email Engine Front-End Spec]] (2026-08-03) was written against the PRD *after* this architecture, inverting the BMAD order. It conforms to everything below rather than driving it, and raised **five deltas** — all ruled on in **§9.5**: four accepted (two of them with a corrected mechanism), one rejected in favour of something cheaper. The two that change the schema are specified in §6.7 and await `migrations/0003`.

### 9.1 Route structure

```
app/
├── (marketing)/                 public, statically generated
│   ├── page.tsx
│   └── pricing/page.tsx
├── (auth)/
│   ├── sign-in/[[...sign-in]]/page.tsx
│   └── sign-up/[[...sign-up]]/page.tsx
├── (app)/                       Clerk-guarded, org-scoped
│   ├── layout.tsx               sidebar + org switcher
│   ├── inbox/
│   │   ├── page.tsx             RSC list
│   │   └── [conversationId]/page.tsx
│   ├── knowledge/
│   ├── playground/page.tsx      useChat against /api/chat
│   ├── analytics/page.tsx
│   └── settings/{mailboxes,persona,team,api-keys,billing}/page.tsx
└── api/
    ├── chat/route.ts            streaming
    ├── v1/…                     public REST
    ├── webhooks/{inbound,clerk,stripe}/route.ts
    ├── workflows/…              WDK entrypoints
    └── cron/{poll-mailboxes,drain-outbox}/route.ts
```

Route groups matter here: `(app)` gets the auth check in its layout once, so no page can forget it.

### 9.2 shadcn/ui + Tailwind v4

Components are installed into `packages/ui` via the shadcn CLI and re-exported. Tailwind v4 is configured CSS-first — there is no `tailwind.config.js`:

```css
/* packages/config/tailwind/theme.css */
@import "tailwindcss";
@plugin "tailwindcss-animate";

@theme {
  --color-background: oklch(1 0 0);
  --color-foreground: oklch(0.145 0 0);
  --color-primary: oklch(0.55 0.18 255);
  --color-primary-foreground: oklch(0.99 0 0);
  --color-muted: oklch(0.97 0 0);
  --color-destructive: oklch(0.58 0.22 27);
  --radius: 0.625rem;
  --font-sans: var(--font-geist-sans), ui-sans-serif, system-ui;
}

@layer base {
  .dark {
    --color-background: oklch(0.145 0 0);
    --color-foreground: oklch(0.985 0 0);
    /* … */
  }
}
```

Tenants can override brand tokens; those overrides are emitted as inline CSS custom properties on the app shell, so a tenant theme never requires a rebuild.

**Component inventory:**

| Area | shadcn primitives | Custom composites |
|---|---|---|
| Inbox | `data-table`, `badge`, `avatar`, `command`, `scroll-area` | `ConversationList`, `ConversationRow`, `FilterBar` |
| Thread | `card`, `separator`, `collapsible`, `tabs` | `MessageBubble`, `QuotedHistory`, `AttachmentChip` |
| Draft review | `textarea`, `button`, `tooltip`, `hover-card`, `alert` | `DraftPanel`, `ConfidenceMeter`, `CitationPopover` |
| Playground | `input`, `scroll-area`, `skeleton` | `ChatStream`, `ToolCallTrace` |
| KB | `dialog`, `progress`, `table`, `dropdown-menu` | `SourceUploader`, `IndexStatus` |
| Settings | `form`, `select`, `switch`, `slider`, `sheet` | `MailboxConnectCard`, `PersonaEditor`, `AutoSendThreshold` |
| Global | `sonner`, `dialog`, `command`, `dropdown-menu` | `OrgSwitcher`, `CommandPalette` |

Every custom composite is a Server Component unless it needs state; `"use client"` goes on the smallest possible leaf.

### 9.3 State

- **Server state** — RSC + `fetch`/Drizzle directly in the component. No client cache for the initial render.
- **Live updates** — SWR polling `/api/v1/conversations?since=` at 10s in the inbox; upgrade path is Postgres `LISTEN/NOTIFY` → SSE if polling becomes a cost problem.
- **Mutations** — Server Actions with `revalidatePath` / `revalidateTag`. Optimistic UI via `useOptimistic` for status changes and assignment.
- **Ephemeral UI** — Zustand for composer draft text, filter panel open state, selection sets. Never for anything the server owns.
- **Chat** — `useChat` from AI SDK v5 against `/api/chat`.

### 9.4 Rendering

Marketing is static. Dashboard shells are prerendered with Cache Components (`use cache` + `cacheTag('tenant:'+id)`); tenant data streams in via Suspense. Mutations call `updateTag` so the shell refreshes without a full invalidation. Conversation detail is dynamic — never cached.

### 9.5 Rulings on the front-end spec deltas (2026-08-03)

[[Email Engine Front-End Spec]] §14 raised five deltas. All are ruled below. **Four accepted, one rejected in favour of a cheaper mechanism**; two require a new migration (§6.7).

---

**Delta 1 — `/onboarding` route. ACCEPTED as specified.**

`app/(app)/onboarding/page.tsx`. The `(app)` layout's auth check covers it, and success metric §1.4 ("signup to first AI draft < 10 minutes p75") needs a real route to instrument a funnel against.

One addition the spec did not cover: **the redirect belongs in `inbox/page.tsx`, not `(app)/layout.tsx`.** A tenant with no connected mailbox should land on onboarding rather than an empty inbox, but putting that check in the layout adds a mailbox-count query to *every* authenticated request in the product. Placing it on the default landing route pays the cost once, where the redirect actually matters.

---

**Delta 2 — `popover` + `sheet` for citations. ACCEPTED, and `hover-card` is dropped.**

NFR24 is not negotiable and the spec is right that Radix `hover-card` is pointer-only, so Story 5.5 AC2 cannot be implemented literally.

Going further than the spec asked: **use `popover` for all three input modes and remove `hover-card` from the inventory entirely.** Keeping both means a pointer path and a keyboard path that can drift out of sync — two behaviours to maintain, two to test, and the accessible one is the one that rots because nobody uses it daily. A single `popover` with a hover-intent trigger (300ms open, 150ms close grace, per spec §4.2) serves hover, focus, and click through one code path. `sheet` remains for the touch breakpoint.

Net primitive count is unchanged: `+popover`, `−hover-card`, and `sheet` was already in the §9.2 Settings row.

---

**Delta 3 — cancelled state on `outbound_messages`. ACCEPTED, with a correction to the mechanism.**

Add `'cancelled'` to the state CHECK (§6.7). Deleting the row instead would lose the audit trail FR53 and NFR15 want, so the spec's reasoning holds.

**But undo must not race the drain.** The spec describes cancelling a `pending` row inside a 5-second window; §8.2 drains every 30 seconds, so most of the time that works and occasionally it does not — the worst kind of bug. The drain already filters `scheduled_for <= now()`, so the fix is free:

- Enqueue every send with `scheduled_for = now() + <undo window>`. The row is simply not eligible until the window closes.
- Cancel is then `UPDATE … SET state='cancelled' WHERE id=$1 AND state='pending'`, and **the affected-row count is the answer**: 1 means cancelled, 0 means already claimed, and the UI says "already sent" instead of lying.

This also unifies undo with Story 6.4 AC2's configurable auto-send delay — they become the same mechanism with different window lengths, not two features.

`idx_outbox_pending` is unaffected; cancelled rows leave the partial index, which is what you want.

---

**Delta 4 — system events in the conversation timeline. ACCEPTED, via a new table. Rejecting the two cheaper framings.**

The spec is right that this is a data-model change, not a component change. Three requirements converge on it: NFR23 (failed drafts appear in the timeline), Story 5.4 AC3 (the escalation sentence in the conversation), Story 6.5 AC4 (delivery failures visible in the timeline, not only in logs).

Two tempting shortcuts, both rejected:

- **`UNION` against `audit_events`.** Rejected. Audit is a security artifact with a compliance lifetime; the timeline is a product surface whose copy changes with the UI. Coupling them means every wording change edits the audit trail, and every new audit event risks appearing in front of a customer-facing agent. They also have different access patterns — `audit_events` is keyed by actor and time, not conversation.
- **Deriving from `drafts`, `outbound_messages`, and conversation columns.** Rejected. Three extra queries per conversation open, no stable ordering across sources, and NFR2's 300ms p95 budget is already the tightest in the product.

**Ruling: add `conversation_events`** (§6.7) — tenant-scoped, RLS-forced, one indexed read per conversation, merged with `messages` by `created_at`. It is the 17th table and it earns its place.

> Note the pleasing consequence: `tests/rls_policy_coverage.sql`, added the same day, walks the catalog for tables carrying a `tenant_id`. A pull request that adds `conversation_events` without an enabled, forced policy carrying both `USING` and `WITH CHECK` **fails CI automatically**. Nobody has to remember.

---

**Delta 5 — list virtualisation vs. the 200KB budget. REJECTED for MVP.**

No windowing library. The premise is slightly off: Story 3.1 AC3 requires the list to *handle* 50,000 conversations, and cursor pagination already means 50,000 rows never reach the DOM — only the pages an agent scrolls through do.

The real risk is a long session accumulating appended pages. That is solved by bounding the retained window — keep roughly the last 200 rows and drop from the top as new pages append — which is a slice on an array, costs zero bytes, and preserves scroll position with a spacer.

`content-visibility: auto` on rows stays as suggested; it cuts layout cost for off-screen rows and is also free. NFR6 is 200KB for the *entire* dashboard, and spending a measurable slice of it on a list of email subjects is the wrong trade while a cheaper mechanism is untested.

**Revisit if** INP p75 on the inbox exceeds 200ms (NFR1) with the bounded window in place. That is a measurement, so the decision is reversible on evidence rather than on taste.

---
