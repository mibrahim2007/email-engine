---
title: Email Engine — Front-End Specification
type: project
status: active
created: 2026-08-03
updated: 2026-08-03
version: 1.1
due:
area:
tags:
  - project
  - ux
  - front-end-spec
  - bmad
---

# 🎨 Email Engine — Front-End Specification

> **BMAD artifact:** UX Expert. Consumes [[Email Engine PRD]], and is consumed by [[Email Engine Architecture]] §9 and by the SM when drafting Epic 3, 5, and 6 stories. Sharded as `docs/front-end-spec.md`.

| | |
|---|---|
| **Version** | 1.1 — deltas ruled on |
| **Status** | Draft — pending PO master checklist |
| **Owner** | UX Expert agent |
| **Written against** | PRD §3 (UI design goals), Epics 3, 5, 6 |
| **Resolves** | PRD §8 open question 6 (see §13) |
| **Deltas** | All five ruled on 2026-08-03 — [[Email Engine Architecture]] §9.5. Four accepted, one rejected; see §14 |

> [!note] Written after the architecture, not before
> BMAD sequences UX before the Architect, and that did not happen here — [[Email Engine Architecture]] v1.0 shipped first and already fixed the route structure (§9.1), the component inventory (§9.2), and the state model (§9.3). This spec therefore **conforms to** those decisions rather than driving them, and every place where UX needs something the architecture did not anticipate is called out explicitly as **⚠ Architecture delta** so the Architect can accept or reject it in one pass. There are five.

---

## 1. Design principles

Five rules, each falsifiable. A design that violates one is wrong even if it looks better.

1. **Reviewing must beat writing.** The benchmark is the agent's own hands: if the median draft takes longer to review than to type from scratch, the feature is negative value. Budget: **≤ 8 seconds** from opening a conversation to sending an accepted draft, ≤ 3 keystrokes.
2. **Trust is earned by exposure, never by assertion.** Never show a claim about the AI's reliability. Show the confidence, the sources, and the tool calls, and let the agent form their own estimate. No "AI-powered" badges, no sparkle icons, no persuasion.
3. **The machinery yields to the message.** The draft is text in a box. Confidence is a small meter. Citations are markers. The tool trace is behind a disclosure. Progressive disclosure is not decoration here — it is what keeps rule 1 true.
4. **Every AI failure is visible and explained in one sentence.** Silence is prohibited (NFR23). An escalation, a timeout, and a model outage each produce a timeline entry in plain language, in the conversation, where the agent already is.
5. **Colour is never the only carrier.** Every state encoded in colour also carries a numeral, a word, or a shape (§4.2, §11).

---

## 2. Information architecture

### 2.1 Sitemap

```
(marketing)                        public, static
├── /                              landing
└── /pricing

(auth)
├── /sign-in                       Clerk
└── /sign-up                       Clerk → creates Organization

(app)                              Clerk-guarded, org-scoped
├── /onboarding                    3 steps, dismissible after first draft
├── /inbox                         ← default landing
│   └── /inbox/[conversationId]    the core loop
├── /knowledge
│   └── /knowledge/[sourceId]
├── /playground
├── /analytics
└── /settings
    ├── /mailboxes
    ├── /persona                   includes the auto-send threshold
    ├── /team
    ├── /api-keys
    └── /billing
```

Matches Architecture §9.1 exactly. `/onboarding` is the one addition.

> **⚠ Architecture delta 1 — ✅ accepted** (Architecture §9.5). `app/(app)/onboarding/page.tsx`, with the `(app)` layout's auth check already covering it. One amendment: the "no mailbox connected → onboarding" redirect goes in `inbox/page.tsx`, **not** the layout — a layout check would add a mailbox-count query to every authenticated request in the product, to serve a redirect that only matters on the landing route.

### 2.2 Navigation

**Primary — persistent left sidebar, 240px, collapsible to 56px icons.**

