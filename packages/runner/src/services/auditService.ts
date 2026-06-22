import type { AuditEventType, AuditLog } from '@forgeagent/core'
import { randomUUID } from 'node:crypto'
import type { RunnerDb } from '../db'

export interface CreateAuditInput {
  taskId?: string
  type: AuditEventType
  payload: unknown
}

export class AuditService {
  constructor(private readonly db: RunnerDb) {}

  list(): AuditLog[] {
    return this.db.state.audits
  }

  async append(input: CreateAuditInput): Promise<AuditLog> {
    const audit: AuditLog = {
      id: `audit_${randomUUID()}`,
      taskId: input.taskId,
      type: input.type,
      payload: input.payload,
      createdAt: new Date().toISOString(),
    }

    this.db.state.audits.push(audit)
    await this.db.save()

    return audit
  }
}
