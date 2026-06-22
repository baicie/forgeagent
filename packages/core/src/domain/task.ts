import { z } from 'zod'

export const TaskStatusSchema = z.enum([
  'created',
  'preparing',
  'running',
  'waiting_approval',
  'completed',
  'failed',
  'cancelled',
  'applied',
  'committed',
  'discarded',
])

export type TaskStatus = z.infer<typeof TaskStatusSchema>

export const TaskSchema = z.object({
  id: z.string().min(1),
  workspaceId: z.string().min(1),
  prompt: z.string().min(1),
  status: TaskStatusSchema,
  baseBranch: z.string().min(1),
  baseCommit: z.string().min(1),
  worktreePath: z.string().min(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export type Task = z.infer<typeof TaskSchema>

export const CreateTaskInputSchema = z.object({
  workspaceId: z.string().min(1),
  prompt: z.string().min(1),
})

export type CreateTaskInput = z.infer<typeof CreateTaskInputSchema>

const TASK_STATUS_TRANSITIONS: Record<TaskStatus, readonly TaskStatus[]> = {
  created: ['preparing', 'cancelled', 'failed'],
  preparing: ['running', 'cancelled', 'failed'],
  running: ['waiting_approval', 'completed', 'cancelled', 'failed'],
  waiting_approval: ['running', 'cancelled', 'failed'],
  completed: ['applied', 'committed', 'discarded'],
  failed: ['discarded'],
  cancelled: ['discarded'],
  applied: [],
  committed: [],
  discarded: [],
}

export function canTransitionTaskStatus(
  from: TaskStatus,
  to: TaskStatus,
): boolean {
  return TASK_STATUS_TRANSITIONS[from].includes(to)
}

export function getAllowedTaskStatusTransitions(
  from: TaskStatus,
): readonly TaskStatus[] {
  return TASK_STATUS_TRANSITIONS[from]
}
