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
  | 'task.completed'
  | 'task.failed'

export interface TaskEvent {
  id: string
  taskId: string
  type: TaskEventType
  payload: unknown
  createdAt: string
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
