import type { RunnerConfig } from './config'
import type { RunnerDb } from './db'
import { ApprovalService } from './services/approvalService'
import { AuditService } from './services/auditService'
import { EventService } from './services/eventService'
import { TaskService } from './services/taskService'
import { WorkspaceService } from './services/workspaceService'

export interface RunnerContext {
  config: RunnerConfig
  db: RunnerDb
  workspaceService: WorkspaceService
  taskService: TaskService
  eventService: EventService
  approvalService: ApprovalService
  auditService: AuditService
}

export function createRunnerContext(
  config: RunnerConfig,
  db: RunnerDb,
): RunnerContext {
  const eventService = new EventService(db)
  const auditService = new AuditService(db)
  const workspaceService = new WorkspaceService(db)
  const taskService = new TaskService(
    db,
    workspaceService,
    eventService,
    auditService,
  )
  const approvalService = new ApprovalService(db, eventService, auditService)

  return {
    config,
    db,
    workspaceService,
    taskService,
    eventService,
    approvalService,
    auditService,
  }
}
