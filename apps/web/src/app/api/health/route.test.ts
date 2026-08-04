import { describe, expect, it } from "vitest";
import { GET, buildHealth } from "./route";

describe("/api/health", () => {
  it("returns 200 with the documented shape", async () => {
    const res = GET();
    expect(res.status).toBe(200);

    const body = (await res.json()) as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(["commit", "status", "version"]);
    expect(body.status).toBe("ok");
  });

  it("reports a non-empty version and commit", () => {
    const health = buildHealth();
    // AC3 asks for a commit. "local" off Vercel is a real answer; "" is not.
    expect(health.commit.length).toBeGreaterThan(0);
    expect(health.version).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
