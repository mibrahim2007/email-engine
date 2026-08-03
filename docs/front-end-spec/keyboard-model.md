> **Shard of [Front-End Spec](../../Email%20Engine%20Front-End%20Spec.md) §8.**
> Derived file — edit the source document and re-shard, never this copy.

## 8. Keyboard model

PRD §3.2: a power agent never touches the mouse in the review loop.

| Key | Context | Action |
|---|---|---|
| `j` / `k` | Inbox | Next / previous conversation |
| `Enter` | Inbox | Open |
| `Esc` | Conversation | Back to inbox |
| `e` | Both | Resolve |
| `a` | Both | Assign — opens `command` scoped to members |
| `⌘↵` | Draft | Send |
| `⌘⇧↵` | Draft | Send and resolve |
| `r` | Conversation | Regenerate draft |
| `⌘Z` | After send | Undo, within the 5s window |
| `/` | Inbox | Focus search |
| `⌘K` | Global | Command palette |
| `?` | Global | Shortcut sheet |

- **`⌘↵` must work from inside the textarea**, where a naive key handler would be swallowed by the editor. This is the single most-pressed key in the product.
- No single-letter shortcut fires while a text input has focus.
- `⌘K` covers navigation, conversation search, and actions on the current conversation (Story 3.6 AC3).
- `?` is discoverable from the palette, satisfying Story 3.6 AC2's "discoverable shortcut sheet".

---

