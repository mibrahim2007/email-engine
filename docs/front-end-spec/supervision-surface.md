> **Shard of [Front-End Spec](../../Email%20Engine%20Front-End%20Spec.md) §4.**
> Derived file — edit the source document and re-shard, never this copy.

## 4. The supervision surface

The PRD's UX prompt calls for these to be specified "precisely, including their non-color accessibility treatment". This section is normative.

### 4.1 Confidence — the `ConfidenceMeter` composite

Story 5.5 AC1 requires "a number and a label, not color alone". The spec goes further: **four redundant encodings**, any one of which is sufficient to read the value.

> [!important] What the number means — settled 2026-08-07 (PRD §8 Q10)
> `confidence` is **computed groundedness**, not the model's opinion of itself: the fraction of the reply's factual sentences carrying a citation that resolves to a chunk actually retrieved for this draft. [[Email Engine Architecture]] §10.4 has the ruling.
>
> **So the meter must not imply a probability of being right.** Groundedness is *provenance*, not truth — a reply can be perfectly cited to a chunk that is out of date. The label says what was measured and lets the agent draw the conclusion: **"84% of this reply's factual sentences are backed by a source you can click."**
>
> That sentence is also what makes §5.3's auto-send dialog honest. Under a self-report its second half would have read *"84 drafts the model felt good about"* — which should stop a support lead from arming auto-send, correctly.

```
●●●○  87 · Moderate        ▏0.90
└─┬┘  └┬┘   └───┬───┘      └──┬──┘
  │    │        │             threshold marker
  │    │        └─ word label
  │    └─ numeral, always present
  └─ filled segments — shape, works in greyscale
```

| Band | Segments | Numeral | Label | Colour (redundant) |
|---|---|---|---|---|
| ≥ 90 | ●●●● | 90–100 | High | `--color-primary` |
| 75–89 | ●●●○ | 75–89 | Moderate | `--color-primary` at 60% |
| 60–74 | ●●○○ | 60–74 | Low | `--color-muted-foreground` |
| < 60 | — | — | — | never drafted; escalates (Story 5.4 AC1) |
| **`NULL`** | — | — | **No factual claims to check** | `--color-muted-foreground` |

**`NULL` is a real state, not missing data** *(added 2026-08-07)*. A reply that makes no factual claims — *"I've passed this to a colleague"* — has no groundedness to report, so the denominator is zero. It renders as its own label and **never as `0`**, which would read as *badly* grounded and be wrong. It never auto-sends (Story 6.3) and it escalates (Story 5.4): the safe reading of *no signal* is human review, not a pass.

**The threshold marker is the trust-building device.** A thin tick on the meter shows where the tenant's auto-send threshold sits relative to this draft. Over weeks the agent watches drafts land above a line that is not yet armed — which is what makes moving the threshold an informed act rather than a leap of faith (PRD §3.1). It renders even when auto-send is off; especially then.

**Accessibility:**
- `role="meter"`, `aria-valuenow="87"`, `aria-valuemin="0"`, `aria-valuemax="100"`, `aria-label="87% of this reply's factual sentences are backed by a cited source. Moderate. Auto-send threshold 90%."` *(Reworded 2026-08-07: "Draft confidence 87 of 100" named a quantity the number is not — see the callout above.)*
- Segments are `aria-hidden` — decorative duplication of the numeral.
- Contrast ≥ 4.5:1 on all four bands in both themes. Verified against the §9.2 `oklch` tokens, not assumed.
- Never the sole content of a table cell or list row.

### 4.2 Citations — the `CitationPopover` composite

Story 5.5 AC2 asks for a hover-card. **A hover-card alone fails WCAG 2.1 AA** — hover is not a keyboard or touch affordance, and NFR24 is not optional.

The spec: each cited claim carries a superscript marker rendered as a **`<button>`**, not a `<span>`.

| Input | Behaviour |
|---|---|
| Hover (pointer) | Popover after 300ms, dismiss on exit + 150ms grace |
| Focus (keyboard) | Popover on focus; `Esc` closes and returns focus to the marker |
| `Enter` / `Space` | Pins the popover open until dismissed |
| Tap (touch) | Bottom sheet, not a popover — thumb-reachable |

Popover contents, in order: **source title** → **the chunk excerpt with the matched span emphasised** → **retrieval score** → **link to the source in `/knowledge`**.

The excerpt is the point. A citation that shows only a document title asks the agent to trust a filename; showing the actual sentence lets them verify in about a second, which is the §1 rule-1 budget.

Markers are numbered per draft (`¹ ² ³`) and repeated in a footnote row beneath the composer, so the citation set is legible without any hovering at all.

> **⚠ Architecture delta 2 — ✅ accepted, and taken further.** §9.2 mapped draft review to `hover-card`, which is pointer-only by design in Radix. Architecture §9.5 accepts `popover` + `sheet` **and drops `hover-card` entirely**: a single `popover` with a hover-intent trigger serves hover, focus, and click through one code path, where maintaining both would let the accessible path drift out of sync with the one people use daily.

### 4.3 Tool trace — the `ToolCallTrace` composite

One collapsed line: `▸ 3 tool calls · gpt-… · 4.2s`. Expanded, a vertical list of steps, each showing tool name, input summary, output summary, duration, and — for `search_knowledge_base` — the chunks with scores (Story 5.6 AC3).

Collapsed by default in the conversation. **Expanded by default in the playground**, where inspecting the machinery *is* the task.

### 4.4 What is deliberately absent

No streaming token animation on the draft. The draft is complete before the agent sees it — it was generated by a background workflow up to 30 seconds earlier (NFR3), not on open. Animating it in would be theatre that costs review time. Streaming belongs in the playground, where the wait is real.

---
