import next from "@repo/config/eslint/next";

export default [
  ...next,
  {
    // §15.6 — server/env.ts is the one place process.env may be read.
    files: ["src/server/env.ts"],
    rules: { "no-restricted-properties": "off" },
  },
];
