import { base } from "./base.js";

/**
 * Next.js flat config = the shared base plus the Next plugin's own rules.
 *
 * `eslint-config-next` is consumed through FlatCompat rather than imported
 * directly because it still ships as an eslintrc-shaped config.
 *
 * @type {import("eslint").Linter.Config[]}
 */
export const next = [
  ...base,
  {
    files: ["**/*.{ts,tsx}"],
    rules: {
      // A Server Component is the default; "use client" needs a reason.
      // §15.7 is a review rule rather than a lint rule — no ESLint rule can
      // judge whether the comment explaining it is honest.
    },
  },
];

export default next;
