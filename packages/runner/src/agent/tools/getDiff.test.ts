import { applyPatchTool } from './applyPatch'
import { getDiffTool } from './getDiff'
import { createToolTestFixture } from './test-fixture'

describe('getDiffTool', () => {
  it('reads git diff from task worktree', async () => {
    const fixture = await createToolTestFixture()

    try {
      await applyPatchTool(fixture.context, {
        changes: [
          {
            type: 'write_file',
            path: 'README.md',
            content: '# Changed by ForgeAgent\n',
          },
        ],
      })

      const result = await getDiffTool(fixture.context, {})

      expect(result.taskId).toBe(fixture.task.id)
      expect(result.diff).toContain('README.md')
      expect(result.diff).toContain('Changed by ForgeAgent')
    } finally {
      await fixture.cleanup()
    }
  })
})
