import { resolve } from "path"

import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import { defineConfig, externalizeDepsPlugin } from "electron-vite"

const alias = {
  "@": resolve(__dirname, "./src"),
  "@electron": resolve(__dirname, "./electron"),
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
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias,
    },
    build: {
      outDir: "out/main",
      lib: {
        entry: resolve(__dirname, "electron/main.ts"),
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias,
    },
    build: {
      outDir: "out/preload",
      lib: {
        entry: resolve(__dirname, "electron/preload.ts"),
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