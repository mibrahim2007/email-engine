> **Shards of [Email Engine Architecture.md](../../Email%20Engine%20Architecture.md).**
> Derived files — edit the source document and re-shard, never these copies.

# Architecture shards

Sharded per Architecture §1.3 on 2026-08-03 by the PO. Each file is an exact slice of the source; nothing was rewritten.

> **Regenerate with `python scripts/reshard.py`** after editing any source document. It derives every boundary from the headings, checks the slices are contiguous, and fails loudly on a gap or overlap. Hand-slicing by line number drifts the moment a section is added — it dropped a section heading twice on 2026-08-04 before the script existed.

## Always loaded by the Dev agent

These three enter every Dev context via `devLoadAlwaysFiles` in `.bmad-core/core-config.yaml`. Keep them lean.

| Shard | Source | Lines |
|---|---|---|
| [tech-stack.md](./tech-stack.md) | §3 | 44 |
| [source-tree.md](./source-tree.md) | §11 | 38 |
| [coding-standards.md](./coding-standards.md) | §15 | 22 |

## Loaded per story, as the story requires

| Shard | Source | Covers |
|---|---|---|
| [high-level-architecture.md](./high-level-architecture.md) | §2 | Technical summary, platform choice, repo structure, system diagram, patterns |
| [components.md](./components.md) | §4 | The ten services and their boundaries |
| [data-models.md](./data-models.md) | §5 | Entities and their relationships |
| [database-schema.md](./database-schema.md) | §6 | DDL, indexes, RLS, hybrid retrieval, as-built, pending changes |
| [rest-api-spec.md](./rest-api-spec.md) | §7 | Public REST surface |
| [core-workflows.md](./core-workflows.md) | §8 | Inbound → reply, outbound send, KB indexing, onboarding |
| [frontend-architecture.md](./frontend-architecture.md) | §9 | Routes, shadcn/Tailwind, state, rendering, **§9.5 delta rulings** |
| [backend-architecture.md](./backend-architecture.md) | §10 | Functions, tenant-scoped session, auth, the agent, errors |
| [deployment.md](./deployment.md) | §12 | Environments, pipeline, cron |
| [security-and-performance.md](./security-and-performance.md) | §13 | Security controls and performance targets |
| [testing-strategy.md](./testing-strategy.md) | §14 | The pyramid and the seven non-negotiable tests |

## Deliberately not sharded

| Source | Why |
|---|---|
| §1 — BMAD method | Process, not implementation. The Dev agent never needs it |
| §16 — Epics and stories | Duplicates [PRD §6](../prd/), which is sharded per epic. One source, not two |
| §17 — Open decisions | Duplicates [PRD §8](../prd/open-questions.md), which is the owned list |

> [!note] Two shards §1.3 did not plan for
> The sharding plan in §1.3 lists twelve files and omits **§2 (high-level architecture)** and **§12 (deployment)**. Both are referenced by shards that *are* in the plan, so a Dev agent following a story into `frontend-architecture.md` or `backend-architecture.md` would hit a dead link. Added; §1.3 should be amended to list fourteen.

---

Back to [PRD shards](../prd/index.md) · [Front-end spec shards](../front-end-spec/index.md)
