import { z } from "zod";

/**
 * The one place `process.env` is read (Architecture §15.6). An ESLint override
 * in `eslint.config.js` exempts this file and only this file.
 *
 * Validated at module load, so a missing or malformed variable fails the boot
 * rather than surfacing as `undefined` somewhere far away.
 *
 * Story 1.1 needs almost nothing. Architecture §12 lists fifteen variables the
 * product will eventually want — DATABASE_URL, CLERK_SECRET_KEY, and the rest —
 * and each is added by the story that first uses it. Demanding them now would
 * fail the build for five more stories.
 */
const schema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  /** Set by Vercel on every deployment; absent locally. */
  VERCEL_GIT_COMMIT_SHA: z.string().optional(),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  // Not a taxonomy error (§15.9) — nothing has booted yet to catch one.
  throw new Error(
    `Invalid environment:\n${z.prettifyError(parsed.error)}`,
  );
}

export const env = parsed.data;
