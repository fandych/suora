import { resolve } from "node:path"

import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    include: ["tests/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: ["src/components/ui/**", "electron/integrations/script-worker.mjs", "**/*.d.ts", "**/index.html"],
      thresholds: {
        statements: 28,
        lines: 32,
        branches: 20,
        functions: 20,
      },
    },
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
      "@shared": resolve(__dirname, "./shared"),
      "@electron": resolve(__dirname, "./electron"),
    },
  },
})