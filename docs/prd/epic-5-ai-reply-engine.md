> **Shard of [PRD](../../Email%20Engine%20PRD.md) §6 Epic 5.**
> Derived file — edit the source document and re-shard, never this copy.

### Epic 5 — AI reply engine

**Goal:** every inbound email gets a grounded, cited, reviewable draft. Nothing sends automatically yet — this epic is about draft quality and the supervision surface.

---

**Story 5.1 — Classification**
*As an agent, I want incoming mail categorized, so that I can prioritize and the system can route.*

1. Every inbound message is classified into intent, sentiment, urgency, language, PII detected, and requires-human.
2. Classification uses structured output with a validated schema and runs on a fast model tier.
3. Results are persisted on the conversation and shown as badges in the inbox.
4. Classification failure marks the message for human handling rather than blocking the pipeline.
5. Accuracy against a labeled set meets the agreed threshold before drafting is enabled.

---

**Story 5.2 — Agent and tools**
*As a developer, I want a tool-calling agent, so that replies can use knowledge and data rather than only the prompt.*

1. The agent exposes `search_knowledge_base`, `lookup_customer`, `call_tenant_webhook`, and `escalate_to_human`.
2. The loop is capped at 8 tool steps and 60 seconds of wall clock.
3. All model access goes through Vercel AI Gateway; no provider SDK is present in the dependency tree.
4. Tool inputs and outputs are recorded for every run.
5. Exceeding a cap ends the run cleanly with an escalation, not a partial or hung draft.

---

**Story 5.3 — Draft generation with citations**
*As an agent, I want a draft with its sources, so that I can verify it in seconds instead of re-researching.*

1. Drafts are generated for classified messages that do not require a human.
2. Each draft records body text and HTML, confidence, citations, model, and tool calls.
3. Every factual claim maps to a retrieved chunk; ungrounded claims lower the confidence.
4. The draft respects the tenant persona — tone, formality, prohibited topics, disclaimers.
5. Drafts appear within 30 seconds of message arrival at p95.

---

**Story 5.4 — Escalation rules**
*As a support lead, I want the bot to know when to stop, so that it never handles something it shouldn't.*

1. Escalation triggers on unsupported language, PII above threshold, strong negative sentiment, low confidence, and explicit human requests.
2. An escalated conversation is flagged, sorted up, and raises an in-app notification (FR55). *(Amended 2026-08-03: previously "optionally notifies a channel", which implied a Slack integration no story built. A tenant wanting a channel uses the signed `conversation.escalated` webhook from FR48 — see §1.5.)*
3. The escalation reason is stated in one plain sentence in the conversation timeline.
4. Admins can configure which triggers are active and their thresholds.
5. Escalation precision against a labeled set meets the agreed threshold.

---

**Story 5.5 — Draft review panel**
*As an agent, I want to review and act on a draft quickly, so that reviewing is faster than writing.*

1. The panel shows the draft in an editable composer with confidence displayed as a number and a label, not color alone.
2. Citations are inspectable via hover-card showing the source chunk and a link.
3. Approve, edit-and-send, regenerate, and reject are single actions; `⌘Enter` sends.
4. Every outcome is recorded with the actor, the final body, and the edit distance from the original.
5. Regenerate produces a new draft with the prior one retained in history.

---

**Story 5.6 — Persona settings and playground**
*As an admin, I want to shape and test the bot's voice, so that I trust it before it speaks for us.*

1. Persona settings cover tone, formality, signature, prohibited topics, and standard disclaimers.
2. The playground streams responses using the identical agent, tools, and knowledge as production.
3. The tool-call trace is visible per response, including retrieved chunks and scores.
4. Persona changes take effect in the playground immediately without a deploy.
5. A prompt-injection corpus in the playground produces no unauthorized tool call and no data disclosure.

---

