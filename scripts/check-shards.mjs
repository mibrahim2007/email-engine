#!/usr/bin/env node
// Asserts every shard is byte-identical to its section in the source document,
// across all three planning artifacts.
//
// Why this exists. Every shard carries the line "Derived file — edit the source
// document and re-shard, never this copy." On 2026-08-06 three epics' worth of
// architecture rulings were written straight into the shards and not into
// `Email Engine Architecture.md` — roughly 24KB across six sections. Nothing
// noticed, because the shards are what everyone reads: they are the
// `devLoadAlwaysFiles` set, so the working copies were correct and only the
// canonical artifact was stale.
//
// That is the dangerous direction. The source is what re-sharding regenerates
// FROM, so the next re-shard would have silently deleted every one of those
// rulings — including the RLS/HNSW retrieval finding and the bounce-loop
// ruling, neither of which existed anywhere else.
//
// A documented convention grows exceptions; a tested one has to be argued
// with. Same reasoning as `system.ts`'s surface test, the provider-SDK
// lockfile assertion, and the `region` single-value CHECK.
//
// Widened 2026-08-07 from the architecture to all three documents. The gate
// had been guarding one of the three files carrying that instruction, which is
// the shape of gap worth closing while it is still theoretical.

import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { DOCUMENTS, read, trimEnd, shardBody, shardHeader, expectedBody } from './shard-map.mjs'

const failures = []
let checked = 0

for (const doc of DOCUMENTS) {
  const src = read(doc.source)

  for (const file of readdirSync(doc.dir).filter((f) => f.endsWith('.md'))) {
    const path = join(doc.dir, file)
    const body = shardBody(path)
    if (body === null) continue // index.md, traceability.md — authored, not derived

    const { text, error } = expectedBody(src, shardHeader(path), doc)
    if (error) {
      failures.push(`${path}: ${error}`)
      continue
    }

    checked++
    if (trimEnd(text) !== body) {
      const a = trimEnd(text).split('\n')
      const b = body.split('\n')
      const at = a.findIndex((line, i) => line !== b[i])
      failures.push(
        `${path} differs from ${doc.source} at line ~${at + 1}\n` +
          `    source: ${JSON.stringify((a[at] ?? '<end of section>').slice(0, 100))}\n` +
          `    shard:  ${JSON.stringify((b[at] ?? '<end of shard>').slice(0, 100))}`,
      )
    }
  }
}

if (failures.length) {
  console.error(`\nShards are out of sync with their source documents:\n`)
  for (const f of failures) console.error(`  - ${f}\n`)
  console.error(
    'Rulings written into a shard do not reach the source, and the source is\n' +
      'what a re-shard regenerates from — so they would be silently deleted.\n' +
      'Edit the source and run `pnpm shard`, or port the shard text back into it.\n',
  )
  process.exit(1)
}

console.log(
  `Shards in sync across ${DOCUMENTS.length} documents (${checked} sections).`,
)
