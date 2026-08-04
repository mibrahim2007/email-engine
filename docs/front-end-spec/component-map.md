> **Shard of [Front-End Spec](../../Email%20Engine%20Front-End%20Spec.md) §7.**
> Derived file — edit the source document and re-shard, never this copy.

## 7. Component map

Extends Architecture §9.2. **Bold** entries are additions this spec requires.

| Area | shadcn primitives | Custom composites |
|---|---|---|
| Inbox | `data-table`, `badge`, `avatar`, `command`, `scroll-area` | `ConversationList`, `ConversationRow`, `FilterBar`, **`SavedViewNav`**, **`DraftReadyBadge`** |
| Thread | `card`, `separator`, `collapsible`, `tabs` | `MessageBubble`, `QuotedHistory`, `AttachmentChip`, **`TimelineEvent`** |
| Draft review | `textarea`, `button`, `tooltip`, **`popover`**, **`sheet`**, `alert` — *`hover-card` removed per Architecture §9.5* | `DraftPanel`, `ConfidenceMeter`, `CitationPopover`, **`EscalationCard`**, **`ThresholdMarker`** |
| Playground | `input`, `scroll-area`, `skeleton` | `ChatStream`, `ToolCallTrace`, **`InjectionPreset`** |
| KB | `dialog`, `progress`, `table`, `dropdown-menu` | `SourceUploader`, `IndexStatus` |
| Settings | `form`, `select`, `switch`, `slider`, `sheet` | `MailboxConnectCard`, `PersonaEditor`, `AutoSendThreshold`, **`AutoSendExplainer`** |
| Onboarding | `progress`, `card`, `button` | **`OnboardingStepper`**, **`FirstDraftWatcher`** |
| Global | `sonner`, `dialog`, `command`, `dropdown-menu` | `OrgSwitcher`, `CommandPalette`, **`UndoToast`**, **`ConnectionHealthBanner`** |

> **⚠ Architecture delta 4 — ✅ accepted as a new table** (Architecture §9.5, SQL in §6.7). `TimelineEvent` is not a message: NFR23, Story 5.4 AC3, and Story 6.5 AC4 all require system events *in the conversation timeline*, so the thread renders a heterogeneous list and `MessageBubble` alone cannot express it.
>
> Resolved with a `conversation_events` table — append-only, RLS-forced, one indexed read merged with `messages` by `created_at`. Two cheaper framings were rejected: `UNION` on `audit_events` couples a compliance artifact to UI copy, and deriving from `drafts` + `outbound_messages` + conversation columns costs three extra queries against the tightest latency budget in the product (NFR2, 300ms p95).

**Client/server split** (Architecture §9.2 rule: `"use client"` on the smallest leaf):

- **Server:** `ConversationList`, `ConversationRow`, `MessageBubble`, `TimelineEvent`, `IndexStatus`, all of Analytics.
- **Client:** `DraftPanel` (editable), `CitationPopover`, `CommandPalette`, `FilterBar`, `ConfidenceMeter` (threshold is interactive in settings), `ChatStream`, `UndoToast`, `OnboardingStepper`.
- `ConversationRow` stays a Server Component; the optimistic status change lives in a small client leaf inside it, not by promoting the row.

---
