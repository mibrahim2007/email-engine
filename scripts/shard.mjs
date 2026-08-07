#!/usr/bin/env node
// Regenerates `docs/architecture/*.md` from `Email Engine Architecture.md`.
//
// This is the direction the convention actually prescribes — every shard says
// "edit the source document and re-shard, never this copy" — and until now the
// repo had no way to do it. `check-shards.mjs` could only tell you the two had
// diverged; this closes the loop by making the source authoritative in
// practice and not just in a header line.
//
// It rewrites only the section body. The two-line shard header is regenerated
// from the section number, so a shard that drifts is overwritten rather than
// merged: run `check-shards` first if you are not sure which copy is newer.
//
// Sections are found by their `## N. Title` headings and each runs to the next
// one, which is the same boundary rule `check-shards.mjs` uses. Deriving them
// from headings rather than line ranges is what stops a silent off-by-one from
// looking like "content moved" in the diff.

import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const SOURCE = 'Email Engine Architecture.md'
const SHARD_DIR = 'docs/architecture'
const LINK = 'Email%20Engine%20Architecture.md'

// Normalised for matching; the source's own line ending is preserved on write.
const raw = readFileSync(SOURCE, 'utf8')
const eol = raw.includes('\r\n') ? '\r\n' : '\n'
const src = raw.replace(/\r\n/g, '\n')

function sectionBody(n) {
  const start = src.search(new RegExp(`^## ${n}\\. `, 'm'))
  if (start === -1) return null
  const restIdx = src.slice(start + 1).search(new RegExp(`^## ${n + 1}\\. `, 'm'))
  const end = restIdx === -1 ? src.length : start + 1 + restIdx
  return src.slice(start, end).replace(/\n+$/, '')
}

let written = 0
let unchanged = 0

for (const file of readdirSync(SHARD_DIR).filter((f) => f.endsWith('.md'))) {
  const path = join(SHARD_DIR, file)
  const existing = readFileSync(path, 'utf8')
  const firstLine = existing.replace(/\r\n/g, '\n').split('\n')[0]
  if (!firstLine.startsWith('> **Shard of')) continue // index.md and friends

  const n = Number(firstLine.match(/§(\d+)/)?.[1])
  if (!n) {
    console.error(`  ! ${path}: shard header names no section number`)
    process.exitCode = 1
    continue
  }

  const body = sectionBody(n)
  if (body === null) {
    console.error(`  ! ${path}: source has no "## ${n}." section`)
    process.exitCode = 1
    continue
  }

  const header =
    `> **Shard of [Architecture](../../${LINK}) §${n}.**\n` +
    `> Derived file — edit the source document and re-shard, never this copy.\n\n`

  const next = (header + body + '\n').replace(/\n/g, eol)
  if (next === existing) {
    unchanged++
  } else {
    writeFileSync(path, next)
    console.log(`  ~ ${path} (§${n})`)
    written++
  }
}

console.log(`\n${written} shard(s) rewritten, ${unchanged} already current.`)
