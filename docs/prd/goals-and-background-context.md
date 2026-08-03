> **Shard of [PRD](../../Email%20Engine%20PRD.md) §1.**
> Derived file — edit the source document and re-shard, never this copy.

## 1. Goals and background context

### 1.1 Goals

- A support team connects a shared mailbox and sees AI-drafted, source-cited replies waiting for them within 30 seconds of an email arriving.
- Teams deflect at least 40% of routine email volume to fully automated replies without a measurable drop in customer satisfaction.
- A new tenant goes from signup to first AI draft in under 10 minutes, with no engineering involvement.
- Every automated reply is traceable — which knowledge chunks grounded it, which model produced it, who approved it.
- Tenant data isolation is provable, not asserted, so the product can be sold into security-reviewed accounts.

### 1.2 Background context

Support teams running shared mailboxes (`support@`, `billing@`, `orders@`) spend most of their day answering questions the company has already answered in writing. Existing helpdesks (Zendesk, Front, Help Scout) organize that work but don't reduce it; the AI features they've bolted on are macro-suggestion tools that don't read the company's own documentation. Meanwhile, generic AI chat widgets live on the website, not in the inbox — which is where B2B customers actually write.

Email Engine sits in the mailbox. It ingests every message, retrieves the tenant's own knowledge, drafts a grounded reply with citations, and either sends it or queues it for a human depending on a confidence threshold the tenant controls. The differentiator is not "AI writes emails" — it's the supervision surface: the human sees the confidence, the sources, and the tool calls, and can move the threshold as trust builds.

The wedge is teams of 3–20 handling 200–5,000 emails/month who have documentation but no capacity. They are too small for a Zendesk implementation project and too big for a shared Gmail inbox.

### 1.3 Target users

**Primary — Support lead ("Priya").** Runs a 4-person support team at a 60-person SaaS. Owns first-response-time and CSAT numbers. Wants volume reduced without her team losing visibility or the company sending something embarrassing. She is the buyer and the person who sets the auto-send threshold.

**Secondary — Support agent ("Marco").** Lives in the inbox 6 hours a day. Judges the product on whether the draft is good enough to send with one edit, and whether the keyboard shortcuts keep up with him. Will abandon it if reviewing drafts is slower than writing replies.

**Tertiary — Technical admin ("Dana").** Connects the mailbox, wires the order-lookup webhook, integrates the REST API with internal tooling. Needs the OAuth flow to work first try and the API to be boring.

### 1.4 Success metrics

| Metric | Target (90 days post-launch) |
|---|---|
| Deflection rate (auto-sent, no human touch, no follow-up complaint) | ≥ 40% of eligible conversations |
| Draft acceptance (sent with no edit or minor edit) | ≥ 70% |
| Median first-response time vs. tenant's pre-launch baseline | −60% |
| Time from signup to first AI draft | < 10 minutes p75 |
| Escalation precision (flagged for human *and* human agreed) | ≥ 85% |
| Weekly active agents / seats | ≥ 60% |
| Cross-tenant data incidents | 0 — non-negotiable |

### 1.5 MVP scope boundary

**In:** email ingest from Gmail/Outlook/IMAP/webhook, thread stitching, knowledge base, AI classification and drafting with citations, human review, auto-send with a threshold, outbound sending with correct threading, multi-user teams, public REST API, usage-based billing.

**Out (post-MVP, explicitly):**
- Live chat, SMS, WhatsApp, or social channels — email only.
- Full ticketing (SLAs, macros, custom workflows, CSAT surveys). This is a reply engine, not a helpdesk replacement.
- Multi-language reply generation beyond detect-and-escalate. Detection ships; non-English drafting does not.
- Voice/phone, mobile native apps, browser extension.
- Fine-tuning or per-tenant model training. Retrieval only.
- On-prem or BYO-cloud deployment.

### 1.6 Change log

| Date | Version | Change | Author |
|---|---|---|---|
| 2026-08-01 | 1.0 | Initial PRD | PM agent |

---

