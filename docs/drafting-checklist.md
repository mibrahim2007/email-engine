# Drafting and review checklist

**Every check here found a real defect on this project.** Nothing is included because it sounds prudent. Each entry names the finding that earned it, so a future reader can judge whether it still applies.

Run the story checks when drafting; run the epic checks once an epic's stories are all drafted; run the artifact checks after any run of amendments.

---

## When drafting a story

### ☐ If more than two stories describe a thing, ask which one *builds* it

Describing something repeatedly creates a strong feeling that it exists.

> **F3** — four epics had an acceptance criterion that "notifies" someone; no story built a notification channel.
> **F8** — three stories wrote audit events; no story built the audit write path.
> **SB-1** — five stories described `users` as "a mirror of Clerk identity"; nothing mirrored anything, leaving FR3 delivered against a table nothing populates.

The question that catches it: **whose definition of done covers this?**

**And the answer must be a story, never a document.** NFR1 and NFR6 were closed by citing Front-End Spec §12, which specifies the budgets and measures nothing — so the requirement read as covered while `ci.yml` ran no size check at all. **A section number is a citation, not an owner**, and this one was introduced while resolving a finding of precisely this shape.

### ☐ Read every acceptance criterion for a race

An AC phrased as a rule is often a concurrency requirement wearing a validation costume.

> **Story 1.5 AC4** — "the last remaining owner cannot be removed" implemented as a count check lets two admins each demote a different owner and leave zero.
> **Front-End Spec §5.1** — send-undo cancelling a `pending` outbox row races a drain that runs every 30 seconds.

Ask: *what happens if two of these arrive at once?* And note that a unique index enforces **at most one**, never **at least one** — Story 5.5's partial index on live drafts is the case where that is exactly the tool, and Story 1.5's last-owner rule is the case where it is useless.

**The sibling shape: a value that a later, individually-correct write may lower is a state machine, not a field.**

> **Story 5.1** — classification runs per message and `conversations` holds one `requires_human`. Message 2 is angry and escalates; message 3 says "never mind, thanks" and its classification writes the flag back to false. **The conversation silently leaves the escalation queue and nobody ever read message 2** — worse the more polite the customer is. `requires_human` is a latch: a classifier may raise it, only a human may clear it.

Third instance, after the last-owner rule and the send-undo race. The tell is a field written by more than one event where one of those events means *something must happen*.

### ☐ A threshold that exists and is not cited behaves like one that does not exist

The reverse of the citation trap, and it costs a story an open question it does not need.

> **Story 5.4 AC5** — "escalation precision meets the agreed threshold". It **was** agreed: PRD §1.4 sets ≥ 85%. Three sections away, in a success-metrics table nobody drafting a story would open, so the AC reads as blocked on a decision already made.
> **Story 5.1 AC5** — identical wording, and that one genuinely has no number anywhere. Same sentence, opposite problems.

Before raising an open question, grep the success metrics. And when a bar exists, check it is the *right* bar: **precision alone is optimised by flagging nothing**, so 5.4 reports recall beside it — the failure that story prevents is a *missed* escalation, which precision cannot see.

### ☐ Distinguish presentation from enforcement

An AC written in UI language can quietly become the whole implementation.

> **Story 1.6 AC5** — "navigation items reflect the current user's role". Hiding the billing link is usability; the page is one typed URL away. The test is direct navigation returning 403, not link absence.

### ☐ Decide which side of the commit each effect belongs on

> **Story 1.5** — `audit()` writes *inside* the caller's transaction; a separately-committed audit row can record a change that rolled back.
> **Story 1.7** — the notification email dispatches *after* commit; an email cannot be rolled back, so sending it inside means telling someone about something that never happened.

Same principle, opposite mechanisms. Ask it per effect, not per story.

### ☐ Name what the story must **not** rebuild

> **Story 1.3** — five of its six original criteria had already shipped. Left as written, a Dev agent would have rebuilt working, tested infrastructure.

### ☐ Check the story's own ACs against its scope

> **Story 1.2** — ACs appended while resolving three findings named tables that Epics 2 and 4 create. Correct instructions, wrong story. **Resolving a finding by appending an AC somewhere plausible is how scope inflates.**

### ☐ Ask what a success state looks like when it contains nothing

Error handling gets designed. **The empty success does not, because no layer thinks it failed.**

> **Story 4.2** — a scanned PDF extracts to `""`, chunks to `[]`, and completes: `status = 'indexed'`, chunk count 0, green badge. The admin concludes the bot knows the handbook. Every layer behaved correctly.
> **Story 4.3** — a crash between `DELETE` and `INSERT` during re-index leaves a source that *worked yesterday* at zero chunks and still `indexed`. Retrieval returns less, RRF still returns something, drafts still generate with plausible confidence. **The product does not break, it quietly gets worse.**