```
┌────────────────────┐
│ ◈ Acme Support  ▾  │  OrgSwitcher (Clerk)
├────────────────────┤
│ ▸ Inbox         12 │  count = open + unassigned
│   ├ Unassigned   5 │  saved views (Story 3.2 AC4)
│   ├ Mine         3 │
│   └ Needs human  2 │  ← escalations, always last, always visible
│ ▸ Knowledge        │
│ ▸ Playground       │
│ ▸ Analytics        │
├────────────────────┤
│ ⚙ Settings         │
│ ⌘K                 │  palette hint, not a button
└────────────────────┘
```

- **Saved views are nav, not filters.** "Unassigned", "Mine", "Needs human" are sidebar links carrying URL params. Story 3.2 AC4 requires one click; a filter panel is two.
- **"Needs human" never collapses to zero-state invisibility.** It shows `0` rather than disappearing — a disappearing escalation queue teaches agents not to look at it.
- Counts poll on the same 10s SWR cycle as the inbox (Architecture §9.3), not a separate request.

**Secondary — none.** No tabs, no breadcrumbs. Depth is two levels everywhere; a third level would be a design failure.

---

## 3. The core loop — conversation + draft review

This is the product. Everything in §4 is a detail of this screen, and PRD §9's UX prompt prioritises it above all other work.

### 3.1 Layout

Three columns at ≥1280px. The thread is the reading surface, the draft is the acting surface, and the contact panel is reference that never earns the middle.

```
┌──────────┬────────────────────────────────────┬──────────────┐
│ SIDEBAR  │  ← Back    Re: Invoice #4021   ⋯   │  CONTACT     │
│          ├────────────────────────────────────┤              │
│ (240px)  │  ▼ Thread                          │ Marco Ruiz   │
│          │  ┌──────────────────────────────┐  │ acme.com     │
│          │  │ Priya · customer · 2h ago    │  │              │
│          │  │ Hi — I was charged twice for  │  │ Plan: Pro    │
│          │  │ invoice #4021…                │  │ MRR: $490    │
│          │  │ ▸ show quoted history         │  │ Since: 2024  │
│          │  └──────────────────────────────┘  │              │
│          │  ┌──────────────────────────────┐  │ ── History ──│
│          │  │ ⚙ system · 2h ago            │  │ 4 prior      │
│          │  │ Classified: billing · urgent  │  │ ▸ Refund…    │
│          │  └──────────────────────────────┘  │ ▸ Login iss… │
│          ├────────────────────────────────────┤ ▸ Onboardin… │
│          │  ▼ DRAFT            ⌘↵ to send     │              │
│          │  ┌──────────────────────────────┐  │              │
│          │  │ Hi Priya,                     │  │              │
│          │  │                               │  │              │
│          │  │ You were charged twice on     │  │              │
│          │  │ Feb 3 because…             ¹  │  │  ← citation  │
│          │  │                               │  │    marker    │
│          │  │ Refunds land in 5–7 days.  ²  │  │              │
│          │  └──────────────────────────────┘  │              │
│          │  ●●●○ 87 · Moderate    ▏threshold  │              │
│          │  ¹ Billing FAQ  ² Refund policy    │              │
│          │  ▸ 3 tool calls · gpt-…  · 4.2s    │              │
│          │  [ Send ⌘↵ ] [ Regenerate ] [ ✕ ]  │              │
│          └────────────────────────────────────┴──────────────┘
```

**Why the draft sits below the thread and not beside it:** the agent reads the customer's last message and the draft in one downward eye path. Side-by-side forces a horizontal saccade between two blocks of prose and measurably slows comparison — and comparison is the entire review task.

**Focus order** — thread → draft body → send. Matches PRD §3.4 and the task itself.

### 3.2 The draft panel states

| State | What renders | Primary action |
|---|---|---|
| `proposed` | Editable composer, confidence, citations, trace | **Send** (`⌘↵`) |
| `edited` | Same, with "edited" marker and edit distance recorded on send | **Send** |
| Generating | Skeleton lines + "Drafting…" with elapsed seconds | Cancel |
| Escalated — no draft | **Escalation card, not an empty composer** (§3.3) | Write reply |
| Failed | One-sentence cause + Retry | Retry / Write reply |
| `auto_sent` | Read-only, "Sent automatically ·  2h ago" banner | View in thread |
| No draft (AI off) | Plain composer, no AI chrome at all | Send |

