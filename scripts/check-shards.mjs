#!/usr/bin/env node
// Asserts every architecture shard is byte-identical to its section in the
// source document.
//
// Why this exists. The shards each carry the line "Derived file — edit the
// source document and re-shard, never this copy." On 2026-08-06 three epics'
// worth of architecture rulings were written straight into the shards and not
// into `Email Engine Architecture.md` — roughly 24KB across sections 4, 6, 8,
// 10, 12 and 13. Nothing noticed, because the shards are what everyone reads:
// they are the `devLoadAlwaysFiles` set, so the working copies were correct
// and only the canonical artifact was stale.
//
// That is the dangerous direction. The source is what re-sharding regenerates
// FROM, so the next re-shard would have silently deleted every one of those
// rulings — including the RLS/HNSW retrieval finding and the bounce-loop
// ruling, neither of which exists anywhere else.
//
// A documented convention grows exceptions; a tested one has to be argued
// with. Same reasoning as `system.ts`'s surface test, the provider-SDK
// lockfile assertion, and the `region` single-value CHECK.
//
// The transform below is the exact inverse of sharding, verified by running
// it against the eight sections that had not been edited: all eight came back
// byte-identical.

import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const SOURCE = 'Email Engine Architecture.md'
const SHARD_DIR = 'docs/architecture'

// Line endings are normalised before comparing. The source is CRLF in the
// working tree and the shards are LF, and git normalises both on commit — so a
// raw byte comparison reports all fourteen sections as differing and says
// nothing about content. Found by watching this check fail on a tree that was
// known to be in sync, which is the only reason it is not still wrong.
const read = (p) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n')

const src = read(SOURCE)

/** Strip the two-line shard header and any blank lines after it. */
function shardBody(path) {
  const lines = read(path).split('\n')
  if (!lines[0].startsWith('> **Shard of')) return null // index.md and friends
  let i = 2
  while (i < lines.length && lines[i].trim() === '') i++
  return lines.slice(i).join('\n').replace(/\n+$/, '')
}

/** The source text of `## N. …` up to the next `## N+1. …`. */
function sectionBody(n) {
  const start = src.search(new RegExp(`^## ${n}\\. `, 'm'))
  if (start === -1) return null
  const restIdx = src.slice(start + 1).search(new RegExp(`^## ${n + 1}\\. `, 'm'))
  const end = restIdx === -1 ? src.length : start + 1 + restIdx
  return src.slice(start, end).replace(/\n+$/, '')
}

const failures = []
let checked = 0

for (const file of readdirSync(SHARD_DIR).filter((f) => f.endsWith('.md'))) {
  const path = join(SHARD_DIR, file)
  const body = shardBody(path)
  if (body === null) continue

  const header = read(path).split('\n')[0]
  const n = Number(header.match(/§(\d+)/)?.[1])
  if (!n) {
    failures.push(`${path}: shard header names no section number`)
    continue
  }

  const section = sectionBody(n)
  if (section === null) {
    failures.push(`${path}: source has no "## ${n}." section`)
    continue
  }

  checked++
  if (section !== body) {
    const a = section.split('\n')
    const b = body.split('\n')
    const at = a.findIndex((line, i) => line !== b[i])
    failures.push(
      `${path} (§${n}) differs from ${SOURCE} at line ~${at + 1}\n` +
        `    source: ${JSON.stringify((a[at] ?? '<end of section>').slice(0, 100))}\n` +
        `    shard:  ${JSON.stringify((b[at] ?? '<end of shard>').slice(0, 100))}`,
    )
  }
}

if (failures.length) {
  console.error(`\nArchitecture shards are out of sync with ${SOURCE}:\n`)
  for (const f of failures) console.error(`  - ${f}\n`)
  console.error(
    'Rulings written into a shard do not reach the source, and the source is\n' +
      'what a re-shard regenerates from — so they would be silently deleted.\n' +
      'Edit the source and re-shard, or port the shard text back into it.\n',
  )
  process.exit(1)
}

console.log(`Architecture shards in sync with ${SOURCE} (${checked} sections).`)
