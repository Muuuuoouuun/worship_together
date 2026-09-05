import { createRequire } from "node:module";

// Include the dependency-free Node test suite in the repository's tsx test run.
const loadAuthTests = createRequire(import.meta.url);
loadAuthTests("../components/auth/auth.test.cjs");
