import { env } from "@/server/env";
import pkg from "../../../../package.json" with { type: "json" };

/**
 * Story 1.1 AC3 — `{ status, version, commit }`, reachable on a deployed URL.
 *
 * Dynamic on purpose: a cached health check reports the health of whichever
 * deploy happened to warm the cache, which is worse than no health check at all
 * because it looks like one.
 */
export const dynamic = "force-dynamic";

export type Health = {
  status: "ok";
  version: string;
  commit: string;
};

export function buildHealth(): Health {
  return {
    status: "ok",
    version: pkg.version,
    // Absent outside Vercel; "local" is honest where an empty string is not.
    commit: env.VERCEL_GIT_COMMIT_SHA ?? "local",
  };
}

export function GET(): Response {
  return Response.json(buildHealth());
}
