#!/usr/bin/env node
// Structural checks over the story corpus. Each one exists because the
// whole-corpus review on 2026-08-07 found the defect it looks for, and each
// was found by an ad-hoc script that then went away — which is the reason to
// make them permanent. A documented convention grows exceptions; a tested one
// has to be argued with.
//
//   1. Every table has exactly one story that creates it.
//   2. Every `Creates` entry names a table that actually exists.
//   3. No forward dependencies (a story waiting on a later one).
//   4. No dependency cycles.
//   5. Every `Depends on` reference resolves to a real story.
//
// 3 subsumes 4 as long as stories are numbered in intended build order: any
// cycle must contain at least one edge pointing forward, so the forward check
// fires first. The 2.4 -> 2.7 cycle was exactly that. The cycle check is kept
// anyway — it costs nothing and it is the one that still holds if stories are
// ever renumbered or an epic is reordered, which is precisely when the ordering
// assumption behind 3 stops being true.
//
// NOT checked here, deliberately: "an acceptance criterion that names a
// quantity needs a column". That check is in the drafting checklist and stays
// human — the tell is a phrase containing a unit or a possessive, and every
// mechanical version of it produces more false positives than findings. A
// noisy check gets ignored, which is worse than no check.

import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const STORY_DIR = 'docs/stories'
const ARCH = 'Email Engine Architecture.md'
const MIGRATIONS = 'migrations'

const read = (p) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n')
const failures = []

// ---------------------------------------------------------------- stories --
const files = readdirSync(STORY_DIR)
  .filter((f) => /^\d+\.\d+\.md$/.test(f))
  .sort((a, b) => cmp(id(a), id(b)))

function id(f) {
  return f.replace(/\.md$/, '')
}
function cmp(a, b) {
  const [ae, as] = a.split('.').map(Number)
  const [be, bs] = b.split('.').map(Number)
  return ae - be || as - bs
}

const stories = new Map()
for (const f of files) {
  const s = read(join(STORY_DIR, f))
  const row = (label) =>
    s.match(new RegExp(`^\\| \\*\\*${label}\\*\\* \\|(.+?)\\|\\s*$`, 'm'))?.[1] ?? ''
  stories.set(id(f), {
    creates: [...row('Creates').matchAll(/`([a-z_]+)`/g)].map((m) => m[1]),
    // Only bare N.M references count as dependencies. Prose like "2.2/2.3"
    // still parses; a bare year or version would not appear in this row.
    deps: [...new Set([...row('Depends on').matchAll(/\b(\d+\.\d+)\b/g)].map((m) => m[1]))]
      .filter((d) => d !== id(f)),
  })
}

// ----------------------------------------------------------------- tables --
// Canonical set = every CREATE TABLE in the migrations plus every one in the
// architecture. Derived, never hardcoded: a table added to either shows up
// here and immediately needs an owner.
const tableSql = [
  ...readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).map((f) => read(join(MIGRATIONS, f))),
  read(ARCH),
].join('\n')
const tables = new Set([...tableSql.matchAll(/CREATE TABLE\s+([a-z_]+)/g)].map((m) => m[1]))

// 1 + 2. ownership
const owners = new Map()
for (const [sid, st] of stories) {
  for (const t of st.creates) {
    if (!tables.has(t)) {
      failures.push(`${sid}: Creates \`${t}\`, which is not a table in the migrations or the architecture`)
    }
    if (!owners.has(t)) owners.set(t, [])
    owners.get(t).push(sid)
  }
}
for (const t of [...tables].sort()) {
  const o = owners.get(t) ?? []
  if (o.length === 0) {
    failures.push(
      `\`${t}\` has no story creating it.\n` +
        `      Add it to a story's **Creates** row. Eleven tables were in this state on\n` +
        `      2026-08-07 — including \`messages\`, referenced by 23 stories — because\n` +
        `      migrations/0001 creates every table and is never applied to Neon (§6.8c).`,
    )
  } else if (o.length > 1) {
    failures.push(`\`${t}\` is created by more than one story: ${o.join(', ')}`)
  }
}

// 3 + 4 + 5. the dependency graph
for (const [sid, st] of stories) {
  for (const d of st.deps) {
    if (!stories.has(d)) {
      failures.push(`${sid}: depends on ${d}, which is not a story`)
    } else if (cmp(d, sid) > 0) {
      failures.push(
        `${sid}: depends on ${d}, which comes later.\n` +
          `      One story is in flight at a time, in dependency order — a forward\n` +
          `      dependency means neither can be approved first.`,
      )
    }
  }
}

const WHITE = 0, GREY = 1, BLACK = 2
const colour = new Map([...stories.keys()].map((k) => [k, WHITE]))
const stack = []
const seenCycles = new Set()
function visit(n) {
  colour.set(n, GREY)
  stack.push(n)
  for (const d of stories.get(n)?.deps ?? []) {
    if (!stories.has(d)) continue
    if (colour.get(d) === GREY) {
      const cycle = stack.slice(stack.indexOf(d)).concat(d).join(' -> ')
      if (!seenCycles.has(cycle)) {
        seenCycles.add(cycle)
        failures.push(
          `dependency cycle: ${cycle}\n` +
            `      Stories 2.4 and 2.7 were in this state — each needed the other, so\n` +
            `      neither could be approved first. A cycle usually means one noun is\n` +
            `      doing two jobs; splitting it breaks the loop.`,
        )
      }
    } else if (colour.get(d) === WHITE) {
      visit(d)
    }
  }
  stack.pop()
  colour.set(n, BLACK)
}
for (const k of stories.keys()) if (colour.get(k) === WHITE) visit(k)

// ----------------------------------------------------------------- report --
if (failures.length) {
  console.error('\nStory corpus checks failed:\n')
  for (const f of failures) console.error(`  - ${f}\n`)
  process.exit(1)
}

console.log(
  `Story corpus OK — ${stories.size} stories, ${tables.size} tables each created by exactly one.`,
)
