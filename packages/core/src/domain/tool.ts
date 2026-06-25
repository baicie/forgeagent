import { z } from 'zod'

// ---------------------------------------------------------------------------
// Legacy schemas (kept for ApprovalGate / existing code compatibility)
// ---------------------------------------------------------------------------

export const ToolPermissionSchema = z.enum([
  'read',
  'write',
  'shell',
  'git',
  'network',
  'dangerous',
])

export type ToolPermission = z.infer<typeof ToolPermissionSchema>

export const CommandRiskLevelSchema = z.enum([
  'low',
  'medium',
  'high',
  'dangerous',
])

export type CommandRiskLevel = z.infer<typeof CommandRiskLevelSchema>

export const ToolCallSchema = z.object({
  id: z.string().min(1),
  taskId: z.string().min(1),
  name: z.string().min(1),
  args: z.unknown(),
  requiresApproval: z.boolean(),
  createdAt: z.string().datetime(),
})

export type ToolCall = z.infer<typeof ToolCallSchema>

export const ToolResultSchema = z.object({
  toolCallId: z.string().min(1),
  ok: z.boolean(),
  result: z.unknown().optional(),
  error: z.unknown().optional(),
  createdAt: z.string().datetime(),
})

export type ToolResult = z.infer<typeof ToolResultSchema>

// ---------------------------------------------------------------------------
// New Phase 14.5 schemas
// ---------------------------------------------------------------------------

export const ToolSourceSchema = z.enum(['core', 'mcp', 'plugin'])

export type ToolSource = z.infer<typeof ToolSourceSchema>

export const ToolTypeSchema = z.enum(['read', 'write', 'execute'])

export type ToolType = z.infer<typeof ToolTypeSchema>

/**
 * Tool-level permission: whether a model is allowed to call this tool.
 * This is distinct from CommandRiskLevel (which classifies command danger).
 */
export const ToolPermissionLevelSchema = z.enum([
  'allowed',
  'requires_approval',
  'denied',
])

export type ToolPermissionLevel = z.infer<typeof ToolPermissionLevelSchema>

export const ToolApprovalStatusSchema = z.enum([
  'not_required',
  'pending',
  'approved',
  'denied',
])

export type ToolApprovalStatus = z.infer<typeof ToolApprovalStatusSchema>

export const ToolDescriptorSchema = z.object({
  name: z.string().min(1),
  displayName: z.string().min(1).optional(),
  source: ToolSourceSchema,
  type: ToolTypeSchema,
  permission: ToolPermissionLevelSchema,
  requiresApproval: z.boolean(),
  modelCallable: z.boolean().default(true),
  description: z.string().optional(),
})

export type ToolDescriptor = z.infer<typeof ToolDescriptorSchema>

export const ToolCallRecordSchema = z.object({
  id: z.string().min(1),
  taskId: z.string().min(1),
  name: z.string().min(1),
  displayName: z.string().min(1).optional(),
  source: ToolSourceSchema,
  type: ToolTypeSchema,
  permission: ToolPermissionLevelSchema,
  requiresApproval: z.boolean(),
  approvalStatus: ToolApprovalStatusSchema,
  args: z.record(z.string(), z.unknown()),
  result: z.unknown().optional(),
  error: z.string().optional(),
  startedAt: z.string().datetime(),
  finishedAt: z.string().datetime().optional(),
})

export type ToolCallRecord = z.infer<typeof ToolCallRecordSchema>

export const ToolStartedEventPayloadSchema = z.object({
  toolCallId: z.string().optional(),
  toolName: z.string().min(1),
  displayName: z.string().optional(),
  source: ToolSourceSchema.default('core'),
  type: ToolTypeSchema.default('read'),
  permission: ToolPermissionLevelSchema.default('allowed'),
  requiresApproval: z.boolean().default(false),
  approvalStatus: ToolApprovalStatusSchema.default('not_required'),
  args: z.unknown().optional(),
  command: z.string().optional(),
  cwd: z.string().optional(),
  approvalId: z.string().optional(),
  risk: z.string().optional(),
  riskColor: z.string().optional(),
})

export type ToolStartedEventPayload = z.infer<
  typeof ToolStartedEventPayloadSchema
>

export const ToolFinishedEventPayloadSchema = z.object({
  toolCallId: z.string().optional(),
  toolName: z.string().min(1),
  displayName: z.string().optional(),
  source: ToolSourceSchema.default('core'),
  type: ToolTypeSchema.default('read'),
  permission: ToolPermissionLevelSchema.default('allowed'),
  requiresApproval: z.boolean().default(false),
  approvalStatus: ToolApprovalStatusSchema.default('not_required'),
  ok: z.boolean().optional(),
  rejected: z.boolean().optional(),
  result: z.unknown().optional(),
  error: z.string().optional(),
  command: z.string().optional(),
})

export type ToolFinishedEventPayload = z.infer<
  typeof ToolFinishedEventPayloadSchema
>

export function createToolCallId(): string {
  return `tool_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 10)}`
}
