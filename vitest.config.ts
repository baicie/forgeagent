import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['packages/**/*.test.ts', 'apps/**/*.test.ts'],
    alias: {
      '@forgeagent/core': resolve(
        import.meta.dirname,
        'packages/core/src/index.ts',
      ),
      '@forgeagent/runner': resolve(
        import.meta.dirname,
        'packages/runner/src/index.ts',
      ),
    },
  },
})
