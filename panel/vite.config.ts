import { defineConfig } from 'vite'
import { configDefaults } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          supabase: ['@supabase/supabase-js'],
          animaciones: ['framer-motion'],
        },
      },
    },
  },
  server: { port: 5173 },
  // tests/e2e son de Playwright (npx playwright test), no de Vitest
  test: { environment: 'node', exclude: [...configDefaults.exclude, 'tests/e2e/**'] },
})