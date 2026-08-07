> **Shard of [Architecture](../../Email%20Engine%20Architecture.md) §13.**
> Derived file — edit the source document and re-shard, never this copy.

## 13. Security and performance

### 13.1 Security

| Control | Implementation |
|---|---|
| Tenant isolation | Postgres RLS, forced, app role without `BYPASSRLS`; transaction-local `app.tenant_id` |
| Authn | Clerk sessions (dashboard), hashed API keys (public API) |
| Authz | `requireRole()` on every mutation; roles `owner/admin/agent/viewer` |
| Secrets at rest | Mailbox OAuth tokens AES-256-GCM encrypted; key never in the DB |
| Webhook verification | Provider HMAC + timestamp tolerance before any parsing work |
| Email HTML | `mailparser` → DOMPurify allow-list → rendered in a sandboxed iframe with a strict CSP; remote images proxied and off by default |
| Prompt injection | Retrieved KB text, inbound email bodies, **and tenant action responses** are wrapped in delimited untrusted blocks; the system prompt states tool use is never authorized by message content; `call_tenant_webhook` takes a **registered subscription identifier, never a URL parameter**, so no model-supplied host can reach it. *(Third channel added 2026-08-07, Story 7.4: a tenant's own endpoint returns whatever their order system returns, which contains whatever a customer typed into a shipping-address field. Story 7.4 AC5's schema validation constrains the response's **shape** and says nothing about its **content** — a valid string field can carry an instruction. NFR14's threat model already covered "retrieved documents"; this row did not.)* |
| Attachments | Size cap, type allow-list, true-type check against magic bytes, download-only from a non-app origin. **No malware scanning in MVP** — see §13.3 |
| Knowledge sources | *(added 2026-08-06, Story 4.1.)* Uploads reuse FR57's magic-byte true-type check and executable refusal — **the same helper, not a second implementation.** URL sources fetch `http`/`https` only, refuse loopback, link-local and RFC-1918 hosts **re-checked after every redirect**, under size and time caps, and never echo the fetched response into an error an admin can read. This is the one file path in the product that is *parsed* rather than stored — see §13.3 |
| Rate limiting | Upstash sliding window: per API key, per IP on webhooks, per tenant on AI calls. **Three limits, one rule — see below** |
| Data deletion window | *(added 2026-08-07, Story 8.4.)* `tenants.deleted_at` records when deletion was **requested**; `tenantsDueForBlobPurge` selects only on `deleted_at + 30 days < now()` and refuses to run above a sanity threshold (§12). A **tenant-deletion record outside tenant scope** survives the cascade, because "prove you deleted them" cannot be answered by evidence that was deleted with them (§6.7c) |
| Audit | Append-only `audit_events`; no `UPDATE`/`DELETE` grant to `app_user` |
| Headers | CSP, HSTS, `X-Content-Type-Options`, `Referrer-Policy` via `next.config.ts` |
| Data deletion | Tenant delete cascades; blob purge job (**`/api/cron/purge-blobs`**, declared in §12 as of 2026-08-05 — it was specified here and scheduled nowhere); 30-day soft-delete window |
| Compliance posture | GDPR export/erase endpoints, per-tenant data-region setting, DPA-ready audit trail |

> [!important] Three limits, one rule: degrade the AI, never the mail *(ruled 2026-08-07)*
> Three separate mechanisms restrict a tenant, and each was specified in a different story with its own over-limit behaviour: the **API rate limit** (Story 7.3), the **per-tenant AI rate limit** (Story 5.4, moved there from 7.3), and the **plan message limit** (Story 8.2 AC5).
>
> Only the first has an HTTP caller to reject. The other two fire on **inbound mail arriving** — there is no client waiting, and the "caller" is a customer who emailed support. **Rejecting there drops their mail**, which NFR18 and NFR19 both forbid, on the tenant's busiest day or over a billing state.
>
> **The rule is the same in all three cases and is written once here because it was being rediscovered per story:** mail is always received, threaded, and made visible. What degrades is the **AI** work — drafting pauses, the conversation appears with a stated reason in the timeline, and owners and admins get one deduplicated notice (FR56).
>
> **And the reasons must be distinguishable sentences**, not a shared "limit reached": *"you are over your plan's limit"*, *"you are sending faster than your plan allows"* and *"our model provider is down"* lead to three different actions. NFR23's "actionable" test is exactly this distinction, and Story 6.5 drew the same one for delivery failures.

### 13.2 Performance targets

| Metric | Target |
|---|---|
| Dashboard LCP | < 1.8s p75 |
| Inbox interaction (INP) | < 200ms p75 |
| Conversation open (server) | < 300ms p95 |
| Ingest → draft ready | < 30s p95 |
| Chat first token | < 1.5s p95 |
| Hybrid retrieval | < 150ms p95 |
| Client JS (dashboard) | < 200KB gzipped |

