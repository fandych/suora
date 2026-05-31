import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: 'out/main',
      lib: {
        entry: resolve(__dirname, 'electron/main.ts'),
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: 'out/preload',
      lib: {
        entry: resolve(__dirname, 'electron/preload.ts'),
        formats: ['cjs'],
      },
    },
  },
  renderer: {
    root: '.',
    build: {
      outDir: 'out/renderer',
      // Electron ships with a recent Chromium; targeting a modern baseline
      // skips unnecessary transpilation and shrinks the bundle.
      target: 'chrome120',
      // Production sourcemaps are not needed in the packaged renderer; they
      // slow down the build and inflate the output.
      sourcemap: false,
      cssCodeSplit: true,
      rollupOptions: {
        input: resolve(__dirname, 'index.html'),
        output: {
          manualChunks: {
            'vendor-react': ['react', 'react-dom', 'react-router-dom', 'zustand'],
            'vendor-ai': ['ai', '@ai-sdk/anthropic', '@ai-sdk/openai', '@ai-sdk/openai-compatible'],
            'vendor-markdown': ['react-markdown', 'remark-gfm'],
            'vendor-zod': ['zod'],
            'vendor-flow': ['@xyflow/react', 'dagre'],
            'vendor-mermaid': ['mermaid'],
            'vendor-tiptap': [
              '@tiptap/react',
              '@tiptap/starter-kit',
              '@tiptap/extension-image',
              '@tiptap/extension-link',
              '@tiptap/extension-placeholder',
            ],
            'vendor-katex': ['katex', 'rehype-katex', 'remark-math'],
            'vendor-icons': ['@iconify/react', '@iconify/utils'],
          },
        },
      },
    },
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': resolve(__dirname, './src'),
      },
    },
    server: {
      host: '127.0.0.1',
      port: 5173,
      strictPort: true,
    },
  },
})
