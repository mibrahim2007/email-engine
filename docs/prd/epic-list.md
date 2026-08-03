> **Shard of [PRD](../../Email%20Engine%20PRD.md) §5–§6 preamble.**
> Derived file — edit the source document and re-shard, never this copy.

## 5. Epic list

Each epic ends with something deployable and demonstrable. Sequencing is deliberate: tenancy before data, ingest before UI, UI before AI, AI before automation. No epic depends on a later one.

| # | Epic | Ends with |
|---|---|---|
| **1** | Foundation and tenancy | Two orgs sign up and provably cannot see each other's data |
| **2** | Mailbox connection and ingest | Connected mailbox's email appears in the app within 2 minutes |
| **3** | Inbox UI | A human can work the inbox end-to-end without any AI |
| **4** | Knowledge base | KB search returns relevant, tenant-scoped, scored chunks |
| **5** | AI reply engine | Every inbound email gets a reviewable, cited draft |
| **6** | Sending and automation | High-confidence replies send themselves; the rest wait |
| **7** | Public API and webhooks | A customer can drive the platform without the UI |
| **8** | Analytics, billing, hardening | The product can take money and be operated |

---

## 6. Epic details

> Story format: `As a <role>, I want <capability>, so that <benefit>.` Acceptance criteria are testable and numbered. The SM expands each story into a self-contained story file with the relevant architecture excerpts embedded.

