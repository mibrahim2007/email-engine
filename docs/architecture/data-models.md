> **Shard of [Architecture](../../Email%20Engine%20Architecture.md) §5.**
> Derived file — edit the source document and re-shard, never this copy.

## 5. Data models

Shared TypeScript types live in `packages/db/types.ts` and are imported by both the app and the workflows. Drizzle infers them from the schema — never hand-write a type that duplicates a table.

### Tenant
`id`, `name`, `slug`, `clerk_org_id`, `plan`, `status`, `settings` (jsonb: persona, tone, auto_send_threshold, business_hours, locale), `created_at`

### User / Membership
Clerk owns identity. `users` mirrors `clerk_user_id`, `email`, `name`, `avatar_url`. `memberships` joins user↔tenant with `role` ∈ `owner | admin | agent | viewer`. A user can belong to many tenants.

### Mailbox
`id`, `tenant_id`, `provider` ∈ `gmail | outlook | imap | inbound_webhook`, `address`, `display_name`, `credentials_encrypted`, `sync_cursor`, `sync_state`, `last_synced_at`, `is_active`

### Conversation
`id`, `tenant_id`, `mailbox_id`, `subject`, `thread_key`, `status` ∈ `open | pending | resolved | spam`, `assignee_id`, `contact_id`, `intent`, `sentiment`, `urgency`, `requires_human`, `last_message_at`, `first_response_at`, `resolved_at`

### Message
`id`, `tenant_id`, `conversation_id`, `direction` ∈ `inbound | outbound`, `provider_message_id`, `in_reply_to`, `references[]`, `from`, `to[]`, `cc[]`, `subject`, `body_text`, `body_html_sanitized`, `snippet`, `headers` (jsonb), `has_attachments`, `sent_at`, `received_at`

### Attachment
`id`, `tenant_id`, `message_id`, `filename`, `content_type`, `size_bytes`, `blob_url`, `checksum`, `scan_status`

### Contact
`id`, `tenant_id`, `email`, `name`, `company`, `custom_fields` (jsonb), `first_seen_at`, `last_seen_at`, `conversation_count`

### KnowledgeSource / KnowledgeChunk
Source: `id`, `tenant_id`, `type` ∈ `url | file | text | faq`, `title`, `uri`, `status`, `last_indexed_at`.
Chunk: `id`, `tenant_id`, `source_id`, `content`, `token_count`, `embedding vector(1536)`, `tsv tsvector`, `metadata` (jsonb).

### Draft
`id`, `tenant_id`, `conversation_id`, `body_text`, `body_html`, `confidence` (0–1), `citations` (jsonb[]), `model`, `tool_calls` (jsonb), `state` ∈ `proposed | approved | rejected | edited | auto_sent`, `reviewed_by`, `reviewed_at`

### OutboundMessage
`id`, `tenant_id`, `conversation_id`, `draft_id`, `state` ∈ `pending | claimed | sent | failed | dead | cancelled`, `attempt_count`, `last_error`, `provider_message_id`, `scheduled_for`, `sent_at`

`cancelled` supports send-undo (§9.5 delta 3, shipped in `0003`). Sends are enqueued with `scheduled_for = now() + <undo window>` so a cancel never races the §8.2 drain.

### AuditEvent
`id`, `tenant_id`, `actor_type` ∈ `user | system | agent`, `actor_id`, `action`, `entity_type`, `entity_id`, `metadata` (jsonb), `ip`, `created_at` — append-only, no update or delete grant.

### UsageRecord
`id`, `tenant_id`, `period`, `metric` ∈ `messages_processed | ai_replies | tokens_in | tokens_out`, `quantity`, `recorded_at` — feeds Stripe metered billing.

---
