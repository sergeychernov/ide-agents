import eslint from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "dist/**",
      "web/dist/**",
      "docs/**",
      "**/*.d.ts",
      "**/*.cjs",
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.ts", "template/**/*.mjs"],
    languageOptions: {
      globals: globals.node,
      ecmaVersion: 2022,
      sourceType: "module",
    },
  },
  {
    files: ["web/**/*.{ts,tsx}"],
    plugins: {
      "react-hooks": reactHooks,
    },
    languageOptions: {
      globals: globals.browser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // Data fetch on mount via helpers that call setState — standard for this UI.
      "react-hooks/set-state-in-effect": "off",
    },
  },
);
