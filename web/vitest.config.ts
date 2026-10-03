import path from 'path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    // Keep in sync with vite.config.ts — the shared packages/core package, and
    // the exact-match 'react' entry that lets @core/react/* resolve React from
    // this app rather than from packages/core, which has no node_modules react.
    alias: [
      { find: '@core', replacement: path.resolve(__dirname, '../packages/core/src') },
      { find: '@', replacement: path.resolve(__dirname, '.') },
      { find: /^react$/, replacement: path.resolve(__dirname, 'node_modules/react') },
    ],
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    exclude: ['**/node_modules/**', 'e2e/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.d.ts',
        'src/**/__tests__/**',
        'src/test/**',
        'src/app/**',
      ],
    },
  },
})
