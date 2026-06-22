import { z } from 'zod'

export const BuiltinToolNameSchema = z.enum([
  'list_files',
  'read_file',
  'search_text',
  'apply_patch',
  'run_command',
  'get_diff',
])

export type BuiltinToolName = z.infer<typeof BuiltinToolNameSchema>

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
