import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "prisma/generated/**",
    "coverage/**",
    "node_modules/**",
    "_reference/**",
  ]),
  {
    rules: {
      // -------------------------------------------------------------------------
      // TypeScript strictness — enforce production-grade type safety
      // -------------------------------------------------------------------------
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "separate-type-imports" },
      ],
      "@typescript-eslint/no-non-null-assertion": "error",

      // -------------------------------------------------------------------------
      // Architecture enforcement
      // Prevent direct process.env access outside config/env.ts
      // -------------------------------------------------------------------------
      "no-restricted-syntax": [
        "error",
        {
          selector: "MemberExpression[object.object.name='process'][object.property.name='env']",
          message:
            "Direct process.env access is forbidden. Use '@/config/env' instead. See 02_SYSTEM_ARCHITECTURE.md §Configuration Layer.",
        },
      ],

      // -------------------------------------------------------------------------
      // General code quality
      // -------------------------------------------------------------------------
      "no-console": ["warn", { allow: ["log", "warn", "error"] }],
      "prefer-const": "error",
      "no-var": "error",
      eqeqeq: ["error", "always"],
      curly: ["error", "all"],
    },
  },
  // -------------------------------------------------------------------------
  // Exception: config/env.ts is the ONLY file allowed to access process.env
  // -------------------------------------------------------------------------
  {
    files: ["src/config/env.ts"],
    rules: {
      "no-restricted-syntax": "off",
    },
  },
  {
    files: ["prisma.config.ts", "prisma/**/*.ts"],
    rules: {
      "no-restricted-syntax": "off",
      "no-console": "off",
    },
  },
]);

export default eslintConfig;
