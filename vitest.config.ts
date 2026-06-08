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
    exclude: ["node_modules/**", ".next/**", "tests/e2e/**"],
    setupFiles: ["./src/test/setup.ts"],
  },
});
