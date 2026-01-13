import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Use relative base path to ensure it works on GitHub Pages sub-directories
  // Base path for GitHub Pages (repo name)
  base: '/keep-fit/',
  build: {
    outDir: 'dist',
  }
})