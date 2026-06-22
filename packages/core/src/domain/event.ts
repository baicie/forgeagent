import { z } from 'zod'

export const TaskEventTypeSchema = z.enum([
  'task.status',
  'agent.message',
  'tool.started',
  'tool.output',
  'tool.finished',
  'approval.required',
  'approval.resolved',
  'diff.updated',
  'task.completed',
  'task.failed',
])

export type TaskEventType = z.infer<typeof TaskEventTypeSchema>

export const TaskEventSchema = z.object({
  id: z.string().min(1),
  taskId: z.string().min(1),
  type: TaskEventTypeSchema,
  payload: z.unknown(),
  createdAt: z.string().datetime(),
})

export type TaskEvent = z.infer<typeof TaskEventSchema>

export const CreateTaskEventInputSchema = TaskEventSchema.omit({
  id: true,
  createdAt: true,
})

export type CreateTaskEventInput = z.infer<typeof CreateTaskEventInputSchema>
