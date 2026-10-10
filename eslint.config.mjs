import tseslint from "typescript-eslint";
import uiStdlib from "./packages/lint/dist/index.js";

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/coverage/**",
      ".workspaces/**",
      ".codex/inbox/**",
      ".codex/outbox/**",
      ".codex/archive/**",
      ".codex/carrier/**",
      ".codex/state/**",
    ],
  },
  {
    files: ["**/*.{js,mjs,cjs,ts,tsx}"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
      },
    },
    plugins: {
      "@typescript-eslint": tseslint.plugin,
    },
    linterOptions: {
      reportUnusedDisableDirectives: "error",
    },
    rules: {
      "no-constant-binary-expression": "error",
      "no-debugger": "error",
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          "argsIgnorePattern": "^_",
          "caughtErrorsIgnorePattern": "^_",
          "varsIgnorePattern": "^_"
        }
      ]
    }
  },
  {
    files: ["packages/*/src/**/*.{js,mjs,cjs,ts,tsx}", "apps/*/src/**/*.{js,mjs,cjs,ts,tsx}"],
    plugins: {
      "ui-stdlib": uiStdlib,
    },
    rules: {
      "ui-stdlib/no-raw-colors": "error",
      "ui-stdlib/no-restyle": ["error", { components: [] }],
      "ui-stdlib/no-arbitrary-values": "error",
      "ui-stdlib/no-inline-styles": ["error", { allowedProperties: [] }],
      "ui-stdlib/no-unknown-classes-tokens": [
        "error",
        { knownClasses: [], knownTokens: [] },
      ],
      "ui-stdlib/require-static-classes": ["error", { namedVariants: [] }],
    },
  }
);
