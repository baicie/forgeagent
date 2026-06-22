import { z } from 'zod'
import { TaskStatusSchema } from './task'

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

export const TaskStatusEventPayloadSchema = z.object({
  previousStatus: TaskStatusSchema.optional(),
  status: TaskStatusSchema,
  reason: z.string().optional(),
})

export type TaskStatusEventPayload = z.infer<
  typeof TaskStatusEventPayloadSchema
>

export const AgentMessageEventPayloadSchema = z.object({
  message: z.string(),
  role: z.enum(['assistant', 'system']).default('assistant'),
})

export type AgentMessageEventPayload = z.infer<
  typeof AgentMessageEventPayloadSchema
>

export const DiffUpdatedEventPayloadSchema = z.object({
  changed: z.boolean(),
  bytes: z.number().int().nonnegative(),
})

export type DiffUpdatedEventPayload = z.infer<
  typeof DiffUpdatedEventPayloadSchema
>

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