The `auto_sent` and escalated states must never render as a disabled composer. A greyed-out box invites clicking; a card explains.

### 3.3 The escalation card

PRD §3.2 makes escalation "a first-class state, not an error", and Story 5.4 AC3 requires one plain sentence. This replaces the composer entirely:

```
┌────────────────────────────────────────────────┐
│ ⚠ Not drafted — needs a person                 │
│                                                │
│ The customer is asking to cancel and sounds    │
│ frustrated, so I left this one for you.        │
│                                                │
│ Trigger: negative sentiment (−0.72)            │
│ ▸ What I found before stopping   (2 tool calls)│
│                                                │
│ [ Write a reply ]  [ Draft anyway ]            │
└────────────────────────────────────────────────┘
```

- **First person, no jargon.** "I left this one for you", not "ESCALATION_SENTIMENT_THRESHOLD_EXCEEDED". The trigger and score are present but demoted.
- **"Draft anyway" is deliberate.** Without an override the agent learns escalation is a dead end and stops trusting the classifier's judgement. With it, an override is a labelled training signal — record every one against Story 5.4 AC5's precision metric.
- The retrieval done before stopping is not discarded; it collapses behind a disclosure.

---

## 4. The supervision surface

The PRD's UX prompt calls for these to be specified "precisely, including their non-color accessibility treatment". This section is normative.

### 4.1 Confidence — the `ConfidenceMeter` composite

Story 5.5 AC1 requires "a number and a label, not color alone". The spec goes further: **four redundant encodings**, any one of which is sufficient to read the value.

> [!important] What the number means — settled 2026-08-07 (PRD §8 Q10)
> `confidence` is **computed groundedness**, not the model's opinion of itself: the fraction of the reply's factual sentences carrying a citation that resolves to a chunk actually retrieved for this draft. [[Email Engine Architecture]] §10.4 has the ruling.
>
> **So the meter must not imply a probability of being right.** Groundedness is *provenance*, not truth — a reply can be perfectly cited to a chunk that is out of date. The label says what was measured and lets the agent draw the conclusion: **"84% of this reply's factual sentences are backed by a source you can click."**
>
> That sentence is also what makes §5.3's auto-send dialog honest. Under a self-report its second half would have read *"84 drafts the model felt good about"* — which should stop a support lead from arming auto-send, correctly.

```
●●●○  87 · Moderate        ▏0.90
└─┬┘  └┬┘   └───┬───┘      └──┬──┘
  │    │        │             threshold marker
  │    │        └─ word label
  │    └─ numeral, always present
  └─ filled segments — shape, works in greyscale
```

| Band | Segments | Numeral | Label | Colour (redundant) |
|---|---|---|---|---|
| ≥ 90 | ●●●● | 90–100 | High | `--color-primary` |
| 75–89 | ●●●○ | 75–89 | Moderate | `--color-primary` at 60% |
| 60–74 | ●●○○ | 60–74 | Low | `--color-muted-foreground` |
| < 60 | — | — | — | never drafted; escalates (Story 5.4 AC1) |
| **`NULL`** | — | — | **No factual claims to check** | `--color-muted-foreground` |

**`NULL` is a real state, not missing data** *(added 2026-08-07)*. A reply that makes no factual claims — *"I've passed this to a colleague"* — has no groundedness to report, so the denominator is zero. It renders as its own label and **never as `0`**, which would read as *badly* grounded and be wrong. It never auto-sends (Story 6.3) and it escalates (Story 5.4): the safe reading of *no signal* is human review, not a pass.

**The threshold marker is the trust-building device.** A thin tick on the meter shows where the tenant's auto-send threshold sits relative to this draft. Over weeks the agent watches drafts land above a line that is not yet armed — which is what makes moving the threshold an informed act rather than a leap of faith (PRD §3.1). It renders even when auto-send is off; especially then.

