import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'

const __dirname = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  plugins: [
    dts({
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts'],
      rollupTypes: true,
    }),
  ],
  build: {
    target: 'node22',
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'ForgeAgentRunner',
      formats: ['es', 'cjs'],
      fileName: format => `index.${format === 'es' ? 'js' : 'cjs'}`,
    },
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
    minify: false,
    rollupOptions: {
      external: [
        'node:crypto',
        'node:fs',
        'node:fs/promises',
        'node:http',
        'node:os',
        'node:path',
        'node:url',
        '@forgeagent/core',
        'fastify',
      ],
      output: {
        preserveModules: false,
      },
    },
  },
})
