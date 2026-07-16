import path from 'path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      // Keep in sync with vite.config.ts — the shared packages/core package.
      '@core': path.resolve(__dirname, '../packages/core/src'),
      '@': path.resolve(__dirname, '.'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    exclude: ['**/node_modules/**', 'e2e/**'],
  },
})
