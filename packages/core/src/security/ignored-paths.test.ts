import { isIgnoredPath } from './ignored-paths'

describe('isIgnoredPath', () => {
  it.each([
    'node_modules/react/index.js',
    'dist/index.js',
    'build/app.js',
    'coverage/index.html',
    '.next/server/app.js',
    '.nuxt/app.js',
    '.turbo/cache',
    '.cache/vite',
    '.git/config',
    'packages/core/node_modules/zod/index.js',
  ])('marks %s as ignored', targetPath => {
    expect(isIgnoredPath(targetPath)).toBe(true)
  })

  it.each([
    'src/index.ts',
    'README.md',
    'docs/runner.md',
    'packages/core/src/domain/task.ts',
  ])('does not mark %s as ignored', targetPath => {
    expect(isIgnoredPath(targetPath)).toBe(false)
  })
})
