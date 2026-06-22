import { z } from 'zod'
import { CommandRiskLevelSchema } from './tool'

export const ApprovalStatusSchema = z.enum(['pending', 'approved', 'rejected'])

export type ApprovalStatus = z.infer<typeof ApprovalStatusSchema>

export const ApprovalSchema = z.object({
  id: z.string().min(1),
  taskId: z.string().min(1),
  toolCallId: z.string().min(1),
  command: z.string().min(1),
  cwd: z.string().min(1),
  reason: z.string().min(1),
  risk: CommandRiskLevelSchema,
  status: ApprovalStatusSchema,
  createdAt: z.string().datetime(),
  resolvedAt: z.string().datetime().optional(),
})

export type Approval = z.infer<typeof ApprovalSchema>

export const CreateApprovalInputSchema = ApprovalSchema.omit({
  id: true,
  status: true,
  createdAt: true,
  resolvedAt: true,
})

export type CreateApprovalInput = z.infer<typeof CreateApprovalInputSchema>

export function isApprovalResolved(status: ApprovalStatus): boolean {
  return status === 'approved' || status === 'rejected'
}
