import type { Approval } from '@forgeagent/core'
import { createForgeAgentError, isApprovalResolved } from '@forgeagent/core'
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

    approval.status = status
    approval.resolvedAt = new Date().toISOString()

    await this.db.save()

    await this.eventService.append({
      taskId: approval.taskId,
      type: 'approval.resolved',
      payload: {
        approvalId: approval.id,
        status,
      },
    })

    await this.auditService.append({
      taskId: approval.taskId,
      type: status === 'approved' ? 'approval.approved' : 'approval.rejected',
      payload: {
        approvalId: approval.id,
      },
    })

    return approval
  }
}
