import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Auto-detect deployment environment:
  // - Vercel: use root path '/'
  // - GitHub Pages: use '/keep-fit/'
  base: process.env.VERCEL ? '/' : '/keep-fit/',
  build: {
    outDir: 'dist',
  }
})