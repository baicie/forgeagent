import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { applyPatchTool } from './applyPatch'
import { createToolTestFixture } from './test-fixture'

describe('applyPatchTool', () => {
  it('writes a file inside task worktree', async () => {
    const fixture = await createToolTestFixture()

    try {
      const result = await applyPatchTool(fixture.context, {
        changes: [
          {
            type: 'write_file',
            path: 'src/index.ts',
            content: 'export const value = 1\n',
          },
        ],
      })

      expect(result.changedFiles).toEqual(['src/index.ts'])

      await expect(
        readFile(join(fixture.task.worktreePath, 'src/index.ts'), 'utf-8'),
      ).resolves.toContain('value = 1')
    } finally {
      await fixture.cleanup()
    }
  })

  it('replaces text inside task worktree', async () => {
    const fixture = await createToolTestFixture()

    try {
      await applyPatchTool(fixture.context, {
        changes: [
          {
            type: 'write_file',
            path: 'README.md',
            content: '# Old\n',
          },
        ],
      })

      await applyPatchTool(fixture.context, {
        changes: [
          {
            type: 'replace_text',
            path: 'README.md',
            search: '# Old',
            replace: '# New',
          },
        ],
      })

      await expect(
        readFile(join(fixture.task.worktreePath, 'README.md'), 'utf-8'),
      ).resolves.toContain('# New')
    } finally {
      await fixture.cleanup()
    }
  })

  it('blocks writing outside task worktree', async () => {
    const fixture = await createToolTestFixture()

    try {
      await expect(
        applyPatchTool(fixture.context, {
          changes: [
            {
              type: 'write_file',
              path: '../outside.ts',
              content: 'bad',
            },
          ],
        }),
      ).rejects.toMatchObject({
        code: 'PATH_ESCAPE_DETECTED',
      })
    } finally {
      await fixture.cleanup()
    }
  })
})
