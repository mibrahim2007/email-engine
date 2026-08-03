> **Shards of [Email Engine PRD.md](../../Email%20Engine%20PRD.md).**
> Derived files — edit the source document and re-shard, never these copies.

# PRD shards

Sharded on 2026-08-03 by the PO. Each file is an exact slice of the source; nothing was rewritten.

## Context

| Shard | Source |
|---|---|
| [goals-and-background-context.md](./goals-and-background-context.md) | §1 — goals, background, target users, success metrics, MVP boundary |
| [requirements.md](./requirements.md) | §2 — FR1–54, NFR1–25 |
| [user-interface-design-goals.md](./user-interface-design-goals.md) | §3 — UX vision, interaction paradigms, core screens, a11y, platforms |
| [technical-assumptions.md](./technical-assumptions.md) | §4 |
| [epic-list.md](./epic-list.md) | §5, plus the §6 story-format convention the SM works to |

## Epics — one per file, the SM's working unit

| Shard | Goal |
|---|---|
| [epic-1-foundation-and-tenancy.md](./epic-1-foundation-and-tenancy.md) | Tenancy, identity, roles, the RLS foundation |
| [epic-2-mailbox-connection-and-ingest.md](./epic-2-mailbox-connection-and-ingest.md) | Mail in the door: OAuth, IMAP, webhook, threading |
| [epic-3-inbox-ui.md](./epic-3-inbox-ui.md) | A usable support tool with zero AI |
| [epic-4-knowledge-base.md](./epic-4-knowledge-base.md) | The tenant's docs, searchable and citable |
| [epic-5-ai-reply-engine.md](./epic-5-ai-reply-engine.md) | Grounded, cited, reviewable drafts |
| [epic-6-sending-and-automation.md](./epic-6-sending-and-automation.md) | Closing the loop — exactly-once, auto-send |
| [epic-7-public-api-and-webhooks.md](./epic-7-public-api-and-webhooks.md) | The integration surface |
| [epic-8-analytics-billing-and-hardening.md](./epic-8-analytics-billing-and-hardening.md) | Measurement, money, and the compliance tail |

## Status

| Shard | Source |
|---|---|
| [checklist-results.md](./checklist-results.md) | §7 — the PM's own checklist |
| [open-questions.md](./open-questions.md) | §8 — six open, owners assigned |
| [next-steps.md](./next-steps.md) | §9 — agent prompts |

> [!warning] Two of the six open questions gate epics
> Question 7 (the recall@8 bar) gates **Epic 5**, and question 1 (the auto-send default) gates **Epic 6**. Neither blocks Epics 1–4, so the dev cycle can start — but they need owners before Epic 4 closes. See [open-questions.md](./open-questions.md).

---

Back to [Architecture shards](../architecture/index.md) · [Front-end spec shards](../front-end-spec/index.md)
