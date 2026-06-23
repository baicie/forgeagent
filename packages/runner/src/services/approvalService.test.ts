import type { AuditEventType, CreateApprovalInput } from '@forgeagent/core'
import { createInMemoryRunnerDb } from '../db'
import { AuditService } from './auditService'
import { ApprovalService } from './approvalService'
import { EventService } from './eventService'

function createInput(): CreateApprovalInput {
  return {
    taskId: 'task_1',
    toolCallId: 'tool_1',
    command: 'pnpm test',
    cwd: '/tmp/worktree',
    reason: 'verify',
    risk: 'medium',
  }
}

describe('approvalService', () => {
  it('creates approval with event and audit trail', async () => {
    const db = createInMemoryRunnerDb()
    const eventService = new EventService(db)
    const auditService = new AuditService(db)
    const service = new ApprovalService(db, eventService, auditService)

    const appendSpy = vi.spyOn(auditService, 'append')
    const approval = await service.create(createInput())

    expect(approval.id).toMatch(/^approval_/)
    expect(approval.status).toBe('pending')
    expect(db.state.approvals).toHaveLength(1)
    expect(db.state.events).toEqual([
      expect.objectContaining({
        taskId: 'task_1',
        type: 'approval.required',
      }),
    ])
    expect(appendSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: 'task_1',
        type: 'approval.required' as AuditEventType,
      }),
    )
  })

  it('rolls back approval when event or audit creation fails', async () => {
    const db = createInMemoryRunnerDb()
    const eventService = new EventService(db)
    const auditService = new AuditService(db)
    const service = new ApprovalService(db, eventService, auditService)

    vi.spyOn(auditService, 'append').mockRejectedValueOnce(
      new Error('audit failed'),
    )

    await expect(service.create(createInput())).rejects.toThrow('audit failed')

    expect(db.state.approvals).toEqual([])
  })
})
