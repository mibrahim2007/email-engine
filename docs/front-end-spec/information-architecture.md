> **Shard of [Front-End Spec](../../Email%20Engine%20Front-End%20Spec.md) §2.**
> Derived file — edit the source document and re-shard, never this copy.

## 2. Information architecture

### 2.1 Sitemap

```
(marketing)                        public, static
├── /                              landing
└── /pricing

(auth)
├── /sign-in                       Clerk
└── /sign-up                       Clerk → creates Organization

(app)                              Clerk-guarded, org-scoped
├── /onboarding                    3 steps, dismissible after first draft
├── /inbox                         ← default landing
│   └── /inbox/[conversationId]    the core loop
├── /knowledge
│   └── /knowledge/[sourceId]
├── /playground
├── /analytics
└── /settings
    ├── /mailboxes
    ├── /persona                   includes the auto-send threshold
    ├── /team
    ├── /api-keys
    └── /billing
```

Matches Architecture §9.1 exactly. `/onboarding` is the one addition.

> **⚠ Architecture delta 1 — ✅ accepted** (Architecture §9.5). `app/(app)/onboarding/page.tsx`, with the `(app)` layout's auth check already covering it. One amendment: the "no mailbox connected → onboarding" redirect goes in `inbox/page.tsx`, **not** the layout — a layout check would add a mailbox-count query to every authenticated request in the product, to serve a redirect that only matters on the landing route.

### 2.2 Navigation

**Primary — persistent left sidebar, 240px, collapsible to 56px icons.**

```
┌────────────────────┐
│ ◈ Acme Support  ▾  │  OrgSwitcher (Clerk)
├────────────────────┤
│ ▸ Inbox         12 │  count = open + unassigned
│   ├ Unassigned   5 │  saved views (Story 3.2 AC4)
│   ├ Mine         3 │
│   └ Needs human  2 │  ← escalations, always last, always visible
│ ▸ Knowledge        │
│ ▸ Playground       │
│ ▸ Analytics        │
├────────────────────┤
│ ⚙ Settings         │
│ ⌘K                 │  palette hint, not a button
└────────────────────┘
```

- **Saved views are nav, not filters.** "Unassigned", "Mine", "Needs human" are sidebar links carrying URL params. Story 3.2 AC4 requires one click; a filter panel is two.
- **"Needs human" never collapses to zero-state invisibility.** It shows `0` rather than disappearing — a disappearing escalation queue teaches agents not to look at it.
- Counts poll on the same 10s SWR cycle as the inbox (Architecture §9.3), not a separate request.

**Secondary — none.** No tabs, no breadcrumbs. Depth is two levels everywhere; a third level would be a design failure.

---
