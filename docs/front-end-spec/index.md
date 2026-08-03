> **Shards of [Email Engine Front-End Spec.md](../../Email%20Engine%20Front-End%20Spec.md).**
> Derived files — edit the source document and re-shard, never these copies.

# Front-end spec shards

Sharded on 2026-08-03 by the PO. Architecture §1.3's plan does not mention this document — it was written after the architecture — but the SM needs it for Epics 3, 5, and 6, so it is sharded on the same terms.

| Shard | Source | Covers |
|---|---|---|
| [design-principles.md](./design-principles.md) | §1 | The five falsifiable rules |
| [information-architecture.md](./information-architecture.md) | §2 | Sitemap and navigation |
| [core-loop.md](./core-loop.md) | §3 | **Conversation + draft review** — the product |
| [supervision-surface.md](./supervision-surface.md) | §4 | Confidence meter, citations, tool trace, and what is deliberately absent |
| [user-flows.md](./user-flows.md) | §5 | Review loop, onboarding, enabling auto-send, adding knowledge |
| [screen-specifications.md](./screen-specifications.md) | §6 | Inbox, playground, knowledge, analytics, settings |
| [component-map.md](./component-map.md) | §7 | shadcn primitives → custom composites, client/server split |
| [keyboard-model.md](./keyboard-model.md) | §8 | Every shortcut, and the two that are load-bearing |
| [states-and-errors.md](./states-and-errors.md) | §9 | Loading, empty, error, partial |
| [responsive.md](./responsive.md) | §10 | Breakpoints, and why mobile cannot compose |
| [accessibility.md](./accessibility.md) | §11 | WCAG 2.1 AA per custom composite |
| [motion-and-budgets.md](./motion-and-budgets.md) | §12 | Motion rules and the performance budgets |
| [decisions-and-handoff.md](./decisions-and-handoff.md) | §13–14 | Open question 6 resolved, and the five delta rulings |

## Which shards each epic needs

The SM embeds these into story files rather than pointing at them — Architecture §1.2 requires a story to be self-contained.

| Epic | Shards to embed |
|---|---|
| **Epic 3** — Inbox UI | `core-loop`, `information-architecture`, `screen-specifications`, `keyboard-model`, `states-and-errors`, `accessibility`, `responsive` |
| **Epic 5** — AI reply engine | `core-loop`, `supervision-surface`, `accessibility`, `screen-specifications` (playground) |
| **Epic 6** — Sending and automation | `user-flows` (§5.1 undo, §5.3 enabling auto-send) |

---

Back to [PRD shards](../prd/index.md) · [Architecture shards](../architecture/index.md)
