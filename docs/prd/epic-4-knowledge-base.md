> **Shard of [PRD](../../Email%20Engine%20PRD.md) §6 Epic 4.**
> Derived file — edit the source document and re-shard, never this copy.

### Epic 4 — Knowledge base

**Goal:** the tenant's own documentation becomes searchable, scoped, and citable. Retrieval quality is validated before any drafting depends on it.

---

**Story 4.1 — Knowledge source management**
*As an admin, I want to add our documentation, so that the bot answers from our content rather than guessing.*

1. Sources can be created as URL, uploaded file (PDF, DOCX, MD, TXT, HTML), pasted text, or FAQ pair.
2. `kb_sources` and `kb_chunks` tables exist with RLS policies and the `vector(1536)` column.
3. Sources list shows title, type, status, chunk count, and last indexed time.
4. A source can be deleted, cascading to its chunks and removing embeddings.
5. Upload validates size and type before storage and reports rejection reasons clearly.

---

**Story 4.2 — Extraction and chunking**
*As a developer, I want documents split into retrievable units, so that retrieval returns focused context.*

1. Text is extracted from each supported format, preserving heading structure where available.
2. Chunks target ~500 tokens with ~15% overlap and do not split mid-heading-section.
3. Token counts are recorded per chunk.
4. Extraction failures set an error status with a readable message rather than leaving the source pending.
5. A fixture corpus of messy real-world documents chunks without crashing or producing empty chunks.

---

**Story 4.3 — Embedding and indexing workflow**
*As an admin, I want indexing to happen reliably in the background, so that adding a large document doesn't block me.*

1. Indexing runs as a durable workflow with per-step checkpoints.
2. Embeddings are generated in batches through the AI Gateway and written with their chunks.
3. Indexing status and progress are visible in the UI and update as the workflow proceeds.
4. A failed embedding batch retries without re-extracting or re-chunking.
5. Re-indexing skips chunks whose content hash is unchanged.

---

**Story 4.4 — Hybrid retrieval**
*As a developer, I want retrieval that handles both paraphrase and exact terms, so that product names and error codes are findable.*

1. Semantic search uses an HNSW index on cosine distance; keyword search uses a GIN index on `tsvector`.
2. Results are merged with Reciprocal Rank Fusion and trimmed to a token budget.
3. Results are tenant-scoped by RLS with no `tenant_id` predicate in the query.
4. Retrieval returns in under 150ms at p95 with 5,000 chunks per tenant.
5. A labeled relevance set achieves the agreed recall@8 target before Epic 5 begins.

---

**Story 4.5 — Knowledge search UI**
*As an admin, I want to search the knowledge base myself, so that I can tell whether the bot will find the right answer.*

1. A search box returns ranked chunks with content preview, source, and score.
2. Each result links to its source and shows why it matched (semantic, keyword, or both).
3. Zero-result queries suggest what to add.
4. Nightly re-index runs on a cron and reports changes.
5. Admins can trigger re-index of a single source on demand.

---
