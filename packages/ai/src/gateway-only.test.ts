import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Story 5.2 AC3: "All model access goes through Vercel AI Gateway; no provider
 * SDK is present in the dependency tree."
 *
 * Tech stack §3 lists provider SDKs as *deliberately excluded*. A documented
 * exclusion grows — the same reasoning that put a surface test on `system.ts`
 * and a single-value CHECK on `region`: **constrain the exception, do not
 * merely document it.**
 *
 * The lockfile rather than each `package.json`, because a provider SDK is most
 * likely to arrive as a transitive dependency of something that looked
 * harmless, and that is exactly the case a per-manifest check misses.
 *
 * ---
 *
 * **Written with string operations rather than a built regex, after the first
 * version was probed and found decorative.** It escaped the package name into
 * a `RegExp` and caught a bare `openai@…` while **missing every scoped
 * package** — including `@anthropic-ai/sdk`, which is the single most likely
 * SDK to be added to this repo — and missing direct dependencies entirely.
 *
 * It passed the whole time, because nothing had ever been added for it to
 * catch. *A rule nobody has seen fail is indistinguishable from a rule that
 * does not work*, and this one had four failure shapes and one working case.
 */

const FORBIDDEN = [
  "@anthropic-ai/sdk",
  "openai",
  "@google/generative-ai",
  "@google-cloud/aiplatform",
  "cohere-ai",
  "@mistralai/mistralai",
  "replicate",
  "@huggingface/inference",
] as const;

const lockfile = fileURLToPath(new URL("../../../pnpm-lock.yaml", import.meta.url));

/**
 * Every package name the lockfile mentions, in any of the shapes pnpm uses:
 *
 *   packages:   `  '@anthropic-ai/sdk@0.32.1':`   scoped — **quoted**
 *   packages:   `  openai@4.104.0:`               unscoped — unquoted
 *   snapshots:  `  openai@4.104.0: {}`
 *   importers:  `      openai:`                   direct dependency
 *
 * **The quotes are the whole trap.** YAML treats a leading `@` as a reserved
 * indicator, so pnpm quotes every scoped key and leaves unscoped ones bare.
 * A parser that does not strip them stores `'@anthropic-ai/sdk` and reports
 * clean forever — which is precisely what the first two versions of this file
 * did, and `@anthropic-ai/sdk` is the SDK most likely to be added here.
 *
 * Leading `/` appears in older lockfile versions. Splitting on the *last* `@`
 * is what makes scoped names work: `@scope/name@1.0.0` has two.
 */
function mentionedPackages(lock: string): Set<string> {
  const names = new Set<string>();
  for (const raw of lock.split("\n")) {
    const line = raw.trim();
    if (!line.endsWith(":") && !line.includes(": {")) continue;

    let key = line.replace(/:\s*(\{.*\})?$/, "");
    key = key.replace(/^['"]|['"]$/g, "");
    if (key.startsWith("/")) key = key.slice(1);
    if (key.length === 0) continue;

    const at = key.lastIndexOf("@");
    // `@scope/name` with no version: lastIndexOf("@") is 0, so keep it whole.
    names.add(at > 0 ? key.slice(0, at) : key);
  }
  return names;
}

describe("no provider SDK in the dependency tree — Story 5.2 AC3", () => {
  const lock = readFileSync(lockfile, "utf8");
  const mentioned = mentionedPackages(lock);

  it.each(FORBIDDEN)("does not resolve %s", (pkg) => {
    expect(mentioned.has(pkg)).toBe(false);
  });

  it("parses the lockfile into real package names, not an empty set", () => {
    // The guard above is vacuous if the parser returns nothing.
    expect(mentioned.size).toBeGreaterThan(50);
    expect(mentioned.has("next")).toBe(true);
    expect(mentioned.has("vitest")).toBe(true);
    expect(mentioned.has("typescript")).toBe(true);
  });

  it("detects a SCOPED package that is really in this lockfile", () => {
    // The load-bearing assertion, and it deliberately names a package this
    // repo actually has rather than a synthetic one.
    //
    // Two earlier versions of this file passed while unable to see any scoped
    // package at all, because a synthetic fixture written from memory omitted
    // the quotes pnpm actually emits. **A fixture is a second chance to encode
    // the same wrong assumption** — asserting against the real file is what
    // makes that impossible.
    expect(mentioned.has("@alloc/quick-lru")).toBe(true);
    expect(mentioned.has("@babel/core")).toBe(true);
    // The broken form, asserted absent so a regression is named rather than
    // silently reducing this suite to unscoped packages.
    expect([...mentioned].some((n) => n.startsWith("'"))).toBe(false);
  });

  it("recognises every shape a provider SDK could arrive in", () => {
    // Shapes copied from the real lockfile, quoting included.
    const synthetic = [
      "packages:",
      "",
      "  openai@4.104.0:",
      "    resolution: {integrity: sha512-x}",
      "  '@anthropic-ai/sdk@0.32.1':",
      "    resolution: {integrity: sha512-x}",
      "  '/@google/generative-ai@0.21.0':",
      "    resolution: {integrity: sha512-x}",
      "",
      "snapshots:",
      "",
      "  cohere-ai@7.0.0: {}",
      "",
      "importers:",
      "  .:",
      "    dependencies:",
      "      replicate:",
      "        specifier: ^1.0.0",
    ].join("\n");

    const found = mentionedPackages(synthetic);
    for (const pkg of ["openai", "@anthropic-ai/sdk", "@google/generative-ai", "cohere-ai", "replicate"]) {
      expect(found, `${pkg} should be detected`).toContain(pkg);
    }
  });
});
