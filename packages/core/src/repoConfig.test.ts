import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')

async function readRootPackageJson() {
  const content = await readFile(resolve(repoRoot, 'package.json'), 'utf8')

  return JSON.parse(content) as {
    'simple-git-hooks'?: Record<string, string>
    'lint-staged'?: Record<string, unknown>
  }
}

describe('root package toolchain config', () => {
  it('does not configure simple-git-hooks to recursively call git hook files', async () => {
    const packageJson = await readRootPackageJson()
    const hooks = packageJson['simple-git-hooks']

    expect(hooks).toBeDefined()
    expect(hooks?.['pre-commit']).toBe('pnpm exec lint-staged')
    expect(hooks?.['pre-commit']).not.toContain('.git/hooks')
    expect(hooks).not.toHaveProperty('commit-msg')
  })

  it('keeps lint-staged config valid and covers TSX console files', async () => {
    const packageJson = await readRootPackageJson()
    const lintStaged = packageJson['lint-staged']

    expect(lintStaged).toBeDefined()
    expect(lintStaged).not.toHaveProperty('*')

    const lintKeys = Object.keys(lintStaged ?? {})
    const scriptKey = lintKeys.find(key => key.includes('tsx'))

    expect(scriptKey).toBeDefined()
    expect(scriptKey).toContain('jsx')
    expect(scriptKey).toContain('ts')
    expect(scriptKey).toContain('tsx')

    const commands = lintStaged?.[scriptKey ?? '']

    expect(commands).toEqual([
      'prettier --write --cache --cache-location node_modules/.cache/.prettiercache',
      'eslint --cache --cache-location node_modules/.cache/.eslintcache',
    ])
  })
})
