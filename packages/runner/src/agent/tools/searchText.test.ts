import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { searchTextTool } from './searchText'
import { createToolTestFixture } from './test-fixture'

describe('searchTextTool', () => {
  it('searches text inside worktree and limits results', async () => {
    const fixture = await createToolTestFixture()

    try {
      await writeFile(
        join(fixture.task.worktreePath, 'a.txt'),
        'hello forgeagent\nhello again\n',
        'utf-8',
      )

      await writeFile(
        join(fixture.task.worktreePath, 'b.txt'),
        'hello runner\n',
        'utf-8',
      )

      const result = await searchTextTool(fixture.context, {
        query: 'hello',
        maxResults: 2,
      })

      expect(result.matches).toHaveLength(2)
      expect(result.truncated).toBe(true)
    } finally {
      await fixture.cleanup()
    }
  })

  it('skips sensitive files', async () => {
    const fixture = await createToolTestFixture()

    try {
      await writeFile(
        join(fixture.task.worktreePath, '.env'),
        'TOKEN=forgeagent\n',
        'utf-8',
      )

      const result = await searchTextTool(fixture.context, {
        query: 'TOKEN',
      })

      expect(result.matches).toEqual([])
    } finally {
      await fixture.cleanup()
    }
  })
})
