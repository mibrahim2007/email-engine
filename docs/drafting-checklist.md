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

### ☐ Read every acceptance criterion for a race

An AC phrased as a rule is often a concurrency requirement wearing a validation costume.

> **Story 1.5 AC4** — "the last remaining owner cannot be removed" implemented as a count check lets two admins each demote a different owner and leave zero.
> **Front-End Spec §5.1** — send-undo cancelling a `pending` outbox row races a drain that runs every 30 seconds.

Ask: *what happens if two of these arrive at once?* And note that a unique index enforces **at most one**, never **at least one**.

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

### ☐ "Whichever ships first" is not an owner

> **SB-2** — Stories 1.3 and 1.4 both needed one lint rule amended. The failure mode is quiet: the second story hits it under time pressure and the cheapest fix is to loosen the rule rather than add one permitted path.

---

## When reviewing or amending an artifact

### ☐ Verify an absence before designing around it

Absence is the claim that goes stale fastest, because products only add.

> **AI-1 and AI-3** — I raised three findings against the architecture from a curated summary; checking the live documentation dissolved two. Had they landed, Epic 4 would have carried a provider-SDK carve-out it never needed.
> **Stories 1.4–1.6** — I claimed three times they would need invented specifics. All three were fully derivable.

### ☐ The word "every" is where the exception hides

> **§10.2** — "*Every* repository function takes a `tx` from `withTenant`", and §10.3 forty lines later calls the query that determines the tenant, which cannot. Worse: the bootstrap lookup was blocked by the very policy it precedes, so every login would have failed closed.

### ☐ Constrain the exception; do not merely document it

> `allowBuilds` naming three postinstall scripts · the `region` single-value `CHECK` · `minimumReleaseAgeStrict` · `system.ts` with exactly two permitted exports **and a test asserting that surface**.

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
