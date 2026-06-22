import { runCommandTool } from './runCommand'
import { createToolTestFixture } from './test-fixture'

describe('runCommandTool', () => {
  it('creates approval and moves task to waiting_approval', async () => {
    const fixture = await createToolTestFixture()

    try {
      const result = await runCommandTool(fixture.context, {
        command: 'pnpm test',
        reason: 'verify changes',
      })

      expect(result.status).toBe('waiting_approval')
      expect(result.approvalId).toMatch(/^approval_/)
      expect(result.command).toBe('pnpm test')

      const task = fixture.taskService.get(fixture.task.id)

      expect(task.status).toBe('waiting_approval')

      const approval = fixture.approvalService.get(result.approvalId)

      expect(approval.command).toBe('pnpm test')
      expect(approval.reason).toBe('verify changes')
      expect(approval.status).toBe('pending')
    } finally {
      await fixture.cleanup()
    }
  })

  it('marks dangerous command risk but still only creates approval', async () => {
    const fixture = await createToolTestFixture()

    try {
      const result = await runCommandTool(fixture.context, {
        command: 'rm -rf dist',
        reason: 'clean dist',
      })

      expect(result.risk).toBe('dangerous')

      const approval = fixture.approvalService.get(result.approvalId)

      expect(approval.status).toBe('pending')
      expect(approval.risk).toBe('dangerous')
    } finally {
      await fixture.cleanup()
    }
  })

  it('blocks cwd outside task worktree', async () => {
    const fixture = await createToolTestFixture()

    try {
      await expect(
        runCommandTool(fixture.context, {
          command: 'pnpm test',
          cwd: '..',
          reason: 'verify',
        }),
      ).rejects.toMatchObject({
        code: 'PATH_ESCAPE_DETECTED',
      })
    } finally {
      await fixture.cleanup()
    }
  })
})
