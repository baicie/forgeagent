import { z } from 'zod'
import { TaskStatusSchema } from './task'
import { MemoryUpdatedEventPayloadSchema } from './taskMemory'
import {
  ToolFinishedEventPayloadSchema,
  ToolStartedEventPayloadSchema,
} from './tool'

export const TaskEventTypeSchema = z.enum([
  'task.status',
  'agent.message',
  'tool.started',
  'tool.output',
  'tool.finished',
  'approval.required',
  'approval.resolved',
  'diff.updated',
  'memory.updated',
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

export const ToolOutputEventPayloadSchema = z
  .object({
    toolName: z.string().min(1).optional(),
    output: z.unknown().optional(),
    chunk: z.string().optional(),
  })
  .passthrough()

export const ApprovalRequiredEventPayloadSchema = z
  .object({
    approvalId: z.string().min(1).optional(),
    toolName: z.string().min(1).optional(),
    args: z.unknown().optional(),
  })
  .passthrough()

export const ApprovalResolvedEventPayloadSchema = z
  .object({
    approvalId: z.string().min(1).optional(),
    status: z.enum(['approved', 'rejected']).optional(),
  })
  .passthrough()

export const DiffUpdatedEventPayloadSchema = z.object({
  changed: z.boolean(),
  bytes: z.number().int().nonnegative(),
})

export type DiffUpdatedEventPayload = z.infer<
  typeof DiffUpdatedEventPayloadSchema
>

export const TaskCompletedEventPayloadSchema = z
  .object({
    output: z.unknown().optional(),
  })
  .passthrough()

export const TaskFailedEventPayloadSchema = z
  .object({
    error: z.unknown(),
  })
  .passthrough()

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

export function parseTaskEventPayload(
  type: TaskEventType,
  payload: unknown,
): unknown {
  switch (type) {
    case 'task.status':
      return TaskStatusEventPayloadSchema.parse(payload)

    case 'agent.message':
      return AgentMessageEventPayloadSchema.parse(payload)

    case 'tool.started':
      return ToolStartedEventPayloadSchema.parse(payload)

    case 'tool.output':
      return ToolOutputEventPayloadSchema.parse(payload)

    case 'tool.finished':
      return ToolFinishedEventPayloadSchema.parse(payload)

    case 'approval.required':
      return ApprovalRequiredEventPayloadSchema.parse(payload)

    case 'approval.resolved':
      return ApprovalResolvedEventPayloadSchema.parse(payload)

    case 'diff.updated':
      return DiffUpdatedEventPayloadSchema.parse(payload)

    case 'memory.updated':
      return MemoryUpdatedEventPayloadSchema.parse(payload)

    case 'task.completed':
      return TaskCompletedEventPayloadSchema.parse(payload)

    case 'task.failed':
      return TaskFailedEventPayloadSchema.parse(payload)
  }
}

export function parseCreateTaskEventInput(
  input: CreateTaskEventInput,
): CreateTaskEventInput {
  const parsedInput = CreateTaskEventInputSchema.parse(input)

  return {
    ...parsedInput,
    payload: parseTaskEventPayload(parsedInput.type, parsedInput.payload),
  }
}
