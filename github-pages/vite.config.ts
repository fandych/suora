import mdx from '@mdx-js/rollup'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { copyFileSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'

export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? '/suora/' : '/',
  plugins: [tailwindcss(), mdx(), react()],
  build: {
    rollupOptions: {
      plugins: [
        {
          name: 'github-pages-spa-fallback',
          closeBundle() {
            copyFileSync(
              fileURLToPath(new URL('./dist/index.html', import.meta.url)),
              fileURLToPath(new URL('./dist/404.html', import.meta.url)),
            )
          },
        },
      ],
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