**Accessibility:**
- `role="meter"`, `aria-valuenow="87"`, `aria-valuemin="0"`, `aria-valuemax="100"`, `aria-label="87% of this reply's factual sentences are backed by a cited source. Moderate. Auto-send threshold 90%."` *(Reworded 2026-08-07: "Draft confidence 87 of 100" named a quantity the number is not — see the callout above.)*
- Segments are `aria-hidden` — decorative duplication of the numeral.
- Contrast ≥ 4.5:1 on all four bands in both themes. Verified against the §9.2 `oklch` tokens, not assumed.
- Never the sole content of a table cell or list row.

### 4.2 Citations — the `CitationPopover` composite

Story 5.5 AC2 asks for a hover-card. **A hover-card alone fails WCAG 2.1 AA** — hover is not a keyboard or touch affordance, and NFR24 is not optional.

The spec: each cited claim carries a superscript marker rendered as a **`<button>`**, not a `<span>`.

| Input | Behaviour |
|---|---|
| Hover (pointer) | Popover after 300ms, dismiss on exit + 150ms grace |
| Focus (keyboard) | Popover on focus; `Esc` closes and returns focus to the marker |
| `Enter` / `Space` | Pins the popover open until dismissed |
| Tap (touch) | Bottom sheet, not a popover — thumb-reachable |

Popover contents, in order: **source title** → **the chunk excerpt with the matched span emphasised** → **retrieval score** → **link to the source in `/knowledge`**.

The excerpt is the point. A citation that shows only a document title asks the agent to trust a filename; showing the actual sentence lets them verify in about a second, which is the §1 rule-1 budget.

Markers are numbered per draft (`¹ ² ³`) and repeated in a footnote row beneath the composer, so the citation set is legible without any hovering at all.

> **⚠ Architecture delta 2 — ✅ accepted, and taken further.** §9.2 mapped draft review to `hover-card`, which is pointer-only by design in Radix. Architecture §9.5 accepts `popover` + `sheet` **and drops `hover-card` entirely**: a single `popover` with a hover-intent trigger serves hover, focus, and click through one code path, where maintaining both would let the accessible path drift out of sync with the one people use daily.

### 4.3 Tool trace — the `ToolCallTrace` composite

One collapsed line: `▸ 3 tool calls · gpt-… · 4.2s`. Expanded, a vertical list of steps, each showing tool name, input summary, output summary, duration, and — for `search_knowledge_base` — the chunks with scores (Story 5.6 AC3).

Collapsed by default in the conversation. **Expanded by default in the playground**, where inspecting the machinery *is* the task.

### 4.4 What is deliberately absent

No streaming token animation on the draft. The draft is complete before the agent sees it — it was generated by a background workflow up to 30 seconds earlier (NFR3), not on open. Animating it in would be theatre that costs review time. Streaming belongs in the playground, where the wait is real.

---

## 5. User flows

### 5.1 The review loop (Epic 3 + 5, the critical path)

```
Inbox ──j/k──▶ row highlighted
                │ Enter
                ▼
        Conversation opens, draft focused
                │
                ├─ read draft (~4s) ──┐
                │                      │
                ├─ glance confidence ──┤
                │                      │
                ├─ hover citation? ────┤  optional
                │                      │
                ▼                      ▼
        ⌘↵ send ◀──────────── edit, then ⌘↵
                │
                ▼
        Optimistic: row greys, toast "Sent · Undo"
                │
                ├─ Undo within 5s ──▶ cancels outbox row
                │
                ▼
        Auto-advance to next conversation
```

**Auto-advance is what makes the loop a loop.** Returning to the list after each send costs a re-orientation the agent pays hundreds of times a day. Setting: on by default, disableable per user.

**Undo is a real cancel, not a UI trick.** Architecture §8.2 drains the outbox on a cron, so a row in `pending` can genuinely be cancelled before it is claimed. The 5s window is well inside the drain interval.

> **⚠ Architecture delta 3 — ✅ accepted, mechanism corrected** (Architecture §9.5, SQL in §6.7). `cancelled` joins the state CHECK; deleting the row was rejected for the audit-trail reason above.
>
> The correction matters: cancelling a `pending` row inside a 5-second window **races the 30-second drain** — it works most of the time and occasionally doesn't. Instead, enqueue every send with `scheduled_for = now() + <undo window>`, so the row is simply not eligible until the window closes. Cancel then reports the truth via its affected-row count — 1 means cancelled, 0 means already claimed, and the toast says "already sent" rather than lying. This also makes undo and Story 6.4's auto-send delay the same mechanism at two window lengths.

