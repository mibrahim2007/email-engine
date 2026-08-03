> **Shard of [Front-End Spec](../../Email%20Engine%20Front-End%20Spec.md) §3.**
> Derived file — edit the source document and re-shard, never this copy.

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

