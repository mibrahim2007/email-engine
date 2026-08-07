// Shared model of how the three planning documents are sharded.
//
// `check-shards.mjs` asserts source and shards agree; `shard.mjs` regenerates
// the shards from the source. Both read this file, so the boundary rule is
// written once — the alternative is two implementations that drift, which is
// the failure this whole mechanism exists to prevent.
//
// Generalised 2026-08-07. It covered the architecture only, which left the
// front-end spec and the PRD carrying the same "edit the source and re-shard"
// instruction with nothing enforcing it. A diagnostic run found all three
// documents in sync — so this closes the gap while it is still closed, rather
// than after a second reversion.

import { readFileSync } from 'node:fs'

export const DOCUMENTS = [
  {
    source: 'Email Engine Architecture.md',
    dir: 'docs/architecture',
    link: 'Email%20Engine%20Architecture.md',
    label: 'Architecture',
  },
  {
    source: 'Email Engine Front-End Spec.md',
    dir: 'docs/front-end-spec',
    link: 'Email%20Engine%20Front-End%20Spec.md',
    label: 'Front-End Spec',
  },
  {
    source: 'Email Engine PRD.md',
    dir: 'docs/prd',
    link: 'Email%20Engine%20PRD.md',
    label: 'PRD',
    // §5's shard also carries §6's preamble — the text between "## 6." and the
    // first "### Epic 1", which belongs to no epic shard and would otherwise be
    // dropped. It defines the story format, so it is load-bearing.
    //
    // Named explicitly rather than detected. The first version of this inferred
    // it ("does the next section start with a ### soon?") and immediately
    // mis-fired on Architecture §4, whose successor §5 opens with `### Contact`
    // — silently gluing two sections together. A heuristic that is right about
    // one real case and wrong about another is worse than a hardcoded pair.
    carryPreamble: { shardSection: 5, fromSection: 6 },
  },
]

export const read = (p) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n')
export const trimEnd = (t) => t.replace(/\n+$/, '')

/** A shard's body: everything after the two-line header. Null if not a shard. */
export function shardBody(path) {
  const lines = read(path).split('\n')
  if (!lines[0].startsWith('> **Shard of')) return null
  let i = 2
  while (i < lines.length && lines[i].trim() === '') i++
  return trimEnd(lines.slice(i).join('\n'))
}

export const shardHeader = (path) => read(path).split('\n')[0]

/**
 * The source text a shard should contain, derived from its own header.
 *
 * Two shapes, because the PRD uses both:
 *   "§N."        → the whole `## N.` section, up to `## N+1.`
 *   "§6 Epic N." → one `### Epic N` block inside §6, up to the next Epic
 *
 * Returns { text } or { error }.
 */
export function expectedBody(src, header, doc = {}) {
  const epic = header.match(/§(\d+) Epic (\d+)/)
  if (epic) {
    const n = Number(epic[2])
    const start = src.search(new RegExp(`^### Epic ${n}\\b`, 'm'))
    if (start === -1) return { error: `source has no "### Epic ${n}"` }
    const rest = src.slice(start + 1)
    let rel = rest.search(new RegExp(`^### Epic ${n + 1}\\b`, 'm'))
    if (rel === -1) rel = rest.search(/^## \d+\. /m)
    return { text: trimEnd(rel === -1 ? src.slice(start) : src.slice(start, start + 1 + rel)) }
  }

  const sec = header.match(/§(\d+)/)
  if (!sec) return { error: 'shard header names no section number' }
  const n = Number(sec[1])
  const start = src.search(new RegExp(`^## ${n}\\. `, 'm'))
  if (start === -1) return { error: `source has no "## ${n}." section` }
  const rest = src.slice(start + 1)
  const rel = rest.search(new RegExp(`^## ${n + 1}\\. `, 'm'))
  if (rel === -1) return { text: trimEnd(src.slice(start)) }
  let end = start + 1 + rel

  // See `carryPreamble` in DOCUMENTS: one named document/section pair, not a
  // guess about what a section looks like.
  const cp = doc.carryPreamble
  if (cp && cp.shardSection === n && cp.fromSection === n + 1) {
    const after = src.slice(end)
    const preambleEnd = after.search(/^### /m)
    if (preambleEnd === -1) return { error: `§${n + 1} has no "###" to end its preamble` }
    end += preambleEnd
  }

  return { text: trimEnd(src.slice(start, end)) }
}
