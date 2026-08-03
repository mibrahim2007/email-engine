> **Shard of [PRD](../../Email%20Engine%20PRD.md) §3.**
> Derived file — edit the source document and re-shard, never this copy.

## 3. User interface design goals

### 3.1 UX vision

The inbox should feel like a fast email client that happens to have already written the reply — not like a dashboard with an AI panel bolted on. The primary loop is *read the draft, glance at the confidence and sources, hit send*. Everything else is secondary chrome. If reviewing a draft takes longer than writing a reply from scratch, the product has failed regardless of model quality.

Trust is built by exposure, not by claims: the confidence score, the cited sources, and the tool trace are always one click away. Agents move the auto-send threshold up because they've watched it work, not because we told them to.

### 3.2 Key interaction paradigms

- **Keyboard-first.** `j`/`k` to move, `Enter` to open, `e` to resolve, `a` to assign, `⌘Enter` to send, `⌘K` for the command palette. A power agent should never touch the mouse in the review loop.
- **Progressive disclosure of AI.** The draft is text in a compose box. Confidence is a small meter. Citations are hover-cards. The tool trace lives behind a disclosure. Nothing about the machinery is in the way of sending.
- **Optimistic everything.** Status changes, assignment, and resolution apply instantly and reconcile in the background.
- **Escalation is a first-class state,** not an error. When the AI declines to draft, it says why, in one plain sentence, in the conversation.

### 3.3 Core screens

| Screen | Purpose |
|---|---|
| **Inbox** | Filterable conversation list; the default landing page |
| **Conversation** | Thread + contact panel + draft review panel |
| **Playground** | Test the bot conversationally; see tool calls |
| **Knowledge** | Source list, upload, index status, direct search |
| **Analytics** | Volume, deflection, response time, escalation reasons |
| **Settings → Mailboxes** | Connect, health, backfill status |
| **Settings → Persona** | Tone, signature, prohibited topics, auto-send threshold |
| **Settings → Team** | Members, roles, invites |
| **Settings → API keys** | Create, revoke, webhook subscriptions |
| **Settings → Billing** | Plan, usage, invoices |
| **Onboarding** | Connect mailbox → add knowledge → see first draft |

### 3.4 Accessibility

WCAG 2.1 AA. Radix primitives via shadcn/ui give keyboard and ARIA behavior; the obligation is on custom composites. Confidence must never be communicated by color alone — the meter carries a numeral and a label. All interactive targets ≥ 44px on touch. Focus order in the conversation view goes thread → draft → send, matching the task.

### 3.5 Branding

Clean, dense, product-neutral — closer to Linear than to Salesforce. Tenants can override brand color and logo for their own dashboard; those overrides apply as runtime CSS custom properties, never a rebuild. Outbound email branding (signature, logo, footer) is separately configurable and is what the tenant's customers actually see.

### 3.6 Target platforms

Responsive web, desktop-first. The review loop is a desktop task; the mobile breakpoint targets triage — read, resolve, assign, escalate — not composing. No native apps in MVP.

---

