> **Shard of [Front-End Spec](../../Email%20Engine%20Front-End%20Spec.md) §9.**
> Derived file — edit the source document and re-shard, never this copy.

## 9. States, loading, and errors

Every screen specifies four states. Defaults are not acceptable (Story 3.1 AC4).

| State | Rule |
|---|---|
| **Loading** | Skeletons matching final layout dimensions — never a centred spinner. RSC streams the shell; Suspense boundaries wrap list and draft separately, so a slow draft never delays the thread |
| **Empty** | Says what it is, why, and the one action that changes it. "No conversations yet — connect a mailbox to start receiving mail" |
| **Error** | Plain cause + a retry that retries *that thing*, not the page. Never a raw error code to an agent; a correlation id behind a disclosure for support |
| **Partial** | The common real case: thread loaded, draft still generating. Both render; the draft shows elapsed seconds. Never block the thread on the draft |

**Optimistic mutation failure** (Story 3.4 AC3): the row reverts with a visible animation and a toast stating what failed and why. A silent revert is worse than no optimism — the agent believes the change landed.

---
