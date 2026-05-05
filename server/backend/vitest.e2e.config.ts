import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/e2e/**/*.spec.ts"],
    setupFiles: ["tests/e2e/setup.ts"],
    fileParallelism: false
  }
});
