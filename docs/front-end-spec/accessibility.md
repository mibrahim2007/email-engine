> **Shard of [Front-End Spec](../../Email%20Engine%20Front-End%20Spec.md) §11.**
> Derived file — edit the source document and re-shard, never this copy.

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
