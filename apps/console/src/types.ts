export type TaskStatus =
  | 'created'
  | 'preparing'
  | 'running'
  | 'waiting_approval'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'applied'
  | 'committed'
  | 'discarded'

export interface Workspace {
  id: string
  name: string
  repoPath: string
  gitRoot: string
  currentBranch?: string
  currentCommit?: string
  createdAt: string
  updatedAt: string
}

export interface Task {
  id: string
  workspaceId: string
  prompt: string
  status: TaskStatus
  baseBranch: string
  baseCommit: string
  workspaceSnapshotHash?: string
  worktreePath: string
  createdAt: string
  updatedAt: string
}

export type TaskEventType =
  | 'task.status'
  | 'agent.message'
  | 'tool.started'
  | 'tool.output'
  | 'tool.finished'
  | 'approval.required'
  | 'approval.resolved'
  | 'diff.updated'
  | 'memory.updated'
  | 'task.completed'
  | 'task.failed'
  | 'validation.planned'
  | 'validation.started'
  | 'validation.finished'

export interface TaskEvent {
  id: string
  taskId: string
  type: TaskEventType
  payload: unknown
  createdAt: string
}

export type TaskMemoryFileName =
  | 'task_plan.md'
  | 'progress.md'
  | 'findings.md'
  | 'decisions.md'
  | 'changed_files.md'
  | 'test_results.md'
  | 'final_summary.md'

export interface TaskMemoryFile {
  file: TaskMemoryFileName
  content: string
  bytes: number
  updatedAt?: string
}

export interface TaskMemorySnapshot {
  taskId: string
  runDir: string
  files: TaskMemoryFile[]
}

export type ToolSource = 'core' | 'mcp' | 'plugin'
export type ToolType = 'read' | 'write' | 'execute'
export type ToolPermission = 'allowed' | 'requires_approval' | 'denied'
export type ToolApprovalStatus =
  | 'not_required'
  | 'pending'
  | 'approved'
  | 'denied'

export interface ToolEventPayload {
  toolCallId?: string
  toolName?: string
  displayName?: string
  source?: ToolSource
  type?: ToolType
  permission?: ToolPermission
  requiresApproval?: boolean
  approvalStatus?: ToolApprovalStatus
  args?: unknown
  result?: unknown
  error?: string
  command?: string
  cwd?: string
  approvalId?: string
  risk?: string
  riskColor?: string
  ok?: boolean
  rejected?: boolean
}

export interface ApprovalPayload {
  approvalId?: string
  toolCallId?: string
  command?: string
  cwd?: string
  reason?: string
  risk?: 'low' | 'medium' | 'high' | 'dangerous'
  status?: 'approved' | 'rejected'
}

export interface DiffResult {
  taskId: string
  diff: string
}

export interface ListResponse<T> {
  items: T[]
}

export interface ApiErrorPayload {
  error: {
    code: string
    message: string
    details?: unknown
  }
}

export interface ValidationResult {
  command: string
  cwd: string
  status:
    | 'pending'
    | 'waiting_approval'
    | 'running'
    | 'passed'
    | 'failed'
    | 'rejected'
    | 'skipped'
  ok?: boolean
  approvalId?: string
  exitCode?: number | null
  timedOut?: boolean
  stdout?: string
  stderr?: string
  error?: string
  startedAt?: string
  finishedAt?: string
}

export interface ValidationPlan {
  taskId: string
  commands: Array<{
    command: string
    cwd: string
    reason: string
  }>
  maxFixAttempts: number
  fixAttempt: number
  status:
    | 'pending'
    | 'waiting_approval'
    | 'running'
    | 'passed'
    | 'failed'
    | 'rejected'
    | 'skipped'
  results: ValidationResult[]
  createdAt: string
  updatedAt: string
}

export interface ValidationSummary {
  status: ValidationPlan['status']
  passed: number
  failed: number
  rejected: number
  total: number
  fixAttempt: number
  maxFixAttempts: number
  failureSummary?: string
}
