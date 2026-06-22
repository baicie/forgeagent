import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { MAX_READ_FILE_BYTES } from './common'
import { readFileTool } from './readFile'
import { createToolTestFixture } from './test-fixture'

describe('readFileTool', () => {
  it('reads a file inside task worktree', async () => {
    const fixture = await createToolTestFixture()

    try {
      await writeFile(
        join(fixture.task.worktreePath, 'src.ts'),
        'export const value = 1\n',
        'utf-8',
      )

      const result = await readFileTool(fixture.context, {
        path: 'src.ts',
      })

      expect(result.path).toBe('src.ts')
      expect(result.content).toContain('value = 1')
    } finally {
      await fixture.cleanup()
    }
  })

  it('blocks parent directory escape', async () => {
    const fixture = await createToolTestFixture()

    try {
      await expect(
        readFileTool(fixture.context, {
          path: '../package.json',
        }),
      ).rejects.toMatchObject({
        code: 'PATH_ESCAPE_DETECTED',
      })
    } finally {
      await fixture.cleanup()
    }
  })

  it('blocks sensitive file', async () => {
    const fixture = await createToolTestFixture()

    try {
      await writeFile(
        join(fixture.task.worktreePath, '.env'),
        'SECRET=1\n',
        'utf-8',
      )

      await expect(
        readFileTool(fixture.context, {
          path: '.env',
        }),
      ).rejects.toMatchObject({
        code: 'SENSITIVE_FILE_BLOCKED',
      })
    } finally {
      await fixture.cleanup()
    }
  })

  it('blocks files larger than 200KB', async () => {
    const fixture = await createToolTestFixture()

    try {
      await writeFile(
        join(fixture.task.worktreePath, 'large.txt'),
        'x'.repeat(MAX_READ_FILE_BYTES + 1),
        'utf-8',
      )

      await expect(
        readFileTool(fixture.context, {
          path: 'large.txt',
        }),
      ).rejects.toMatchObject({
        code: 'TOOL_EXECUTION_FAILED',
      })
    } finally {
      await fixture.cleanup()
    }
  })
})
