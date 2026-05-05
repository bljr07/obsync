import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: [
      "tests/unit/**/*.spec.ts",
      "tests/features/**/*.spec.ts",
      "tests/integration/**/*.spec.ts"
    ],
    setupFiles: ["tests/vitest.setup.ts"],
    fileParallelism: false
  }
});
