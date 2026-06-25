import { z } from 'zod'

export const TaskMemoryFileNameSchema = z.enum([
  'task_plan.md',
  'progress.md',
  'findings.md',
  'decisions.md',
  'changed_files.md',
  'test_results.md',
  'context_pack.md',
  'final_summary.md',
])

export type TaskMemoryFileName = z.infer<typeof TaskMemoryFileNameSchema>

export const TASK_MEMORY_FILES = TaskMemoryFileNameSchema.options

export const TaskMemoryFileSchema = z.object({
  file: TaskMemoryFileNameSchema,
  content: z.string(),
  bytes: z.number().int().nonnegative(),
  updatedAt: z.string().datetime().optional(),
})

export type TaskMemoryFile = z.infer<typeof TaskMemoryFileSchema>

export const TaskMemorySnapshotSchema = z.object({
  taskId: z.string().min(1),
  runDir: z.string().min(1),
  files: z.array(TaskMemoryFileSchema),
})

export type TaskMemorySnapshot = z.infer<typeof TaskMemorySnapshotSchema>

export const MemoryUpdatedEventPayloadSchema = z.object({
  file: TaskMemoryFileNameSchema,
  bytes: z.number().int().nonnegative(),
  reason: z.string().optional(),
})

export type MemoryUpdatedEventPayload = z.infer<
  typeof MemoryUpdatedEventPayloadSchema
>

export function parseTaskMemoryFileName(input: string): TaskMemoryFileName {
  return TaskMemoryFileNameSchema.parse(input)
}
