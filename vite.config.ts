import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Base path (relative for broad compatibility: Vercel & GH Pages)
  base: './',
  build: {
    outDir: 'dist',
  }
})