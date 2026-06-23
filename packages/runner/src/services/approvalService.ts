import type {
  Approval,
  AuditLog,
  CreateApprovalInput,
  TaskEvent,
} from '@forgeagent/core'
import { createForgeAgentError, isApprovalResolved } from '@forgeagent/core'
import { randomUUID } from 'node:crypto'
import type { RunnerDb } from '../db'
import type { AuditService } from './auditService'
import type { EventService } from './eventService'

export class ApprovalService {
  constructor(
    private readonly db: RunnerDb,
    private readonly eventService: EventService,
    private readonly auditService: AuditService,
  ) {}

  list(): Approval[] {
    return this.db.state.approvals
  }

  get(id: string): Approval {
    const approval = this.db.state.approvals.find(item => item.id === id)

    if (!approval) {
      throw createForgeAgentError(
        'APPROVAL_NOT_FOUND',
        `Approval not found: ${id}`,
        { id },
      )
    }

    return approval
  }

  async create(input: CreateApprovalInput): Promise<Approval> {
    const approval: Approval = {
      id: `approval_${randomUUID()}`,
      taskId: input.taskId,
      toolCallId: input.toolCallId,
      command: input.command,
      cwd: input.cwd,
      reason: input.reason,
      risk: input.risk,
      status: 'pending',
      createdAt: new Date().toISOString(),
    }

    this.db.state.approvals.push(approval)

    try {
      await this.db.save()

      await this.eventService.append({
        taskId: approval.taskId,
        type: 'approval.required',
        payload: {
          approvalId: approval.id,
          toolCallId: approval.toolCallId,
          command: approval.command,
          cwd: approval.cwd,
          reason: approval.reason,
          risk: approval.risk,
        },
      })

      await this.auditService.append({
        taskId: approval.taskId,
        type: 'approval.required',
        payload: {
          approvalId: approval.id,
          toolCallId: approval.toolCallId,
          command: approval.command,
          cwd: approval.cwd,
          reason: approval.reason,
          risk: approval.risk,
        },
      })

      return approval
    } catch (error) {
      await this.rollbackCreate(approval.id)

      throw error
    }
  }

  async approve(id: string): Promise<Approval> {
    return this.resolve(id, 'approved')
  }

  async reject(id: string): Promise<Approval> {
    return this.resolve(id, 'rejected')
  }

  private async resolve(
    id: string,
    status: 'approved' | 'rejected',
  ): Promise<Approval> {
    const approval = this.get(id)

    if (isApprovalResolved(approval.status)) {
      throw createForgeAgentError(
        'APPROVAL_ALREADY_RESOLVED',
        `Approval already resolved: ${id}`,
        {
          id,
          status: approval.status,
        },
      )
    }

    const previousStatus = approval.status
    const previousResolvedAt = approval.resolvedAt

    let resolvedEvent: TaskEvent | undefined
    let auditLog: AuditLog | undefined

    approval.status = status
    approval.resolvedAt = new Date().toISOString()

    try {
      await this.db.save()

      resolvedEvent = await this.eventService.append({
        taskId: approval.taskId,
        type: 'approval.resolved',
        payload: {
          approvalId: approval.id,
          status,
        },
      })

      auditLog = await this.auditService.append({
        taskId: approval.taskId,
        type: status === 'approved' ? 'approval.approved' : 'approval.rejected',
        payload: {
          approvalId: approval.id,
        },
      })

      return approval
    } catch (error) {
      approval.status = previousStatus

      if (previousResolvedAt === undefined) {
        delete approval.resolvedAt
      } else {
        approval.resolvedAt = previousResolvedAt
      }

      if (resolvedEvent) {
        this.db.state.events = this.db.state.events.filter(
          event => event.id !== resolvedEvent!.id,
        )
      }

      if (auditLog) {
        this.db.state.audits = this.db.state.audits.filter(
          audit => audit.id !== auditLog!.id,
        )
      }

      try {
        await this.db.save()
      } catch {
        // Keep original resolve() error.
      }

      throw error
    }
  }

  private async rollbackCreate(id: string): Promise<void> {
    this.db.state.approvals = this.db.state.approvals.filter(
      approval => approval.id !== id,
    )

    try {
      await this.db.save()
    } catch {
      // Keep the original create() error.
    }
  }
}