**Levers:** partial index on the outbox; leading-`tenant_id` composite indexes; HNSW tuned after real volume; Suspense streaming so the shell paints before tenant data lands; `next/image` for avatars and logos; `next/font` self-hosted; Fluid Compute so a streaming AI request doesn't hold a whole instance; Gateway-level model routing to a smaller tier for classification.

### 13.3 Ruling on PO finding F5 — attachment malware scanning (2026-08-04)

[PO validation](./docs/po-validation-2026-08-03.md) F5: `attachments.scan_status` exists and defaults to `'pending'`, PRD §8 question 5 names a vendor decision gating Epic 2, and §13.1 above promised "malware scan before the blob URL is ever surfaced" — while **no FR required it and no story built it**.

The table promising a control that does not exist is worse than the gap. §13.1 is what a buyer's security reviewer reads.

**Ruling: no malware scanning in MVP. Ship containment instead, and say so plainly.**

**Why not scan.** Every available approach conflicts with a requirement this project already holds:

| Approach | Conflict |
|---|---|
| Self-hosted ClamAV | **NFR25** — "no self-managed infrastructure". This is the requirement that settled [F1](#68-ruling-on-po-finding-f1--which-database-is-the-target-2026-08-03) one day ago; re-introducing a box to patch would repeat the mistake deliberately |
| Third-party scanning API (VirusTotal, Cloudmersive, …) | Uploads customers' attachments — invoices, contracts, screenshots of account data — to a **fourth** party. NFR21's GDPR posture and PRD §1.1's "sold into security-reviewed accounts" both get *worse*. "We forward your customers' files to a scanning vendor" fails a security review harder than "we don't scan, and here is why we don't need to" |
| Cloud-provider scanning (S3/GCS native) | Requires leaving Vercel Blob, so a storage migration and a second vendor for one feature |

**Why the residual risk is narrow.** The attachment never executes anywhere we control:

- It is **never rendered inline** — download only, from Vercel Blob, a different origin to the app.
- It is **never parsed by the AI.** §6.4's retrieval reads `kb_chunks`; the agent's tools do not open attachments. No attachment becomes a `kb_chunk`, so there is no deserialization path from an *emailed* file into the model.

  > **Scoped 2026-08-06, drafting Story 4.1.** This bullet previously ended "there is no deserialization path from a hostile file into the model" with no qualifier, which read as a property of the system. It is a property of the **attachment** path, and it stays true. Epic 4 builds a second file path deliberately — an uploaded PDF *is* fetched, parsed, and turned into retrievable context the agent reads — with its own controls in Story 4.1 rather than this exemption. Left absolute, the sentence stops being true the day 4.1 merges, in the table a buyer's security reviewer reads.
  >
  > The two paths differ in threat, not just in plumbing: an admin uploading their own handbook is not a stranger emailing an executable. **But Story 4.1's URL source type is not admin-authored content at all** — it is a server-side fetch of an address the tenant names, landing in the same extractor — so that mitigation covers one of the two source types and not the other. NFR14 already places "retrieved documents" inside the threat model; this bullet is where the architecture had them outside it.
- It reaches **only the tenant's own agents**, never third parties, and only via a signed expiring URL.

What remains is an agent choosing to download and open a file a stranger emailed them — which is true of the mailbox they already have, with or without this product. **Detection is not what protects them; containment and honest labelling are.** Those cost nothing.

**What ships instead (PRD FR57):**

1. **True type from magic bytes**, not the claimed MIME or extension. The UI shows what the file *is*, so `invoice.pdf.exe` displays as an executable.
2. **Executable types are refused at ingest**, not merely warned about — extending the allow-list Story 2.5 AC5 already builds.
3. **`Content-Disposition: attachment`** plus `X-Content-Type-Options: nosniff` on every blob URL. Nothing renders in the browser, ever.
4. **`scan_status` tells the truth.** Default becomes `'not_scanned'`, not `'pending'` — a default of `'pending'` claims a queue exists. States: `not_scanned | clean | infected | failed`.
5. **The UI says it.** The download affordance states attachments are not scanned. A tenant who needs scanning learns it before trusting us, not after.

**Post-MVP re-entry is designed, not hoped for.** The states above already cover a scanner, and the rule when one arrives is fixed: **the blob URL is withheld until `clean`.** No schema change will be needed — only a workflow step between upload and surfacing.

**Schema note.** The `'pending'` → `'not_scanned'` default correction needs no hand-written migration. `attachments` holds no rows on any instance, and Neon has no schema yet, so this lands in the Drizzle schema in Story 1.2 alongside the table definition (§6.9).

**Closes** PRD §8 question 5 and §17's "attachment scanning vendor" decision. Neither was answerable as posed — both asked *which vendor*, and the answer is *none, and here is what we do instead*.

---