The tell is a count that can legitimately be zero. Ask: *is zero here indistinguishable from "nothing to say"?* If so it needs its own terminal state, not a success badge — and any operation that replaces a populated set needs a refusal path, not just correct SQL.

### ☐ A control does not travel to a second path by itself

A rule gets written in the epic where somebody was looking at that kind of risk. It does not apply itself to the next path of the same kind, and the second path is often the more dangerous one.

> **Story 4.1** — FR57 gives emailed attachments magic-byte true-type checking and an executable refusal, hard-won through PO finding F5. Epic 4's file upload, which is **parsed** rather than merely stored, specified only "validates size and type". §13.3 justified not scanning attachments partly on there being "no deserialization path from a hostile file into the model" — an absolute that Epic 4 makes false.
> **Story 4.1 again** — §13.1 constrains `call_tenant_webhook` to a pre-registered URL because a model-supplied host is an SSRF. A knowledge source URL is free-form by design and fetched server-side, and no document mentions it.

Ask of any new path: *what is the nearest thing we already treat carefully, and does this get the same rule?* Then say whether it reuses the helper or reimplements it — a second implementation is a second thing to forget.

### ☐ State the prerequisites a Dev agent cannot satisfy

> **Story 1.1** — two of five ACs needed an interactive Vercel login and a GitHub repository setting. Written into the story as prerequisites with "mark it blocked, don't stub it", they were reported honestly instead of faked.

---

## When an epic's stories are all drafted

### ☐ Compare the stories to each other

Nothing else in the process does this. The PO gate compares planning documents; traceability compares requirements to stories; the consistency audit compares a document to itself.

> **SB-1, SB-2, SB-3** — all three came from this pass and none was visible to the other checks.

Look for: dangling references ("as in Story X" where X has no such thing), two stories amending the same file with neither owning it, and an ordering problem where a story needs a helper a later story builds.

### ☐ Compare this epic's *requirements* to the earlier epic's *design*

Distinct from the pass above, which compares stories within one epic. This one asks whether a model established earlier can actually carry what a later epic needs — and no pass that stays inside a single epic can see it.

> **The cron/RLS conflict.** §12 declares four crons; every one runs with no tenant while needing work belonging to all of them. `mailboxes` carries `USING (tenant_id = current_tenant_id())`, so `poll-mailboxes` would enumerate **zero rows and poll nothing, silently** — every tenant's mail simply stops arriving. The tenant-scoping model came from Epic 1; the crons come from Epics 2, 4, 6 and 8.
> **The undeclared jobs.** The same sweep found `blob purge job` specified in §13.1 and scheduled in no cron, so FR54 would have been met in the database and quietly unmet in storage.

Look for: anything that runs **without a request** (crons, workflows, jobs), anything that must act **before** the scoping context exists, and anything named in one section as a capability but never given a home in another.

### ☐ Ask which way a background job fails

> `poll-mailboxes` enumerating nothing means no mail arrives — **loud once noticed, and reversible.** `purge-blobs` enumerating wrongly means a live tenant's attachments are **deleted** — silent and not reversible.

Same mechanism, opposite blast radius. A job that deletes needs a sanity threshold and a refusal path; a job that reads needs an alert. **Deciding this per job is cheaper than discovering it per incident.**

### ☐ Read the acceptance criteria against the scale the NFRs specify

Criteria are written per tenant. **The NFRs are written for the whole system**, and a criterion that passes on one tenant's data can measure a different query entirely once the table holds five hundred.

> **Story 4.4.** AC1 (an HNSW index) and AC3 (RLS scoping, no `tenant_id` predicate) are each correct. Together, at NFR7's 500 tenants × 5,000 chunks, they are not: **filtering is applied after an approximate index is scanned**, so with `ef_search` at 40 and one tenant holding 0.2% of the table, the semantic half returns ~0 rows and **hybrid retrieval silently becomes keyword-only.** Nothing errors. FR29 reads as satisfied because both halves ran.
>
> **Worse, the performance criterion rewards it.** AC4's < 150ms is *easier* to hit with the expensive half returning nothing — and every criterion in the epic measures a single tenant, where that tenant is 100% of the table and the defect cannot exist. **It would ship green and degrade with every customer added.**

Two questions: *what fraction of this table belongs to one tenant at NFR-scale?* and *does any criterion here get easier when the feature stops working?* The second is the sharper one — a target that a failure satisfies is not measuring the thing it names.

And a general form worth keeping: **a correctness mechanism and a performance mechanism can each be right and compose into something that is neither.** The tell is a filter the query deliberately does not express — if the planner cannot see the predicate, no index can be chosen for it.

