import type {
  Approval,
  CommandRiskLevel,
  Task,
  Workspace,
} from '@forgeagent/core'

export interface ToolTaskService {
  get: (id: string) => Task
  prepare: (id: string, reason?: string) => Promise<Task>
  start: (id: string, reason?: string) => Promise<Task>
  waitForApproval: (id: string, reason?: string) => Promise<Task>
  getDiff: (id: string) => Promise<{ taskId: string; diff: string }>
  notifyDiffChanged: (id: string) => Promise<void>
}

export interface ToolApprovalService {
  create: (input: {
    taskId: string
    toolCallId: string
    command: string
    cwd: string
    reason: string
    risk: CommandRiskLevel
  }) => Promise<Approval>
}

export interface RunnerToolContext {
  task: Task
  workspace: Workspace
  worktreePath: string
  taskService: ToolTaskService
  approvalService: ToolApprovalService
}

export interface RunnerToolResult<T = unknown> {
  ok: boolean
  data?: T
  error?: unknown
}
