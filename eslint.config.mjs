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
    ".next-e2e/**",
    "android/**/build/**",
    "android/app/src/main/assets/**",
    // iOS 네이티브 프로젝트 안의 JS 는 cap sync 가 복사한 웹 자료(App/App/public)와 빌드 산출물뿐입니다.
    "ios/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "public/pdf.worker.min.mjs",
    // 개발·빌드 전에 scripts/prepare-pdf-worker.mjs 가 복사하는 PDF.js 자료 (.gitignore 대상)
    "public/pdfjs/**",
  ]),
]);

export default eslintConfig;
