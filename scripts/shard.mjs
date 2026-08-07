#!/usr/bin/env node
// Regenerates the shards under `docs/` from the three source documents.
//
// This is the direction the convention actually prescribes — every shard says
// "edit the source document and re-shard, never this copy" — and until
// 2026-08-07 the repo had no way to do it. `check-shards.mjs` could only tell
// you the two had diverged; this closes the loop by making the source
// authoritative in practice and not just in a header line.
//
// A rule that cannot be followed with the tools present is a rule that will be
// broken. That is what happened on 2026-08-06, and the missing script was the
// cause rather than the carelessness.
//
// It rewrites only the section body; the two-line header is regenerated. A
// shard that has drifted is therefore OVERWRITTEN, not merged — run
// `pnpm check:shards` first if you are not sure which copy is newer.

import { readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { readFileSync } from 'node:fs'
import {
  DOCUMENTS,
  read,
  shardBody,
  shardHeader,
  expectedBody,
} from './shard-map.mjs'

let written = 0
let unchanged = 0

for (const doc of DOCUMENTS) {
  const raw = readFileSync(doc.source, 'utf8')
  const eol = raw.includes('\r\n') ? '\r\n' : '\n'
  const src = read(doc.source)

  for (const file of readdirSync(doc.dir).filter((f) => f.endsWith('.md'))) {
    const path = join(doc.dir, file)
    if (shardBody(path) === null) continue // authored, not derived

    const header = shardHeader(path)
    const { text, error } = expectedBody(src, header, doc)
    if (error) {
      console.error(`  ! ${path}: ${error}`)
      process.exitCode = 1
      continue
    }

    const existing = readFileSync(path, 'utf8')

    // Keep the shard's OWN header line; only the body is regenerated.
    //
    // `epic-list.md`'s reads "§5–§6 preamble", which documents the one sharding
    // special case in the place a reader of that file will actually see it.
    // Rebuilding headers from the section number flattened it to "§5" and threw
    // that away. **A generated file can still contain authored metadata**, and
    // the header is the line most likely to hold it.
    const wanted =
      header + '\n' +
      '> Derived file — edit the source document and re-shard, never this copy.\n\n' +
      text + '\n'

    // Compare NORMALISED, write with the shard's OWN line ending.
    //
    // The sources are LF and several shards are CRLF in the working tree, so a
    // raw comparison called every one of them changed and rewrote it — churning
    // fourteen files with no content difference on a run that should have been
    // a no-op. A regenerator whose output you cannot distinguish from a real
    // edit is one nobody will run before committing.
    if (wanted === existing.replace(/\r\n/g, '\n')) {
      unchanged++
      continue
    }

    const shardEol = existing.includes('\r\n') ? '\r\n' : eol
    writeFileSync(path, wanted.replace(/\n/g, shardEol))
    console.log(`  ~ ${path}`)
    written++
  }
}

console.log(`\n${written} shard(s) rewritten, ${unchanged} already current.`)
