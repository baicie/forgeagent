import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { listFilesTool } from './listFiles'
import { createToolTestFixture } from './test-fixture'

describe('listFilesTool', () => {
  it('lists files in task worktree', async () => {
    const fixture = await createToolTestFixture()

    try {
      await mkdir(join(fixture.task.worktreePath, 'src'), {
        recursive: true,
      })
      await writeFile(
        join(fixture.task.worktreePath, 'src/index.ts'),
        'export {}\n',
        'utf-8',
      )

      const result = await listFilesTool(fixture.context, {
        path: '.',
        recursive: true,
      })

      expect(result.entries).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: 'src',
            type: 'directory',
          }),
          expect.objectContaining({
            path: 'src/index.ts',
            type: 'file',
          }),
        ]),
      )
    } finally {
      await fixture.cleanup()
    }
  })

  it('does not list ignored or sensitive paths', async () => {
    const fixture = await createToolTestFixture()

    try {
      await mkdir(join(fixture.task.worktreePath, 'node_modules/pkg'), {
        recursive: true,
      })
      await writeFile(
        join(fixture.task.worktreePath, 'node_modules/pkg/index.js'),
        'ignored',
        'utf-8',
      )
      await writeFile(join(fixture.task.worktreePath, '.env'), 'SECRET=1')

      const result = await listFilesTool(fixture.context, {
        path: '.',
        recursive: true,
      })

      expect(result.entries.some(entry => entry.path.includes('.env'))).toBe(
        false,
      )
      expect(
        result.entries.some(entry => entry.path.includes('node_modules')),
      ).toBe(false)
    } finally {
      await fixture.cleanup()
    }
  })
})
