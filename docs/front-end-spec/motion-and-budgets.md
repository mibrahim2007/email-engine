> **Shard of [Front-End Spec](../../Email%20Engine%20Front-End%20Spec.md) §12.**
> Derived file — edit the source document and re-shard, never this copy.

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