### 5.2 Onboarding — signup to first draft

Gated on a metric: **< 10 minutes at p75** (PRD §1.4). Three steps, and the third is not a form.

```
1. Connect a mailbox        OAuth (Gmail / Outlook) or IMAP or webhook
   └─ success ──▶ backfill starts in background, non-blocking (FR12)

2. Add knowledge            paste a URL, or drag a file
   └─ ≥1 source indexed ──▶ progress shown per source, not a spinner

3. Watch the first draft    live tile: "3 conversations ingested · drafting…"
   └─ first draft ready ──▶ opens it directly in the review loop
```

- **Step 3 is the activation moment**, so it is a screen rather than a checklist item. Landing the user in a real conversation with a real draft is the product demonstrating itself.
- Backfill runs behind steps 2 and 3. Blocking on 30 days of mail (FR12) would blow the 10-minute budget on its own.
- Dismissible after the first draft; recoverable from Settings.

### 5.3 Enabling auto-send (Story 6.3)

The highest-consequence action in the product — after this, the system speaks to customers unsupervised. Story 6.3 AC4 requires acknowledging a plain-language explanation.

```
Settings → Persona → Auto-send  [toggle]
        │
        ▼
  Dialog: "What will happen"
  ┌──────────────────────────────────────────────┐
  │ With auto-send at 0.90, of your last 200      │
  │ drafts, 84 (42%) would have sent without a    │
  │ person reading them.                          │
  │                                               │
  │ Here are 3 of them:            ▸ show all 84 │
  │  · Re: Invoice #4021        0.94              │
  │  · Re: Password reset       0.91              │
  │  · Re: Shipping delay       0.90              │
  │                                               │
  │ Replies still wait for business hours and     │
  │ a 5-minute delay you can cancel within.       │
  │                                               │
  │ [ Cancel ]        [ Turn on auto-send ]       │
  └──────────────────────────────────────────────┘
```

**Backtesting against the tenant's own history is the entire design.** An abstract "0.90" means nothing; "84 of your last 200, and here they are" is a decision someone can actually make. The threshold slider updates the count live as it moves — the interaction *is* the explanation Story 6.3 AC4 asks for.

Disabling is one click with no dialog, and cancels pending auto-sends (AC5). Asymmetry is correct: adding risk deserves friction, removing it does not.

### 5.4 Adding knowledge (Epic 4)

Drag file / paste URL / paste text → source row appears immediately with `pending` → live per-source progress (extract → chunk → embed) → `indexed` with chunk count, or a failure with a stated cause and Retry.

Never a global spinner. Sources index independently and the list must show that.

---

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

## 8. Keyboard model

PRD §3.2: a power agent never touches the mouse in the review loop.

| Key | Context | Action |
|---|---|---|
| `j` / `k` | Inbox | Next / previous conversation |
| `Enter` | Inbox | Open |
| `Esc` | Conversation | Back to inbox |
| `e` | Both | Resolve |
| `a` | Both | Assign — opens `command` scoped to members |
| `⌘↵` | Draft | Send |
| `⌘⇧↵` | Draft | Send and resolve |
| `r` | Conversation | Regenerate draft |
| `⌘Z` | After send | Undo, within the 5s window |
| `/` | Inbox | Focus search |
| `⌘K` | Global | Command palette |
| `?` | Global | Shortcut sheet |

- **`⌘↵` must work from inside the textarea**, where a naive key handler would be swallowed by the editor. This is the single most-pressed key in the product.
- No single-letter shortcut fires while a text input has focus.
- `⌘K` covers navigation, conversation search, and actions on the current conversation (Story 3.6 AC3).
- `?` is discoverable from the palette, satisfying Story 3.6 AC2's "discoverable shortcut sheet".

---

## 9. States, loading, and errors

