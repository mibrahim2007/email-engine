> **Shard of [PRD](../../Email%20Engine%20PRD.md) §9.**
> Derived file — edit the source document and re-shard, never this copy.

## 9. Next steps

**UX Expert prompt** — ✅ done 2026-08-03, [[Email Engine Front-End Spec]] v1.0

> Using this PRD — particularly §3 (UI design goals) and Epics 3, 5, and 6 — produce `docs/front-end-spec.md`. Prioritize the conversation-plus-draft-review screen: it is the product's core loop and must make reviewing faster than writing. Specify the confidence and citation affordances precisely, including their non-color accessibility treatment. Map every screen to shadcn/ui primitives and note where a custom composite is required.

Delivered against all four asks. Because it was written *after* the architecture, it conforms to Architecture §9 rather than driving it, and surfaces five deltas the Architect must rule on before Epic 3 stories are drafted — see Front-End Spec §14. Open question 6 is resolved there.

**Architect prompt**

> [[Email Engine Architecture]] v1.0 already exists and was written against this PRD. Re-validate it against the final FR/NFR list, resolve open questions 2, 5, and 7, and confirm every epic in §5 has the technical foundations it needs in the epic that precedes it. Then shard the architecture into `docs/architecture/` per its §1.3.

**PO prompt**

> Run the master checklist against this PRD and the architecture. Confirm the sequencing holds, then shard both documents and hand Epic 1 Story 1.1 to the SM.

---

