> **Shard of [PRD](../../Email%20Engine%20PRD.md) §6 Epic 3.**
> Derived file — edit the source document and re-shard, never this copy.

### Epic 3 — Inbox UI

**Goal:** a support team could use the product today with zero AI. This epic proves the data model and the interaction speed before any model cost is incurred.

---

**Story 3.1 — Conversation list**
*As an agent, I want a fast list of conversations, so that I can see what needs attention.*

1. The inbox renders as a Server Component, sorted by `last_message_at` descending.
2. Each row shows sender, subject, snippet, status, assignee avatar, message count, and relative time.
3. Cursor pagination loads more without a full page reload; the list handles 50,000 conversations without degradation.
4. Empty, loading, and error states are designed, not default.
5. Server response for the first page is under 300ms at p95 against seeded production-scale data.

---

**Story 3.2 — Filtering and search**
*As an agent, I want to narrow the list, so that I can work a queue instead of an ocean.*

1. Filters for status, assignee, mailbox, and date range combine and are reflected in the URL.
2. Free-text search covers subject, sender, and body with trigram-assisted matching.
3. Filter state survives refresh and back-navigation.
4. Saved views ("Unassigned", "Mine", "Needs human") are one click from the sidebar.
5. Search returns in under 500ms at p95 at target scale.

---

**Story 3.3 — Conversation detail**
*As an agent, I want to read a full thread, so that I have the context to reply.*

1. Messages render chronologically with sender, recipients, timestamp, and direction clearly distinct.
2. Quoted history is collapsed by default and expandable inline.
3. Sanitized HTML renders inside a sandboxed iframe with a strict CSP.
4. Attachments are listed with type icons and download via signed, expiring URLs.
5. The view is dynamic and never served from cache.

---

**Story 3.4 — Status, assignment, and contact panel**
*As an agent, I want to triage a conversation, so that work is distributed and tracked.*

1. Status can be changed to `open`, `pending`, `resolved`, or `spam` from the list and the detail view.
2. A conversation can be assigned to any member; assignment notifies the assignee.
3. Changes apply optimistically and reconcile; a failure rolls back visibly with an explanation.
4. The contact panel shows the sender's name, company, custom fields, and prior conversations.
5. Every status and assignment change writes an audit event.

---

**Story 3.5 — Manual reply**
*As an agent, I want to write and send a reply myself, so that I am never blocked by the AI.*

1. A composer supports plain text with basic formatting and renders both HTML and text parts.
2. The reply threads correctly into the customer's existing thread.
3. The tenant signature is appended and previewable.
4. Send is disabled while in flight and shows an unambiguous result.
5. A sent reply appears in the thread immediately and sets `first_response_at` if unset.

---

**Story 3.6 — Live updates and keyboard navigation**
*As an agent, I want the inbox to keep up with me and my team, so that I never work from a stale view.*

1. New messages and teammate changes appear within 10 seconds without a manual refresh.
2. `j`/`k`/`Enter`/`e`/`a`/`⌘Enter` shortcuts work as specified, with a discoverable shortcut sheet.
3. `⌘K` opens a command palette for navigation, search, and conversation actions.
4. Polling pauses when the tab is hidden and resumes on focus.
5. Keyboard focus order matches visual order and all actions are reachable without a mouse.

---