Every screen specifies four states. Defaults are not acceptable (Story 3.1 AC4).

| State | Rule |
|---|---|
| **Loading** | Skeletons matching final layout dimensions — never a centred spinner. RSC streams the shell; Suspense boundaries wrap list and draft separately, so a slow draft never delays the thread |
| **Empty** | Says what it is, why, and the one action that changes it. "No conversations yet — connect a mailbox to start receiving mail" |
| **Error** | Plain cause + a retry that retries *that thing*, not the page. Never a raw error code to an agent; a correlation id behind a disclosure for support |
| **Partial** | The common real case: thread loaded, draft still generating. Both render; the draft shows elapsed seconds. Never block the thread on the draft |

**Optimistic mutation failure** (Story 3.4 AC3): the row reverts with a visible animation and a toast stating what failed and why. A silent revert is worse than no optimism — the agent believes the change landed.

---

## 10. Responsive

Desktop-first; PRD §3.6 scopes mobile to **triage, not composing**.

| Breakpoint | Layout |
|---|---|
| ≥ 1280px | Three columns: sidebar + thread/draft + contact |
| 1024–1279px | Contact panel → `sheet` behind a button |
| 768–1023px | Sidebar → icon rail; list and detail become sibling routes |
| < 768px | Single column. List → detail navigation. **Draft is read-only with Send and Escalate**; editing is deliberately unavailable |

The mobile decision is a real one: a cramped composer produces bad replies sent to customers. Read, approve, resolve, assign, escalate — those are safe on a phone. Rewriting a paragraph is not.

Touch targets ≥ 44px (PRD §3.4). Citation markers get an expanded hit area without visual change.

---

## 11. Accessibility — WCAG 2.1 AA

NFR24 covers all authenticated screens. Radix via shadcn/ui handles primitives; **the obligation is entirely on the custom composites**, so those are specified here.

| Composite | Requirement |
|---|---|
| `ConfidenceMeter` | `role="meter"` with full `aria-label` (§4.1). Never colour-only. Contrast ≥ 4.5:1 across all bands, both themes |
| `CitationPopover` | Marker is a `<button>`. Focus opens, `Esc` closes and restores focus. Popover is `role="dialog"` with `aria-label` naming the source |
| `ConversationRow` | Whole row is one link. Status and intent badges carry text, not just colour. Unread state is announced, not only a dot |
| `DraftPanel` | `aria-live="polite"` announces "Draft ready, confidence 87, moderate" when generation completes |
| `EscalationCard` | `role="status"`. The one-sentence reason is the first thing a screen reader hits |
| `CommandPalette` | Radix `command` handles it; the obligation is not breaking its focus trap |
| `TimelineEvent` | System events are distinguishable from messages by text, not only indentation or colour |
| `UndoToast` | `role="alert"`, focusable, and the 5s window pauses on focus or hover — a timed action that cannot be caught fails 2.2.1 |

**Testing:** axe-core in CI on every route; manual keyboard pass on the review loop each release; screen-reader pass (VoiceOver + NVDA) on inbox, conversation, and draft review before Epic 5 closes.

Focus order in the conversation: thread → draft body → send (PRD §3.4).

---

## 12. Motion and performance budgets

**Motion.** Functional only. State changes 150ms, panel transitions 200ms, `prefers-reduced-motion` respected everywhere. No AI-thinking shimmer — see §4.4.

**Budgets**, from NFR1/NFR2/NFR6 and enforced in CI, not aspirational:

| Metric | Budget | Where it bites |
|---|---|---|
| LCP p75 | < 1.8s | Inbox first paint |
| INP p75 | < 200ms | `j`/`k` and status toggles |
| Conversation detail p95 | < 300ms | Server response |
| Client JS | < 200KB gzipped | The whole dashboard |

The 200KB ceiling is the binding constraint on component choices. Rich-text editing in the composer is the obvious threat: **plain text with minimal formatting** (Story 3.5 AC1) is a budget decision as much as a scope one. A full editor would spend a quarter of the budget on one box.

