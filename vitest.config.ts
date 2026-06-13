import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(new URL("./src/test/mocks/server-only.ts", import.meta.url)),
      "next/navigation": fileURLToPath(new URL("./src/test/mocks/next-navigation.ts", import.meta.url)),
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