### ☐ A guarantee protects the table it is written on, and nothing above it

Check where the *duplicate* is created, not where the write is serialised.

> **Story 5.5 AC5.** Regenerate retains the prior draft, which was never approved or rejected, so it stays `proposed` — **two live drafts on one conversation.** FR42's auto-send drains `proposed` drafts above a threshold and finds both, so **the customer gets two replies.** Every exactly-once mechanism held: `outbound_messages` correctly sent each of two legitimate rows exactly once. The defect is one table upstream of the guarantee.

Ask: *what selects this row later, and can there be two of them?* The fix is usually a partial unique index, so the invariant is structural rather than a convention held in an `ORDER BY` that one repository function can omit.

### ☐ "Identical to production" is a hazard wherever production has side effects

A test surface asked to behave *exactly* like the real one inherits the real one's consequences, and the requirement's own wording is what makes a correct implementation dangerous.

> **Story 5.6 AC2** — the playground uses "the identical agent, tools, and knowledge as production". `call_tenant_webhook` is a tenant-registered action — *order status, **refund***. So an admin typing into a screen labelled "test your bot" can issue a real refund. **And AC5 requires running the prompt-injection corpus there**, so the suite proving the bot cannot be manipulated would fire live webhooks while proving it.

Split the tools by whether they *observe* or *act*, and put the difference **below** the layer the requirement is about — the agent, prompt, schemas, and trace stay identical; the dispatcher does not dispatch. Then mark each tool in a registry and **test that every side-effecting one is captured**, so the sixth tool cannot default to firing.

### ☐ "Whichever ships first" is not an owner

> **SB-2** — Stories 1.3 and 1.4 both needed one lint rule amended. The failure mode is quiet: the second story hits it under time pressure and the cheapest fix is to loosen the rule rather than add one permitted path.
> **`reindex-kb`** — §10.2 assigned the enumerator to Story 4.3, the PRD put the schedule in Story 4.5, and §12 declared the route naming no story. **One job, three documents, three owners** — and the piece that carries the `SECURITY DEFINER` escape hatch was the one nobody's story described.

A job is not owned until **the route, the schedule, and the query that finds its work** sit in one story. Splitting them is how the second story finds a half-built thing and does the cheap version.

---

## When reviewing or amending an artifact

### ☐ Verify an absence before designing around it

Absence is the claim that goes stale fastest, because products only add.

> **AI-1 and AI-3** — I raised three findings against the architecture from a curated summary; checking the live documentation dissolved two. Had they landed, Epic 4 would have carried a provider-SDK carve-out it never needed.
> **Stories 1.4–1.6** — I claimed three times they would need invented specifics. All three were fully derivable.

### ☐ The word "every" is where the exception hides

> **§10.2** — "*Every* repository function takes a `tx` from `withTenant`", and §10.3 forty lines later calls the query that determines the tenant, which cannot. Worse: the bootstrap lookup was blocked by the very policy it precedes, so every login would have failed closed.
> **§13.3** — "There is **no** deserialization path from a hostile file into the model." True of attachments, and stated with no scope, so it reads as a property of the system — in the table a buyer's security reviewer reads. Epic 4 builds that path deliberately. **An absolute does not need amending when it is written; it needs a scope, so a later epic makes it narrower instead of making it false.**

### ☐ Constrain the exception; do not merely document it

> `allowBuilds` naming three postinstall scripts · the `region` single-value `CHECK` · `minimumReleaseAgeStrict` · `system.ts` with an enumerable export list **and a test asserting that surface** · `purge-blobs` refusing to run above a sanity threshold.

A documented exception grows. A tested one has to be argued for.

### ☐ A default value can be a lie

> **§13.3** — `attachments.scan_status DEFAULT 'pending'` implied a queue that would never run. `'not_scanned'` costs the same and is true.
> **§6.8d** — `region` defaulting to `'us-east'` with nothing enforcing it, fixed with a `CHECK` listing only the region actually offered.

### ☐ Watch the guard fire

A rule nobody has seen fail is indistinguishable from a rule that does not work.

> The RLS coverage test got a negative control — a `tenant_id` table with no policy, inside a transaction that rolls back. The lint rules got one — a probe file breaking two standards. Both passed; neither was assumed.

### ☐ After a run of amendments, read the document against itself

> **The consistency audit** found six contradictions in the architecture: a section still calling a shipped migration "not yet written", a table promising a migration that a later section retired, and canonical DDL missing two columns that had been ruled elsewhere. **Amending a section is easy; noticing it invalidated a sentence three sections away is not.**

### ☐ A ruling invalidates memory as well as documents

> The `email-engine-db-access` memory still said the scratch box *was* the project database a day after that stopped being true. The tree was corrected; the store outside the tree was not, because nothing greps it.
