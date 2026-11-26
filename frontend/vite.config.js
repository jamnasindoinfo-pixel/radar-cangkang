import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { execSync } from 'node:child_process'

// Build ke website/dist (disajikan server.py). Saat dev, /api dan file data JSON
// diteruskan ke server.py di port 8765.
const BACKEND = 'http://127.0.0.1:8765'

// Commit yang sedang dibangun (7 karakter, sama dengan deploy.commit di /api/status): tab yang masih
// menjalankan versi lama bisa mendeteksi deploy baru dan menawarkan muat ulang.
let BUILD = ''
try { BUILD = execSync('git rev-parse --short=7 HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() } catch {}

export default defineConfig({
  plugins: [vue()],
  define: { __BUILD__: JSON.stringify(BUILD) },
  base: './',
  build: { outDir: '../website/dist', emptyOutDir: true },
  server: { proxy: { '/api': BACKEND, '^/[\\w-]+\\.json$': BACKEND } },
})
