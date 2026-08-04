import js from "@eslint/js";
import tseslint from "typescript-eslint";

/**
 * Shared flat config. Only rules that enforce a coding standard from
 * Architecture §15 — this is not a style opinion file, Prettier is not here,
 * and a rule that does not prevent a real bug does not belong.
 *
 * @type {import("eslint").Linter.Config[]}
 */
export const base = [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: ["**/dist/**", "**/.next/**", "**/node_modules/**", "**/.turbo/**"],
  },
  {
    rules: {
      // §15.11 — "No `any`. `unknown` plus a narrowing parse."
      "@typescript-eslint/no-explicit-any": "error",

      // §15.6 — "Environment variables are read only in server/env.ts."
      // Scoped per-app, since the allowed file differs by package; apps/web
      // re-declares this with its own override. Here it is the default deny.
      "no-restricted-properties": [
        "error",
        {
          object: "process",
          property: "env",
          message:
            "Read environment variables in server/env.ts only (Architecture §15.6).",
        },
      ],

      // TODO(1.2): §15.1 — "Never import `db` outside `server/db`." Add a
      // no-restricted-imports rule here once packages/db exports anything.
      // It cannot be written usefully against an empty package.
    },
  },
];

export default base;
