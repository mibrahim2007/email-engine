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
 * The lockfile rather than each package.json, because a provider SDK is most
 * likely to arrive as a transitive dependency of something that looked
 * harmless, and that is exactly the case a per-manifest check misses.
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

describe("no provider SDK in the dependency tree — Story 5.2 AC3", () => {
  const lock = readFileSync(lockfile, "utf8");

  it.each(FORBIDDEN)("does not resolve %s", (pkg) => {
    // Match a package key at the start of an entry: "  <name>@<version>:" or
    // "  <name>:" under an importer. Substring matching would flag `openai` in
    // any URL or comment, and a check that is routinely wrong gets ignored.
    const asKey = new RegExp(`^\\s{2,}(?:/)?${pkg.replace(/[/@.-]/g, "\\$&")}@`, "m");
    const asDep = new RegExp(`^\\s{4,}(?:/)?${pkg.replace(/[/@.-]/g, "\\$&")}:`, "m");
    expect(asKey.test(lock) || asDep.test(lock)).toBe(false);
  });

  it("would notice if the pattern stopped matching anything at all", () => {
    // A guard that can never fire is decorative. `ai` is the Vercel AI SDK and
    // is expected to be here once Epic 5 starts; until then, assert the
    // lockfile is real so the test above is running against content rather
    // than an empty string.
    expect(lock.length).toBeGreaterThan(100);
    expect(lock).toContain("lockfileVersion");
  });
});
