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

  it('rolls back resolved approval when audit creation fails', async () => {
    const db = createInMemoryRunnerDb()
    const eventService = new EventService(db)
    const auditService = {
      append: vi.fn(async input => {
        if (input.type === 'approval.required') {
          db.state.audits.push({
            id: 'audit_required',
            taskId: input.taskId,
            type: input.type,
            payload: input.payload,
            createdAt: '2026-06-22T00:00:00.000Z',
          })

          return db.state.audits[0]
        }

        throw new Error('audit failed')
      }),
    } as unknown as AuditService

    const service = new ApprovalService(db, eventService, auditService)

    const approval = await service.create({
      taskId: 'task_1',
      toolCallId: 'tool_1',
      command: 'pnpm test',
      cwd: '/tmp/worktree',
      reason: 'verify',
      risk: 'medium',
    })

    await expect(service.approve(approval.id)).rejects.toThrow('audit failed')

    expect(service.get(approval.id).status).toBe('pending')
    expect(service.get(approval.id).resolvedAt).toBeUndefined()

    expect(
      db.state.events.some(
        event =>
          event.type === 'approval.resolved' &&
          event.payload &&
          typeof event.payload === 'object' &&
          'approvalId' in event.payload &&
          event.payload.approvalId === approval.id,
      ),
    ).toBe(false)
  })
})
