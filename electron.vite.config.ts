import { resolve } from "path"

import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import { defineConfig } from "electron-vite"
import { cpSync, existsSync } from "node:fs"

const alias = {
  "@": resolve(__dirname, "./src"),
}

function copyScriptWorker() {
  return {
    name: "copy-script-worker",
    closeBundle() {
      const source = resolve(__dirname, "src/electron/integrations/script-worker.mjs")
      const target = resolve(__dirname, "out/main/script-worker.mjs")
      if (existsSync(source)) cpSync(source, target)
    },
  }
}

function copyDrizzleMigrations() {
  return {
    name: "copy-drizzle-migrations",
    closeBundle() {
      const source = resolve(__dirname, "src/drizzle/migrations")
      const target = resolve(__dirname, "out/main/drizzle/migrations")
      cpSync(source, target, { recursive: true })
    },
  }
}

function handleRollupWarning(
  warning: { code?: string; message: string },
  warn: (warning: { code?: string; message: string }) => void
) {
  if (warning.message.includes("contains an annotation that Rollup cannot interpret due to the position of the comment")) {
    return
  }

  warn(warning)
}

export default defineConfig({
  main: {
    plugins: [copyScriptWorker(), copyDrizzleMigrations()],
    resolve: {
      alias,
    },
    build: {
      outDir: "out/main",
      externalizeDeps: true,
      lib: {
        entry: resolve(__dirname, "src/electron/main.ts"),
      },
    },
  },
  preload: {
    resolve: {
      alias,
    },
    build: {
      outDir: "out/preload",
      externalizeDeps: true,
      lib: {
        entry: resolve(__dirname, "src/electron/preload.ts"),
        formats: ["cjs"],
      },
    },
  },
  renderer: {
    root: ".",
    build: {
      outDir: "out/renderer",
      target: "chrome120",
      sourcemap: false,
      cssCodeSplit: true,
      rollupOptions: {
        input: resolve(__dirname, "index.html"),
        onwarn: handleRollupWarning,
      },
    },
    plugins: [react(), tailwindcss()],
    resolve: {
      alias,
    },
    server: {
      host: "127.0.0.1",
      port: 5173,
      strictPort: false,
    },
  },
})