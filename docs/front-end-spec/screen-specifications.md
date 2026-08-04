> **Shard of [Front-End Spec](../../Email%20Engine%20Front-End%20Spec.md) §6.**
> Derived file — edit the source document and re-shard, never this copy.

## 6. Screen specifications

Beyond the core loop, in decreasing order of how much design risk they carry.

### 6.1 Inbox

Density is the feature. Target **≥ 18 rows visible at 1080p** without scrolling.

```
┌─────────────────────────────────────────────────────────────┐
│ [Status ▾][Assignee ▾][Mailbox ▾][Date ▾]  🔍 search…       │
├─────────────────────────────────────────────────────────────┤
│ ● Priya Sharma    Re: Invoice #4021        billing  ✎87  2h │
│   Marco Ruiz      Password reset help      account  ✎92  4h │
│ ⚠ Dana Okoye      Cancel my subscription   —       AR   5h  │
│   Sam Lee         Re: Shipping delay       shipping ✎78  1d │
└─────────────────────────────────────────────────────────────┘
   │  │              │                        │       │    │
   │  └ sender       └ subject + snippet      │       │    └ relative
   └ unread dot                    intent ────┘       └ draft ready
                                                        + confidence
```

- `✎87` means a draft is waiting at 87% — **the single highest-value glyph in the product**, since it tells the agent which rows are one keystroke from done. `⚠` marks escalation; `AR` is the assignee's initials.
- Cursor pagination, infinite scroll, virtualised. Must hold 50,000 conversations (Story 3.1 AC3).
- Filters serialise to the URL (Story 3.2 AC1, AC3) — shareable and back-button-correct.
- **Empty states are designed, not default** (Story 3.1 AC4): no conversations yet → onboarding pointer; no results for filters → the active filters, each individually clearable.

### 6.2 Playground

Two panes: chat left, trace right. `ChatStream` via `useChat` (Architecture §9.3), `ToolCallTrace` expanded by default. A persona-changed banner appears when settings were edited in another tab — Story 5.6 AC4 requires changes take effect immediately, so the UI must not silently serve a stale persona.

A **prompt-injection preset** ships in the playground (Story 5.6 AC5), one click to run the corpus. Making the adversarial test a visible affordance rather than a CI-only artifact is what gets admins to actually look at it.

### 6.3 Knowledge

`table` of sources: title, type icon, chunk count, last indexed, status badge, row menu (re-index, delete). Detail view shows chunks with token counts. Direct search (FR28) returns chunks with scores, which is also how an admin debugs a bad citation.

### 6.4 Analytics

Five cards over a selectable period: volume, deflection rate, draft acceptance, median first response, escalation reasons (a breakdown, not a single number). Every number is clickable through to the filtered conversation list that produced it — an analytics screen that cannot be interrogated gets distrusted and then ignored.

### 6.5 Settings

| Screen | Notes |
|---|---|
| Mailboxes | `MailboxConnectCard` per mailbox with health, last sync, backfill progress. Broken connections surface at the top and in a global banner (FR11) |
| Persona | Tone, formality, signature (with live preview), prohibited topics, disclaimers, `AutoSendThreshold` (§5.3) |
| Team | Members, roles, invites. Role changes take effect on the member's next request |
| API keys | Key shown **once**, on creation, with an explicit "copy now" state that cannot be dismissed accidentally (FR46). Webhook subscriptions with a delivery log |
| Billing | Plan, usage against limits, invoices |

---
