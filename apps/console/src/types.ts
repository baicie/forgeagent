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
