import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["tests/**/*.spec.ts"]
  },
  resolve: {
    alias: {
      obsidian: path.resolve(__dirname, "tests/obsidian-shim.ts")
    }
  }
});
