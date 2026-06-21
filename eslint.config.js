// Flat ESLint config (ESLint v9+). package.json is "type": "module", so this file is ESM.
//
// We lint only first-party TypeScript under src/ and tests/. Generated output
// (the .sdPlugin bundle), vendored deps, coverage, and preview renders are excluded.
import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";

export default [
  {
    ignores: [
      "com.vladoportos.aimonitor.sdPlugin/**",
      "node_modules/**",
      "coverage/**",
      "preview/**",
    ],
  },
  {
    files: ["src/**/*.ts", "tests/**/*.ts"],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: "latest",
      sourceType: "module",
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      // Honor the codebase convention: a leading underscore marks an
      // intentionally-unused binding (handler params required by a signature,
      // discarded destructures, ignored catch bindings).
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
];
