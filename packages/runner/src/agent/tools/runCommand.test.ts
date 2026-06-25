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
  }, 20000)

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
  }, 20000)

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
  }, 20000)

  it('rejects terminal task status before creating approval', async () => {
    const fixture = await createToolTestFixture()

    try {
      await fixture.taskService.prepare(fixture.task.id)
      await fixture.taskService.start(fixture.task.id)
      await fixture.taskService.complete(fixture.task.id)

      const approvalsBefore = fixture.approvalService.list().length

      await expect(
        runCommandTool(fixture.context, {
          command: 'pnpm test',
          reason: 'verify after completion',
        }),
      ).rejects.toMatchObject({
        code: 'TASK_NOT_RUNNING',
      })

      expect(fixture.approvalService.list()).toHaveLength(approvalsBefore)
    } finally {
      await fixture.cleanup()
    }
  }, 20000)

  it('keeps approval and task state consistent when task is already waiting_approval', async () => {
    const fixture = await createToolTestFixture()

    try {
      await runCommandTool(fixture.context, {
        command: 'pnpm test',
        reason: 'first approval',
      })

      const second = await runCommandTool(fixture.context, {
        command: 'pnpm build',
        reason: 'second approval',
      })

      expect(second.status).toBe('waiting_approval')
      expect(fixture.taskService.get(fixture.task.id).status).toBe(
        'waiting_approval',
      )

      expect(fixture.approvalService.get(second.approvalId)).toMatchObject({
        command: 'pnpm build',
        status: 'pending',
      })
    } finally {
      await fixture.cleanup()
    }
  }, 20000)

  it('uses injected toolCallId when creating approval', async () => {
    const fixture = await createToolTestFixture()

    try {
      const result = await runCommandTool(fixture.context, {
        command: 'pnpm test',
        reason: 'verify changes',
        toolCallId: 'tool_registry_1',
      })

      const approval = fixture.approvalService.get(result.approvalId)

      expect(approval.toolCallId).toBe('tool_registry_1')
    } finally {
      await fixture.cleanup()
    }
  }, 20000)
})
