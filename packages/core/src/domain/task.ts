import { z } from 'zod'
import { TaskValidationInputSchema } from './validation'

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
  workflowId: z.string().optional(),
  workflowStepId: z.string().optional(),
  baseBranch: z.string().min(1),
  baseCommit: z.string().min(1),
  workspaceSnapshotHash: z.string().length(64).optional(),
  worktreePath: z.string().min(1),
  validation: TaskValidationInputSchema.optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export type Task = z.infer<typeof TaskSchema>

export const CreateTaskInputSchema = z.object({
  workspaceId: z.string().min(1),
  prompt: z.string().min(1),
  workflowId: z.string().optional(),
  validation: TaskValidationInputSchema.optional(),
})

export type CreateTaskInput = z.infer<typeof CreateTaskInputSchema>

export const TaskStatusTransitionSchema = z.object({
  taskId: z.string().min(1),
  from: TaskStatusSchema,
  to: TaskStatusSchema,
  reason: z.string().optional(),
  createdAt: z.string().datetime(),
})

export type TaskStatusTransition = z.infer<typeof TaskStatusTransitionSchema>

export const TASK_STATUS_TRANSITIONS: Record<
  TaskStatus,
  readonly TaskStatus[]
> = {
  created: ['preparing', 'cancelled', 'discarded'],
  preparing: ['running', 'failed', 'cancelled', 'discarded'],
  running: [
    'waiting_approval',
    'completed',
    'failed',
    'cancelled',
    'discarded',
  ],
  waiting_approval: ['running', 'failed', 'cancelled', 'discarded'],
  completed: ['applied', 'committed', 'discarded'],
  failed: ['discarded'],
  cancelled: ['discarded'],
  applied: [],
  committed: [],
  discarded: [],
}

export const TASK_TERMINAL_STATUSES = [
  'applied',
  'committed',
  'discarded',
] as const satisfies readonly TaskStatus[]

export const TASK_FINISHED_STATUSES = [
  'completed',
  'failed',
  'cancelled',
  'applied',
  'committed',
  'discarded',
] as const satisfies readonly TaskStatus[]

export function canTransitionTaskStatus(
  from: TaskStatus,
  to: TaskStatus,
): boolean {
  return TASK_STATUS_TRANSITIONS[from].includes(to)
}

export function assertTaskStatusTransition(
  from: TaskStatus,
  to: TaskStatus,
): void {
  if (!canTransitionTaskStatus(from, to)) {
    throw new Error(`Invalid task status transition: ${from} -> ${to}`)
  }
}

export function getAllowedTaskStatusTransitions(
  from: TaskStatus,
): readonly TaskStatus[] {
  return TASK_STATUS_TRANSITIONS[from]
}

export function isTaskTerminalStatus(status: TaskStatus): boolean {
  return TASK_TERMINAL_STATUSES.includes(
    status as (typeof TASK_TERMINAL_STATUSES)[number],
  )
}

export function isTaskFinishedStatus(status: TaskStatus): boolean {
  return TASK_FINISHED_STATUSES.includes(
    status as (typeof TASK_FINISHED_STATUSES)[number],
  )
}
