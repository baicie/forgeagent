import { z } from 'zod'

export const AuditEventTypeSchema = z.enum([
  'task.created',
  'task.status_changed',
  'task.deleted',
  'tool.started',
  'tool.finished',
  'approval.required',
  'approval.approved',
  'approval.rejected',
  'command.started',
  'command.finished',
  'file.changed',
  'diff.generated',
  'task.applied',
  'task.committed',
  'task.discarded',
])

export type AuditEventType = z.infer<typeof AuditEventTypeSchema>

export const AuditLogSchema = z.object({
  id: z.string().min(1),
  taskId: z.string().min(1).optional(),
  type: AuditEventTypeSchema,
  payload: z.unknown(),
  createdAt: z.string().datetime(),
})

export type AuditLog = z.infer<typeof AuditLogSchema>

export const CreateAuditLogInputSchema = AuditLogSchema.omit({
  id: true,
  createdAt: true,
})

export type CreateAuditLogInput = z.infer<typeof CreateAuditLogInputSchema>
