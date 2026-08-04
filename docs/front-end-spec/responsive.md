> **Shard of [Front-End Spec](../../Email%20Engine%20Front-End%20Spec.md) §10.**
> Derived file — edit the source document and re-shard, never this copy.

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
