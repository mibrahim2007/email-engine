> **Shard of [Front-End Spec](../../Email%20Engine%20Front-End%20Spec.md) §5.**
> Derived file — edit the source document and re-shard, never this copy.

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
