import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    ".next-qa/**",
    ".next-prod/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "public/pdf.worker.min.mjs",
    // 개발·빌드 전에 scripts/prepare-pdf-worker.mjs 가 복사하는 PDF.js 자료 (.gitignore 대상)
    "public/pdfjs/**",
    // 브라우저 E2E 는 Playwright 를 쓰는 평범한 Node(CommonJS) 스크립트
    "e2e/**",
  ]),
]);

export default eslintConfig;
