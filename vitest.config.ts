import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    testTimeout: 20_000,
    exclude: ["node_modules/**", ".next/**", "tests/e2e/**"],
    setupFiles: ["./src/test/setup.ts"],
  },
});