> **⚠ Architecture delta 5 — ✖ rejected for MVP** (Architecture §9.5). No windowing library. The premise was slightly off: Story 3.1 AC3 requires the list to *handle* 50,000 conversations, and cursor pagination already keeps 50,000 rows out of the DOM — only the pages actually scrolled reach it.
>
> The real risk is a long session accumulating appended pages, solved by bounding the retained window to roughly 200 rows and dropping from the top with a spacer to hold scroll position. That is an array slice, costs zero bytes, and leaves `content-visibility: auto` doing what it is good at. **Revisit if** inbox INP p75 exceeds 200ms (NFR1) with the bounded window in place — a measurement, so the decision reverses on evidence.

---

## 13. Resolution — PRD open question 6

> **Q6. Does MVP need a shared team view of who is currently viewing a conversation?** — Blocks Epic 3, owned by UX Expert.

**No. Ship assignment plus a send-time conflict check instead.**

Reasoning:

1. **Real presence needs infrastructure the architecture deliberately deferred.** §9.3 chose 10s SWR polling and marked `LISTEN/NOTIFY` → SSE as a future upgrade. Presence at a 10s resolution is worse than none — an avatar that appears seconds after someone starts typing, and lingers seconds after they leave, teaches agents to distrust it.
2. **The collision it prevents is already handled.** Teams of 3–20 (PRD §1.2) working an assigned queue rarely open the same conversation. Assignment is the coordination primitive, and it exists.
3. **The residual risk is duplicate sends, and that has a cheaper fix.** On send, if another message was added to the conversation since the draft was generated, block and show: *"Marco replied 30 seconds ago — review before sending."* This catches the actual failure at the actual moment, costs one query, and needs no realtime channel.

**Revisit when** either SSE lands for another reason, or analytics show duplicate-reply incidents above ~1% of sends. Both are observable, so this decision is falsifiable rather than permanent.

---

## 14. Handoff

**For the Architect** — ✅ **all five ruled on 2026-08-03** in [[Email Engine Architecture]] §9.5:

| # | Delta | Section | Ruling |
|---|---|---|---|
| 1 | `/onboarding` route missing from §9.1 | §2.1 | **Accepted.** Redirect goes in `inbox/page.tsx`, not the layout — a layout check would add a query to every authenticated request |
| 2 | Draft review needs `popover` + `sheet`; `hover-card` alone fails AA | §4.2 | **Accepted, and `hover-card` dropped.** One `popover` serves hover, focus, and click; two code paths would let the accessible one rot |
| 3 | `outbound_messages` needs a cancelled state for Undo | §5.1 | **Accepted, mechanism corrected.** Enqueue with `scheduled_for = now() + window` so cancel cannot race the 30s drain; the affected-row count tells the UI whether it won |
| 4 | Conversation timeline is messages **and** system events | §7 | **Accepted** as a new `conversation_events` table. `UNION` on `audit_events` and deriving from three sources were both rejected |
| 5 | List virtualisation vs. the 200KB JS budget | §12 | **Rejected for MVP.** Cursor pagination already keeps 50k rows out of the DOM; bound the retained window to ~200 rows instead. Revisit on a measured INP regression |

Deltas 3 and 4 are specified as SQL in Architecture §6.7 and await `migrations/0003_timeline_and_cancel.sql`.

Two consequences for this spec, both already folded in above: §4.2's hover-card is now a `popover`, and §7's component map drops `hover-card`.

**For the SM** — Epic 3 and 5 stories should embed §3 (core loop), §4 (supervision surface), §8 (keyboard), and §11 (accessibility) directly into the story files, per Architecture §1.2's rule that a story is self-contained.

**For the PO** — this artifact closes the gap flagged in [[Email Engine PRD]] §9 and README. Open question 6 is resolved in §13 and can be struck from the PRD table.

**Still open, not owned by UX:** PRD §8 questions 1–5 and 7. Question 1 (auto-send default) shapes §5.3's copy but not its design — the backtest dialog works at any threshold.

---

## Related

- [[Email Engine PRD]] — the requirements this serves
- [[Email Engine Architecture]] — §9 frontend architecture, which this conforms to and proposes five changes to
